#!/usr/bin/env node
/**
 * The entry point. Reads the command line, dispatches, sets the exit code.
 *
 * READING NOTE: start here when you want to follow how the program runs.
 * process.argv is [node, script, ...your arguments], so the real arguments
 * begin at index 2.
 */
import { loadEnv, STUDY_ROOT } from "./config.js";
import { readCommand } from "./commands/read.js";
import { drillCommand } from "./commands/drill.js";
import { checkCommand } from "./commands/check.js";
import { chatCommand } from "./commands/chat.js";
import { progressCommand } from "./commands/progress.js";
import { bold, cyan, dim, error } from "./ui.js";

const HELP = `${bold("ts-tutor")} - a TypeScript tutor in your terminal

${bold("USAGE")}
  tutor <command> [arguments]

${bold("COMMANDS")}
  read <file>      Walk through a file you already have, with questions
  drill <topic>    Get an exercise written to sandbox/, then grade it
  check            Type-check and test your sandbox work, explained
  chat [question]  Open-ended, with your project readable
  progress         Show your journal (no API calls, no cost)
  help             This message

${bold("EXAMPLES")}
  ${dim("# in the project you want to understand")}
  cd ~/my-replit-app
  tutor read server/routes.ts

  tutor drill "narrowing union types"
  tutor check

${bold("SETUP")}
  Needs ANTHROPIC_API_KEY. Copy .env.example to .env and add your key,
  or export it in your shell.

  Reading from: ${STUDY_ROOT}`;

/** Commands that talk to the API, and therefore need a key. */
const NEEDS_API_KEY = new Set(["read", "drill", "check", "chat"]);

async function main(): Promise<number> {
  loadEnv();

  const [command, ...args] = process.argv.slice(2);

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return 0;
  }

  if (NEEDS_API_KEY.has(command) && !process.env["ANTHROPIC_API_KEY"]) {
    error("ANTHROPIC_API_KEY is not set.");
    error("Copy .env.example to .env and add your key, or export it:");
    error('  export ANTHROPIC_API_KEY="sk-ant-..."');
    return 1;
  }

  // A switch over a string is exhaustive only if you make it so - the default
  // branch is what catches a typo'd command.
  switch (command) {
    case "read":
      return readCommand(args[0]);
    case "drill":
      return drillCommand(args);
    case "check":
      return checkCommand();
    case "chat":
      return chatCommand(args);
    case "progress":
      return progressCommand();
    default:
      error(`Unknown command: ${command}`);
      console.log(dim(`Try ${cyan("tutor help")}`));
      return 1;
  }
}

/**
 * Top-level await is allowed in ES modules, so there is no wrapper function
 * needed here. Any error that escapes main() is reported and turns into a
 * non-zero exit code, which is what a shell or CI expects.
 */
try {
  process.exitCode = await main();
} catch (err) {
  error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
