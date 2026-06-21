import { describe, expect, test, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import type { ChatDeps, ChatResult, Content } from "../src/core/chatbot.js";

// The route never touches the real model/tools — deps are inert here because we
// also inject a stub chat function. createApp(deps, chatFn) is the DI seam.
const deps = {} as ChatDeps;

function appWith(chatFn: (h: Content[], m: string, d: ChatDeps) => Promise<ChatResult>) {
  return createApp(deps, chatFn);
}

describe("POST /chat", () => {
  test("returns 200 with the reply and updated history from chat()", async () => {
    const chatFn = vi.fn(async () => ({
      reply: "Hello!",
      history: [{ role: "model", parts: [{ text: "Hello!" }] }] as Content[],
    }));
    const res = await request(appWith(chatFn))
      .post("/chat")
      .send({ message: "hi", history: [] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe("Hello!");
    expect(res.body.history).toEqual([{ role: "model", parts: [{ text: "Hello!" }] }]);
  });

  test("passes the request's history and message through to chat()", async () => {
    const prior: Content[] = [{ role: "user", parts: [{ text: "earlier" }] }];
    const chatFn = vi.fn(async () => ({ reply: "ok", history: [] as Content[] }));

    await request(appWith(chatFn)).post("/chat").send({ message: "next", history: prior });

    expect(chatFn).toHaveBeenCalledWith(prior, "next", deps);
  });

  test("returns 400 and does not call chat() when message is missing", async () => {
    const chatFn = vi.fn(async () => ({ reply: "x", history: [] as Content[] }));
    const res = await request(appWith(chatFn)).post("/chat").send({ history: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message/i);
    expect(chatFn).not.toHaveBeenCalled();
  });

  test("returns 400 when message is blank whitespace", async () => {
    const chatFn = vi.fn(async () => ({ reply: "x", history: [] as Content[] }));
    const res = await request(appWith(chatFn)).post("/chat").send({ message: "   " });

    expect(res.status).toBe(400);
    expect(chatFn).not.toHaveBeenCalled();
  });

  test("coerces a non-array history to [] before calling chat()", async () => {
    const chatFn = vi.fn(async () => ({ reply: "ok", history: [] as Content[] }));

    await request(appWith(chatFn))
      .post("/chat")
      .send({ message: "hi", history: "not-an-array" });

    expect(chatFn).toHaveBeenCalledWith([], "hi", deps);
  });

  test("returns 500 when chat() unexpectedly throws", async () => {
    const chatFn = vi.fn(async () => {
      throw new Error("boom");
    });
    const res = await request(appWith(chatFn)).post("/chat").send({ message: "hi" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });

  test("returns a JSON 400 (not HTML) for a malformed JSON body", async () => {
    const chatFn = vi.fn(async () => ({ reply: "x", history: [] as Content[] }));
    const res = await request(appWith(chatFn))
      .post("/chat")
      .set("Content-Type", "application/json")
      .send('{ "message": "oops" '); // truncated JSON

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.error).toBeDefined();
    expect(chatFn).not.toHaveBeenCalled();
  });
});

describe("static page", () => {
  test("serves the chat page at /", async () => {
    const app = createApp(deps, async () => ({ reply: "", history: [] }));
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Support Chat");
  });
});
