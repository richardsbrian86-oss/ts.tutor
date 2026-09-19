/**
 * The agent loop: the part that talks to Claude and runs the tools it asks for.
 *
 * The loop is written out by hand rather than using the SDK's tool-runner
 * helper, for two reasons: the runner is still beta, and a loop you can read
 * top to bottom is worth more in a project whose point is learning to read code.
 *
 * The shape is always the same, and it is worth committing to memory:
 *
 *   1. send the conversation so far
 *   2. if the reply is a plain answer, stop
 *   3. if the reply asks for tools, run them, append the results, go to 1
 */
import Anthropic from "@anthropic-ai/sdk";
import { EFFORT, MAX_TOKENS, MODEL } from "./config.js";
import { findTool, toolDefinitions } from "./tools.js";
import { dim, error, red } from "./ui.js";

/** Guards against a tool loop that never terminates. */
const MAX_TURNS = 24;

const VALID_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof VALID_EFFORTS)[number];

function effortOption(): Record<string, unknown> {
  const requested = EFFORT;
  if (requested === undefined) return {};
  if (!(VALID_EFFORTS as readonly string[]).includes(requested)) {
    error(`Ignoring TUTOR_EFFORT="${requested}" - expected one of ${VALID_EFFORTS.join(", ")}.`);
    return {};
  }
  return { output_config: { effort: requested as Effort } };
}

/**
 * One tutoring conversation.
 *
 * The full message history lives in `messages` and is resent on every request -
 * the API is stateless, so "the conversation" is only ever an array you own.
 */
export class TutorSession {
  private readonly client: Anthropic;
  private readonly system: string;
  private readonly messages: Anthropic.MessageParam[] = [];

  constructor(system: string) {
    // With no arguments the SDK reads ANTHROPIC_API_KEY from the environment.
    this.client = new Anthropic();
    this.system = system;
  }

  /**
   * Sends one turn and prints the reply as it arrives, running any tools the
   * model asks for along the way. Resolves when the model has finished.
   */
  async send(userText: string): Promise<void> {
    this.messages.push({ role: "user", content: userText });

    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      const stream = this.client.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: this.system,
        tools: toolDefinitions(),
        messages: this.messages,
        ...effortOption(),
      });

      // Print text as it is generated, so there is no long silent pause.
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          process.stdout.write(event.delta.text);
        }
      }

      // finalMessage() waits for the stream to finish and hands back the whole
      // assembled reply, including any tool_use blocks that were in it.
      const reply = await stream.finalMessage();
      this.messages.push({ role: "assistant", content: reply.content });

      if (reply.stop_reason === "refusal") {
        console.log(red("\n\n[The model declined to answer that.]"));
        return;
      }

      if (reply.stop_reason === "max_tokens") {
        console.log(dim("\n\n[Reply hit the length limit - ask it to continue.]"));
        return;
      }

      if (reply.stop_reason !== "tool_use") {
        console.log("\n");
        return;
      }

      // `filter` with a type predicate (`b is Anthropic.ToolUseBlock`) narrows
      // the array's type as it filters, so the loop below gets tool-use blocks
      // rather than the wider union of every possible content block.
      const toolUses = reply.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        results.push(await this.runTool(toolUse));
      }

      this.messages.push({ role: "user", content: results });
    }

    console.log(dim(`\n[Stopped after ${MAX_TURNS} tool turns.]`));
  }

  /** Runs one tool call and packages the outcome as a tool_result block. */
  private async runTool(
    toolUse: Anthropic.ToolUseBlock,
  ): Promise<Anthropic.ToolResultBlockParam> {
    const tool = findTool(toolUse.name);

    if (tool === undefined) {
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: `No such tool: ${toolUse.name}`,
        is_error: true,
      };
    }

    console.log(dim(`\n  · ${tool.describeCall(toolUse.input)}`));

    try {
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: await tool.run(toolUse.input),
      };
    } catch (err) {
      // A failing tool is normal - a missing file, a bad path. Report it back
      // as a result so the model can adjust, instead of crashing the session.
      const message = err instanceof Error ? err.message : String(err);
      console.log(dim(`    ${message}`));
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: message,
        is_error: true,
      };
    }
  }
}

/**
 * Turns an SDK error into something worth reading.
 *
 * READING NOTE: this is a most-specific-first chain. Catching one broad error
 * class would lose the difference between "your key is wrong" (fix your setup)
 * and "rate limited" (wait and retry).
 */
export function explainApiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Your API key was rejected. Check ANTHROPIC_API_KEY in .env.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Rate limited by the API. Wait a moment and try again.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Could not reach the API. Check your network connection.";
  }
  if (err instanceof Anthropic.APIError) {
    return `API error ${err.status ?? ""}: ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}
