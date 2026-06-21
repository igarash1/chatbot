// The interface-agnostic "brain". chat() takes prior history plus a new user
// message and returns a reply and updated history. It is stateless: the caller
// (CLI/web) owns the history and passes it back each turn.
//
// The loop depends only on a small ModelClient seam and a tool registry, both
// injected. That keeps this logic fully testable with a fake model (no API key),
// while gemini.ts implements ModelClient with the real SDK.

/** A conversation turn, mirroring the SDK's Content (role + parts). */
export type Content = { role: string; parts: unknown[] };

export type FunctionCall = {
  /** SDK-provided call id, echoed back so parallel calls match their responses. */
  id?: string;
  name: string;
  args: Record<string, unknown>;
};

/** One model response, normalized for the loop. */
export type ModelTurn = {
  /** Final text answer, or "" when the model asked for a tool instead. */
  text: string;
  /** Tool calls the model requested this turn (empty when it answered). */
  functionCalls: FunctionCall[];
  /** The raw model turn to append to history before continuing. */
  content: Content;
};

export interface ModelClient {
  generate(contents: Content[]): Promise<ModelTurn>;
}

/** Maps a tool name to a synchronous executor returning a facts-only result. */
export type ToolRegistry = Record<string, (args: Record<string, unknown>) => unknown>;

export type ChatResult = {
  reply: string;
  history: Content[];
};

export type ChatDeps = {
  model: ModelClient;
  tools: ToolRegistry;
  /** Max model round-trips before giving up. Defaults to 5. */
  maxTurns?: number;
};

export const FALLBACK_REPLY =
  "Sorry, I'm having trouble with that right now. Please contact support@example.com.";

const DEFAULT_MAX_TURNS = 5;

function userText(text: string): Content {
  return { role: "user", parts: [{ text }] };
}

/** Run one tool safely, returning either its result or an error marker. */
function runTool(tools: ToolRegistry, call: FunctionCall): unknown {
  const tool = tools[call.name];
  if (!tool) return { error: `unknown tool: ${call.name}` };
  try {
    return tool(call.args);
  } catch {
    return { error: `tool ${call.name} failed` };
  }
}

export async function chat(
  history: Content[],
  userMessage: string,
  deps: ChatDeps,
): Promise<ChatResult> {
  const { model, tools } = deps;
  const maxTurns = deps.maxTurns ?? DEFAULT_MAX_TURNS;
  const contents: Content[] = [...history, userText(userMessage)];

  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      const result = await model.generate(contents);
      contents.push(result.content);

      if (result.functionCalls.length === 0) {
        const reply = result.text.trim() || FALLBACK_REPLY;
        return { reply, history: contents };
      }

      // Execute every requested tool and feed the facts back in one turn.
      const responseParts = result.functionCalls.map((call) => ({
        functionResponse: {
          ...(call.id ? { id: call.id } : {}),
          name: call.name,
          response: runTool(tools, call),
        },
      }));
      contents.push({ role: "user", parts: responseParts });
    }
  } catch {
    // Any model/API error: never throw to the caller, degrade gracefully.
    return { reply: FALLBACK_REPLY, history: contents };
  }

  // Hit the turn cap without a final text answer.
  return { reply: FALLBACK_REPLY, history: contents };
}
