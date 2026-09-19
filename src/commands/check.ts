/**
 * `tutor check` - type-checks and tests your sandbox work, then explains it.
 */
import { TutorSession } from "../agent.js";
import { CHECK_MODE } from "../prompts.js";
import { converse } from "../repl.js";
import { readJournal } from "../progress.js";
import { dim, heading, warn } from "../ui.js";

export async function checkCommand(): Promise<number> {
  const journal = await readJournal();
  const exercise = journal.currentExercise;

  heading(exercise === undefined ? "Checking sandbox" : `Checking ${exercise}`);

  if (exercise === undefined) {
    warn("No exercise on record. Checking whatever is in sandbox/ anyway.");
    console.log(dim("Run 'tutor drill <topic>' to get one set for you.\n"));
  }

  const opener =
    exercise === undefined
      ? "Check my sandbox and tell me how I did."
      : `I have attempted sandbox/${exercise}.ts. Check it and tell me how I did.`;

  const session = new TutorSession(CHECK_MODE);
  await converse(session, opener);
  return 0;
}
