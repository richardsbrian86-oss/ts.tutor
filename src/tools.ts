/**
 * The tools the tutor can call.
 *
 * A "tool" is just a function plus a description of its arguments. The model
 * never runs anything itself: it emits a request like
 * `read_file({ path: "src/app.ts" })`, this file runs the real function, and
 * the return value goes back into the conversation.
 *
 * Each tool is described once, as a Zod schema, and that single description is
 * used three ways:
 *   1. converted to JSON Schema, which is the format the API expects;
 *   2. checked at runtime, because model output is untrusted input;
 *   3. turned into a static TypeScript type via `z.infer`, so `run` gets real
 *      types instead of `any`.
 */
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type Anthropic from "@anthropic-ai/sdk";
import { listSourceFiles, readSourceFile, writeSandboxFile } from "./workspace.js";
import { formatCheckResult, runCheck } from "./checker.js";
import { recordEntry, setCurrentExercise } from "./progress.js";
import { STUDY_ROOT } from "./config.js";

/**
 * A tool after its specific input type has been erased.
 *
 * READING NOTE: the registry below holds tools with different input shapes.
 * A single array cannot be typed as "tool taking A" and "tool taking B" at the
 * same time, so `defineTool` keeps the precise types *inside* each tool and
 * exposes this uniform `unknown`-taking surface outside. That is the standard
 * way to store differently-typed things in one collection safely.
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: Anthropic.Tool["input_schema"];
  /** Validates the raw model input, then runs. Returns text for the model. */
  run(rawInput: unknown): Promise<string>;
  /** A one-line description of the call, printed so you can see what it did. */
  describeCall(rawInput: unknown): string;
}

/**
 * `<Schema extends z.ZodTypeAny>` is a generic parameter: it stands for
 * whatever schema is passed in. `z.infer<Schema>` then extracts the TypeScript
 * type that schema describes, which is how `run(input)` below knows that
 * `input.path` is a string without anyone writing that type out twice.
 */
function defineTool<Schema extends z.ZodTypeAny>(definition: {
  name: string;
  description: string;
  schema: Schema;
  run(input: z.infer<Schema>): Promise<string>;
  describeCall(input: z.infer<Schema>): string;
}): Tool {
  // zodToJsonSchema adds a "$schema" key the Messages API does not want.
  const { $schema, ...jsonSchema } = zodToJsonSchema(definition.schema, {
    target: "jsonSchema7",
  }) as Record<string, unknown>;
  void $schema;

  return {
    name: definition.name,
    description: definition.description,
    inputSchema: jsonSchema as Anthropic.Tool["input_schema"],
    run: async (rawInput) => definition.run(definition.schema.parse(rawInput)),
    describeCall: (rawInput) => {
      const parsed = definition.schema.safeParse(rawInput);
      return parsed.success ? definition.describeCall(parsed.data) : definition.name;
    },
  };
}

const listFiles = defineTool({
  name: "list_files",
  description:
    "List the source files in the learner's project so you can decide what is " +
    "worth reading. Paths are relative to the directory they ran the command in.",
  schema: z.object({
    directory: z
      .string()
      .optional()
      .describe("Subdirectory to list. Omit for the whole project."),
  }),
  describeCall: (input) => `list_files(${input.directory ?? "."})`,
  run: async (input) => {
    const files = await listSourceFiles(input.directory ?? ".");
    if (files.length === 0) return `No source files found under ${STUDY_ROOT}.`;
    return files.join("\n");
  },
});

const readFile = defineTool({
  name: "read_file",
  description:
    "Read a file from the learner's project, with line numbers attached. Always " +
    "read the real code before explaining it - never guess at what it contains. " +
    "Use startLine/endLine to read a long file in pieces.",
  schema: z.object({
    path: z.string().describe("File path relative to the project directory."),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
  }),
  describeCall: (input) =>
    input.startLine === undefined
      ? `read_file(${input.path})`
      : `read_file(${input.path}:${input.startLine}-${input.endLine ?? "end"})`,
  run: async (input) => {
    const slice = await readSourceFile(input.path, input.startLine, input.endLine);
    const header = slice.truncated
      ? `${slice.relativePath} (partial, ${slice.totalLines} lines total)`
      : `${slice.relativePath} (${slice.totalLines} lines)`;
    return `${header}\n\n${slice.numberedText}`;
  },
});

const writeExercise = defineTool({
  name: "write_exercise",
  description:
    "Create a practice exercise in the sandbox: a stub file for the learner to " +
    "fill in, and a test file that decides whether they got it right. Leave the " +
    "hard part unwritten - the stub should not contain the answer. Tell them " +
    "afterwards which file to open.",
  schema: z.object({
    name: z
      .string()
      .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only.")
      .describe("Short slug, e.g. 'narrowing-unions'."),
    instructions: z.string().describe("A short comment block for the top of the stub."),
    starterCode: z.string().describe("The stub file contents, including the instructions."),
    testCode: z
      .string()
      .describe("A vitest test file. Import from './<name>.js' (note the .js extension)."),
  }),
  describeCall: (input) => `write_exercise(${input.name})`,
  run: async (input) => {
    const stub = await writeSandboxFile(`${input.name}.ts`, input.starterCode);
    const test = await writeSandboxFile(`${input.name}.test.ts`, input.testCode);
    await setCurrentExercise(input.name);
    return `Created sandbox/${stub} and sandbox/${test}. The learner should open sandbox/${stub}, fill it in, then run: npm run tutor -- check`;
  },
});

const checkWork = defineTool({
  name: "run_check",
  description:
    "Type-check the sandbox and run its tests. Use this to see exactly what the " +
    "learner's code does before commenting on it. Translate any errors into plain " +
    "English - do not just repeat the compiler output at them.",
  schema: z.object({}),
  describeCall: () => "run_check()",
  run: async () => formatCheckResult(await runCheck()),
});

const recordProgress = defineTool({
  name: "record_progress",
  description:
    "Append a line to the learner's journal when they have genuinely understood " +
    "something, or when a gap is worth returning to. Be honest in the confidence " +
    "rating - an inflated journal is useless to them.",
  schema: z.object({
    topic: z.string().describe("Short topic label, e.g. 'discriminated unions'."),
    note: z.string().describe("One or two sentences on what they now understand."),
    confidence: z.enum(["shaky", "getting-it", "solid"]),
    source: z.string().optional().describe("The file being studied, if any."),
  }),
  describeCall: (input) => `record_progress(${input.topic}: ${input.confidence})`,
  run: async (input) => {
    // `exactOptionalPropertyTypes` is on, so an explicit `source: undefined`
    // is not the same as leaving the key out. This builds the object both ways.
    const total = await recordEntry(
      input.source === undefined
        ? { topic: input.topic, note: input.note, confidence: input.confidence }
        : {
            topic: input.topic,
            note: input.note,
            confidence: input.confidence,
            source: input.source,
          },
    );
    return `Recorded. The journal now has ${total} entries.`;
  },
});

/** Every tool, in a fixed order. */
export const TOOLS: readonly Tool[] = [
  listFiles,
  readFile,
  writeExercise,
  checkWork,
  recordProgress,
];

/** Reshapes the registry into what the Messages API expects. */
export function toolDefinitions(): Anthropic.Tool[] {
  return TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

/** Finds a tool by the name the model used. */
export function findTool(name: string): Tool | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
