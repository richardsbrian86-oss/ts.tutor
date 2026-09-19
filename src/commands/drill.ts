/**
 * `tutor drill <topic>` - generates an exercise and grades your attempt.
 */
import { TutorSession } from "../agent.js";
import { drillModePrompt } from "../prompts.js";
import { converse } from "../repl.js";
import { dim, error, heading } from "../ui.js";

export async function drillCommand(topicWords: string[]): Promise<number> {
  const topic = topicWords.join(" ").trim();
  if (topic === "") {
    error("Usage: tutor drill <topic>");
    error('For example: tutor drill "narrowing union types"');
    return 1;
  }

  heading(`Drill: ${topic}`);
  console.log(dim("The exercise lands in sandbox/. Fill in the stub, then run:"));
  console.log(dim("  npm run tutor -- check\n"));

  const session = new TutorSession(drillModePrompt(topic));
  await converse(session, `Set me an exercise on ${topic}.`);
  return 0;
}
