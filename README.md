# ts-tutor

A TypeScript tutor that runs in your terminal. It reads your actual code with
you, asks you questions about it, and sets exercises it can grade.

Built for the specific gap of *"I can get an app working with AI help, but I
can't read the code it produced or change it by hand."*

## What it does

| Command | What happens |
| --- | --- |
| `tutor read <file>` | Reads a file you already have and walks you through it, stopping to ask questions that check you followed. This is the main event. |
| `tutor drill <topic>` | Writes a stub and a test file into `sandbox/`. You fill in the stub yourself. |
| `tutor check` | Type-checks and runs your sandbox work, then explains what the errors actually mean in English. |
| `tutor chat [question]` | Open-ended questions, with your project readable. |
| `tutor progress` | Prints your journal. No API calls, so no cost. |

## Setup

```bash
git clone <this repo>
cd ts-tutor
npm install
cp .env.example .env     # then put your key in it
```

You need an Anthropic API key from
[console.anthropic.com](https://console.anthropic.com/settings/keys). This is
billed per use — a reading session over a few hundred lines costs cents, not
dollars, but it is real money rather than a flat subscription.

## Using it

Run it from inside the project you want to understand. It can read files in
that directory and nothing above it.

```bash
cd ~/my-replit-app
node ~/ts-tutor/dist/cli.js read server/routes.ts
```

Or from inside this repo, with `npm run tutor`:

```bash
npm run tutor -- read src/agent.ts
npm run tutor -- drill "narrowing union types"
npm run tutor -- check
npm run tutor -- progress
```

To get a plain `tutor` command anywhere, run `npm run build && npm link` once.

Type `exit` to end a session.

## The source is part of the point

This tool is written in the language it teaches, and it is commented far more
heavily than production code normally would be — every file has notes on *why*
something is written the way it is, not just what it does.

A reasonable first lesson is pointing it at itself:

```bash
npm run tutor -- read src/agent.ts
```

Suggested reading order, easiest first:

1. **`src/ui.ts`** — plain functions, no async. Terminal colours and input.
2. **`src/config.ts`** — module-level constants, and how ESM finds its own path.
3. **`src/progress.ts`** — reading and writing JSON safely, narrowing `unknown`.
4. **`src/workspace.ts`** — file handling, recursion, and why every path is
   checked before it reaches the filesystem.
5. **`src/cli.ts`** — how the program starts and dispatches.
6. **`src/tools.ts`** — generics and type inference doing real work.
7. **`src/agent.ts`** — the agent loop itself.

## How it is built

- **`@anthropic-ai/sdk`** talking to `claude-opus-5`, with streaming so replies
  appear as they are written.
- **The agent loop is written by hand** in `src/agent.ts` rather than using the
  SDK's tool-runner helper. The helper is shorter but it hides the loop, and a
  loop you can read is worth more here.
- **Five tools** (`src/tools.ts`): `list_files`, `read_file`, `write_exercise`,
  `run_check`, `record_progress`. Each is described once as a Zod schema, which
  becomes the JSON Schema sent to the API, the runtime validation of what comes
  back, and the static type inside the function.
- **Everything strict**: `strict`, `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` are on, for this project and for your exercises.

## Safety

- File reads are confined to the directory you ran the command in. Paths from
  the model are resolved and checked before they reach `fs` — see
  `resolveWithin` in `src/workspace.ts`, and the tests for it in
  `src/__tests__/workspace.test.ts`.
- Writes only ever go to `sandbox/`.
- `tutor check` runs `tsc` and `vitest` against `sandbox/` only.
- Child processes use `execFile`, never a shell.

## Working on it

```bash
npm run typecheck
npm test
npm run build
```

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Required. |
| `TUTOR_MODEL` | `claude-opus-5` | |
| `TUTOR_EFFORT` | API default | `low`–`max`. Lower spends fewer tokens per turn. |
