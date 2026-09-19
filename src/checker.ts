/**
 * Runs the two checks that grade an exercise: the type checker, then the tests.
 *
 * Both run as child processes against sandbox/ only. Nothing here executes code
 * you did not put in the sandbox yourself.
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { PROJECT_ROOT } from "./config.js";

/**
 * `execFile` is callback-based. `promisify` wraps it so it can be awaited.
 * Note it is execFile, not `exec`: execFile takes an argument array and never
 * hands the command to a shell, so a filename with a space or a `;` in it
 * cannot turn into a second command.
 */
const run = promisify(execFile);

export interface CommandResult {
  ok: boolean;
  output: string;
}

export interface CheckResult {
  typecheck: CommandResult;
  /** Undefined when the type check failed - there is no point running tests yet. */
  tests?: CommandResult;
  ok: boolean;
}

/** Locates a tool installed in node_modules, cross-platform. */
function localBin(name: string): string {
  const binary = process.platform === "win32" ? `${name}.cmd` : name;
  return path.join(PROJECT_ROOT, "node_modules", ".bin", binary);
}

/**
 * Runs one command and captures its output whether it succeeds or fails.
 *
 * READING NOTE: a non-zero exit code makes `run` reject. For a type checker
 * that is not an error condition - it is the answer. So the catch block reads
 * stdout/stderr off the rejection and reports `ok: false` instead of throwing.
 */
async function capture(command: string, args: string[]): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await run(command, args, {
      cwd: PROJECT_ROOT,
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { ok: true, output: `${stdout}${stderr}`.trim() };
  } catch (err) {
    const failure = err as { stdout?: string; stderr?: string; message?: string };
    const output = `${failure.stdout ?? ""}${failure.stderr ?? ""}`.trim();
    return { ok: false, output: output || failure.message || "Command failed" };
  }
}

/** Type-checks the sandbox, then runs its tests if it compiled. */
export async function runCheck(): Promise<CheckResult> {
  const typecheck = await capture(localBin("tsc"), [
    "--noEmit",
    "-p",
    path.join("sandbox", "tsconfig.json"),
  ]);

  if (!typecheck.ok) {
    return { typecheck, ok: false };
  }

  const tests = await capture(localBin("vitest"), [
    "run",
    "--config",
    "vitest.sandbox.config.ts",
    "--reporter",
    "basic",
  ]);

  return { typecheck, tests, ok: tests.ok };
}

/** Flattens a CheckResult into the text the model reads back. */
export function formatCheckResult(result: CheckResult): string {
  if (!result.typecheck.ok) {
    return `TYPE CHECK FAILED:\n${result.typecheck.output}`;
  }
  const tests = result.tests;
  if (tests === undefined) {
    return "TYPE CHECK PASSED. Tests were not run.";
  }
  return [
    "TYPE CHECK PASSED.",
    tests.ok ? "TESTS PASSED:" : "TESTS FAILED:",
    tests.output,
  ].join("\n");
}
