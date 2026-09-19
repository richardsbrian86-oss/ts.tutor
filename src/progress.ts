/**
 * Your learning journal, stored as plain JSON at the repo root so you can open
 * it in an editor and read it without any tooling.
 */
import fs from "node:fs/promises";
import { PROGRESS_FILE } from "./config.js";

/** How well you felt you understood a topic. */
export type Confidence = "shaky" | "getting-it" | "solid";

export interface JournalEntry {
  /** ISO 8601 timestamp, e.g. "2026-09-19T14:03:11.000Z". */
  at: string;
  topic: string;
  note: string;
  confidence: Confidence;
  /** The file you were reading, when the entry came from a reading session. */
  source?: string;
}

export interface Journal {
  entries: JournalEntry[];
  /** The exercise `tutor check` should verify, if one is in progress. */
  currentExercise?: string;
}

const EMPTY: Journal = { entries: [] };

/**
 * Reads the journal, returning an empty one if the file does not exist yet.
 *
 * READING NOTE: the `catch` inspects the error rather than swallowing it.
 * "File not found" is expected on a first run; anything else is a real problem
 * and gets re-thrown, so a permissions bug does not silently look like
 * "no progress yet".
 */
export async function readJournal(): Promise<Journal> {
  try {
    const raw = await fs.readFile(PROGRESS_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);

    // JSON.parse returns `any`, which would let anything through unchecked.
    // Annotating it as `unknown` above forces this narrowing step.
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "entries" in parsed &&
      Array.isArray((parsed as Journal).entries)
    ) {
      return parsed as Journal;
    }
    return EMPTY;
  } catch (err) {
    if (isNotFound(err)) return EMPTY;
    throw err;
  }
}

/** Node's filesystem errors carry a `code` property; TypeScript needs proof. */
function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}

async function writeJournal(journal: Journal): Promise<void> {
  await fs.writeFile(PROGRESS_FILE, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
}

/** Appends one entry. Returns the number of entries now recorded. */
export async function recordEntry(
  entry: Omit<JournalEntry, "at">,
): Promise<number> {
  const journal = await readJournal();
  journal.entries.push({ at: new Date().toISOString(), ...entry });
  await writeJournal(journal);
  return journal.entries.length;
}

/** Remembers which exercise is open, so `tutor check` knows what to run. */
export async function setCurrentExercise(name: string | undefined): Promise<void> {
  const journal = await readJournal();
  if (name === undefined) {
    delete journal.currentExercise;
  } else {
    journal.currentExercise = name;
  }
  await writeJournal(journal);
}
