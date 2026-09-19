/**
 * `tutor read <file>` - a guided walkthrough of a file you already have.
 */
import path from "node:path";
import fs from "node:fs/promises";
import { TutorSession } from "../agent.js";
import { readModePrompt } from "../prompts.js";
import { converse } from "../repl.js";
import { STUDY_ROOT } from "../config.js";
import { dim, error, heading } from "../ui.js";
import { resolveWithin } from "../workspace.js";

export async function readCommand(target: string | undefined): Promise<number> {
  if (target === undefined) {
    error("Usage: tutor read <file>");
    return 1;
  }

  // Fail here, with a clear message, rather than letting the model discover the
  // file is missing three tool calls later.
  let absolute: string;
  try {
    absolute = resolveWithin(STUDY_ROOT, target);
    await fs.access(absolute);
  } catch {
    error(`Cannot read "${target}" from ${STUDY_ROOT}.`);
    error("cd into the project first, then pass a path inside it.");
    return 1;
  }

  const relative = path.relative(STUDY_ROOT, absolute);

  heading(`Reading ${relative}`);
  console.log(dim("Answer in your own words - guessing out loud is the point."));
  console.log(dim("Type 'exit' when you are done.\n"));

  const session = new TutorSession(readModePrompt(relative));
  await converse(
    session,
    `Walk me through ${relative}. I want to understand it well enough to change it myself.`,
  );
  return 0;
}
