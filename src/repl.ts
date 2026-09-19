/**
 * The back-and-forth loop shared by every conversational command.
 */
import { TutorSession, explainApiError } from "./agent.js";
import { createPrompter, cyan, dim, error } from "./ui.js";

/**
 * Sends an opening message, then hands the conversation back and forth until
 * the learner exits.
 *
 * READING NOTE: the `finally` block is the point of the try here. There is no
 * `catch` - errors still propagate - but the readline interface gets closed
 * either way, so a crash cannot leave the terminal in a broken state.
 */
export async function converse(session: TutorSession, opener: string): Promise<void> {
  const prompter = createPrompter();
  try {
    await send(session, opener);

    for (;;) {
      const answer = (await prompter.ask(cyan("you › "))).trim();
      if (answer === "") continue;
      if (["exit", "quit", ":q"].includes(answer.toLowerCase())) {
        console.log(dim("Session ended."));
        return;
      }
      await send(session, answer);
    }
  } finally {
    prompter.close();
  }
}

/**
 * One turn, with API failures reported rather than fatal - a rate limit should
 * not throw away the conversation you are in the middle of.
 */
async function send(session: TutorSession, text: string): Promise<void> {
  try {
    await session.send(text);
  } catch (err) {
    error(`\n${explainApiError(err)}\n`);
  }
}
