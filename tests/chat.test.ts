import { describe, expect, test, vi } from "vitest";
import {
  chat,
  FALLBACK_REPLY,
  type Content,
  type ModelClient,
  type ModelTurn,
  type ToolRegistry,
} from "../src/core/chatbot.js";

// --- test helpers ---------------------------------------------------------

function textTurn(text: string): ModelTurn {
  return { text, functionCalls: [], content: { role: "model", parts: [{ text }] } };
}

function callTurn(name: string, args: Record<string, unknown>): ModelTurn {
  return {
    text: "",
    functionCalls: [{ name, args }],
    content: { role: "model", parts: [{ functionCall: { name, args } }] },
  };
}

/** A model that replays a fixed script of turns and records what it was sent. */
function scriptedModel(turns: ModelTurn[]): ModelClient & { calls: Content[][] } {
  const calls: Content[][] = [];
  let i = 0;
  return {
    calls,
    async generate(contents) {
      calls.push(structuredClone(contents));
      return turns[i++] ?? textTurn("(script exhausted)");
    },
  };
}

const noTools: ToolRegistry = {};

// --- tests ----------------------------------------------------------------

describe("chat", () => {
  test("returns the model's text when no tool is requested", async () => {
    const model = scriptedModel([textTurn("Hi, how can I help?")]);
    const result = await chat([], "hello", { model, tools: noTools });

    expect(result.reply).toBe("Hi, how can I help?");
    // history = user message + model reply
    expect(result.history).toHaveLength(2);
    expect(result.history[0]).toEqual({ role: "user", parts: [{ text: "hello" }] });
  });

  test("executes a requested tool and feeds its result back to the model", async () => {
    const tool = vi.fn(() => ({ found: true, status: "Shipped" }));
    const model = scriptedModel([
      callTurn("get_order_status", { order_id: "1001" }),
      textTurn("Your order 1001 is Shipped."),
    ]);

    const result = await chat([], "where is order 1001?", {
      model,
      tools: { get_order_status: tool },
    });

    expect(tool).toHaveBeenCalledWith({ order_id: "1001" });
    expect(result.reply).toBe("Your order 1001 is Shipped.");
    // The second model call must include the functionResponse we appended.
    const secondCall = model.calls[1]!;
    const toolResponseTurn = secondCall[secondCall.length - 1]!;
    // Gemini requires the function response to be attributed to the "user" role.
    expect(toolResponseTurn.role).toBe("user");
    expect(JSON.stringify(toolResponseTurn)).toContain("functionResponse");
    expect(JSON.stringify(toolResponseTurn)).toContain("Shipped");
  });

  test("stops at the turn cap and returns the fallback reply", async () => {
    // Model always asks for a tool, never gives a final text answer.
    const model: ModelClient = {
      async generate() {
        return callTurn("search_faq", { query: "loop" });
      },
    };
    const result = await chat([], "loop forever", {
      model,
      tools: { search_faq: () => ({ matches: [] }) },
      maxTurns: 3,
    });
    expect(result.reply).toBe(FALLBACK_REPLY);
  });

  test("never throws on a model/API error — returns the fallback reply", async () => {
    const model: ModelClient = {
      async generate() {
        throw new Error("503 service unavailable");
      },
    };
    const result = await chat([], "hi", { model, tools: noTools });
    expect(result.reply).toBe(FALLBACK_REPLY);
  });

  test("handles an unknown tool name gracefully and keeps going", async () => {
    const model = scriptedModel([
      callTurn("nonexistent_tool", {}),
      textTurn("Sorry, I couldn't look that up."),
    ]);
    const result = await chat([], "do something weird", { model, tools: noTools });

    expect(result.reply).toBe("Sorry, I couldn't look that up.");
    const secondCall = model.calls[1]!;
    expect(JSON.stringify(secondCall)).toContain("error");
  });

  test("captures a throwing tool as an error result instead of crashing", async () => {
    const model = scriptedModel([
      callTurn("get_order_status", { order_id: "x" }),
      textTurn("Something went wrong fetching that."),
    ]);
    const boom: ToolRegistry = {
      get_order_status: () => {
        throw new Error("data file corrupt");
      },
    };
    const result = await chat([], "where is order x?", { model, tools: boom });

    expect(result.reply).toBe("Something went wrong fetching that.");
    expect(JSON.stringify(model.calls[1])).toContain("error");
  });
});
