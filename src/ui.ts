/**
 * Terminal output and input. No dependencies - just ANSI escape codes and the
 * readline module Node ships with.
 *
 * READING NOTE: `\x1b[36m` is an escape sequence. The terminal reads it as
 * "switch to cyan" rather than printing it. `\x1b[0m` switches back.
 */
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

/** Disable colour when output is piped to a file, or when NO_COLOR is set. */
const useColor = stdout.isTTY === true && process.env["NO_COLOR"] === undefined;

function paint(code: string, text: string): string {
  return useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}

export const cyan = (t: string): string => paint("36", t);
export const green = (t: string): string => paint("32", t);
export const yellow = (t: string): string => paint("33", t);
export const red = (t: string): string => paint("31", t);
export const dim = (t: string): string => paint("2", t);
export const bold = (t: string): string => paint("1", t);

export function heading(text: string): void {
  console.log(`\n${bold(cyan(text))}`);
  console.log(dim("─".repeat(Math.min(text.length, 60))));
}

export function info(text: string): void {
  console.log(dim(text));
}

export function warn(text: string): void {
  console.log(yellow(text));
}

export function error(text: string): void {
  console.error(red(text));
}

/**
 * A reusable question-asker for the conversation loop.
 *
 * READING NOTE: the return type is an object with two function properties.
 * Writing it out like this - rather than returning a class instance - keeps
 * the shape obvious at the call site.
 */
export interface Prompter {
  ask(question: string): Promise<string>;
  close(): void;
}

export function createPrompter(): Prompter {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  return {
    ask: (question: string) => rl.question(question),
    close: () => rl.close(),
  };
}
