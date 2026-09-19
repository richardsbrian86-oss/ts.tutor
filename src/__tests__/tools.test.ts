/**
 * Tests for the tool registry: that every tool is well-formed before it is ever
 * sent to the API, and that bad model input is rejected rather than executed.
 */
import { describe, expect, it } from "vitest";
import { TOOLS, findTool, toolDefinitions } from "../tools.js";

describe("tool registry", () => {
  it("exposes every tool to the API with a name, description and object schema", () => {
    const definitions = toolDefinitions();
    expect(definitions).toHaveLength(TOOLS.length);

    for (const definition of definitions) {
      expect(definition.name).toMatch(/^[a-z_]+$/);
      // `description` is optional in the SDK's Tool type, so it has to be
      // proven present before its length can be read.
      expect(definition.description).toBeDefined();
      expect((definition.description ?? "").length).toBeGreaterThan(20);
      expect(definition.input_schema.type).toBe("object");
    }
  });

  it("has no duplicate tool names", () => {
    const names = TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("finds a tool by name and returns undefined for anything else", () => {
    expect(findTool("read_file")?.name).toBe("read_file");
    expect(findTool("rm_rf")).toBeUndefined();
  });

  it("rejects input that does not match the schema", async () => {
    const readFile = findTool("read_file");
    expect(readFile).toBeDefined();
    // The model asked for a number where a string belongs. Zod stops it before
    // the filesystem is touched.
    await expect(readFile?.run({ path: 42 })).rejects.toThrow();
  });

  it("rejects an exercise name that could escape the sandbox", async () => {
    const writeExercise = findTool("write_exercise");
    await expect(
      writeExercise?.run({
        name: "../../etc/passwd",
        instructions: "x",
        starterCode: "x",
        testCode: "x",
      }),
    ).rejects.toThrow();
  });
});
