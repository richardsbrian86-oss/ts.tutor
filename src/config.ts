/**
 * Every setting the tutor needs, resolved once, in one place.
 *
 * READING NOTE: `export const` at module scope runs exactly once, the first
 * time any file imports this module. Node caches the result. So PROJECT_ROOT
 * is computed once per process, not once per import.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where ts-tutor itself is installed.
 *
 * In an ES module there is no `__dirname` - that is a CommonJS-only global and
 * referencing it throws. `import.meta.url` is the ESM replacement: it holds
 * this file's own URL (`file:///home/you/ts-tutor/src/config.ts`), which
 * `fileURLToPath` turns back into a plain path.
 */
const thisFileDir = path.dirname(fileURLToPath(import.meta.url));

/** The repo root. `src/config.ts` and `dist/config.js` are both one level down. */
export const PROJECT_ROOT = path.resolve(thisFileDir, "..");

/** Where exercises are written and where `tutor check` is allowed to run code. */
export const SANDBOX_DIR = path.join(PROJECT_ROOT, "sandbox");

/** Your learning journal. Plain JSON on purpose - open it and read it. */
export const PROGRESS_FILE = path.join(PROJECT_ROOT, "progress.json");

/**
 * The directory the tutor may read *your* code from: wherever you ran the
 * command. `cd` into a project you built on Replit, run `tutor read app.ts`,
 * and the agent can see that project and nothing above it.
 */
export const STUDY_ROOT = process.cwd();

/**
 * Loads .env into process.env if the file exists.
 *
 * `process.loadEnvFile` is built into Node (18.20+/20.12+), so there is no
 * dotenv dependency here. It throws when the file is missing, which is a
 * perfectly normal situation, so the throw is swallowed.
 */
export function loadEnv(): void {
  try {
    process.loadEnvFile(path.join(PROJECT_ROOT, ".env"));
  } catch {
    // No .env file. The key may still come from the shell environment.
  }
}

/**
 * `??` is the nullish-coalescing operator: it falls back only on null or
 * undefined, unlike `||`, which would also fall back on an empty string.
 */
export const MODEL = process.env["TUTOR_MODEL"] ?? "claude-opus-5";

/**
 * A cap, not a target - you are only billed for tokens actually produced.
 * 16k is plenty for explanation-shaped answers.
 */
export const MAX_TOKENS = 16_000;

/**
 * How hard the model works before answering. Leaving this unset uses the API
 * default ("high"). Set TUTOR_EFFORT=medium to spend fewer tokens per turn.
 */
export const EFFORT = process.env["TUTOR_EFFORT"];

/** Refuse to read anything enormous into the conversation. */
export const MAX_READ_BYTES = 80_000;
