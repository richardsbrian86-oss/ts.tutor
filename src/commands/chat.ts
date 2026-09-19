/**
 * `tutor chat` - open-ended questions, with your project readable.
 */
import { TutorSession } from "../agent.js";
import { CHAT_MODE } from "../prompts.js";
import { converse } from "../repl.js";
import { STUDY_ROOT } from "../config.js";
import { dim, heading } from "../ui.js";

export async function chatCommand(question: string[]): Promise<number> {
  heading("TypeScript tutor");
  console.log(dim(`Reading from: ${STUDY_ROOT}`));
  console.log(dim("Type 'exit' when you are done.\n"));

  const opener =
    question.length > 0
      ? question.join(" ")
      : "I want to get better at reading TypeScript. Ask me what I am working on.";

  const session = new TutorSession(CHAT_MODE);
  await converse(session, opener);
  return 0;
}
