/**
 * `tutor progress` - prints your journal. No API calls, no cost.
 */
import { readJournal, type Confidence } from "../progress.js";
import { bold, dim, green, heading, red, yellow } from "../ui.js";

/**
 * READING NOTE: `Record<Confidence, ...>` builds an object type whose keys are
 * exactly the three values of the Confidence union. Add a fourth confidence
 * level to progress.ts and TypeScript will flag this object as incomplete -
 * which is the whole point of writing it this way.
 */
const MARKER: Record<Confidence, (text: string) => string> = {
  shaky: red,
  "getting-it": yellow,
  solid: green,
};

export async function progressCommand(): Promise<number> {
  const journal = await readJournal();

  heading("Your progress");

  if (journal.entries.length === 0) {
    console.log(dim("Nothing recorded yet. Start with: tutor read <a file you have>"));
    return 0;
  }

  for (const entry of journal.entries) {
    // `new Date(...)` parses the stored ISO string; slice(0, 10) keeps the date.
    const day = entry.at.slice(0, 10);
    const mark = MARKER[entry.confidence];
    console.log(`${dim(day)}  ${mark("●")} ${bold(entry.topic)}`);
    console.log(`            ${entry.note}`);
    if (entry.source !== undefined) console.log(dim(`            ${entry.source}`));
  }

  const counts = { shaky: 0, "getting-it": 0, solid: 0 };
  for (const entry of journal.entries) counts[entry.confidence] += 1;

  console.log(
    `\n${journal.entries.length} entries — ` +
      `${green(`${counts.solid} solid`)}, ` +
      `${yellow(`${counts["getting-it"]} getting it`)}, ` +
      `${red(`${counts.shaky} shaky`)}`,
  );

  if (journal.currentExercise !== undefined) {
    console.log(dim(`\nExercise in progress: sandbox/${journal.currentExercise}.ts`));
  }
  return 0;
}
