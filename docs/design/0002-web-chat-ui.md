---
status: draft
issue: "n/a — fresh repo, no issue tracker yet"
date: 2026-06-22
deciders: igarashi.kouki
touch_paths:
  - src/server.ts
  - public/
---

# Web Chat UI: Design Doc

> "Why" is in the issue; the cross-cutting decision is [ADR-0001](../adr/0001-read-only-llm-grounding.md).
> This is "how to build it". Phase 2 of [the chatbot](0001-faq-order-chatbot.md).

## Overview

Add a browser chat UI on top of the existing stateless `chat()` core: an Express server
exposing `POST /chat` and serving a small vanilla-JS centered chat page. The page holds
conversation history client-side and sends it with each request. Nothing in `src/core`
changes — this validates the interface-agnostic seam from Phase 1.

## Background

Phase 1 built a CLI over `chat(history, message, deps)`. The original goal was a web chat
UI like those on e-commerce sites. Phase 2 wraps the same core in HTTP + a browser, with
no changes to the core or its tools.

## Goals / Non-goals

- Goal: A working browser chat backed by the same `chat()` used by the CLI.
- Goal: Keep the server stateless — the client owns and round-trips the history.
- Goal: `src/core` is unchanged; reuse the same `{ model, tools }` deps as the CLI.
- Non-goal: Streaming responses (request/response only this phase).
- Non-goal: The EC-site popup-widget styling (centered chat now; widget is a later skin).
- Non-goal: Server-side sessions, auth, persistence, multi-user (read-only learning demo —
  authorization is explicitly out of scope per the Phase 1 design).
- Non-goal: A frontend framework or build step (plain HTML/CSS/JS).

## Design (interface and data)

### Request flow

```mermaid
flowchart TD
  B[Browser chat.js<br/>holds history] -->|POST /chat {message, history}| S[Express createApp]
  S -->|chat history, message, deps| C[core/chatbot.ts unchanged]
  C -->|{reply, history}| S
  S -->|200 {reply, history}| B
  B -->|render reply, store new history| B
```

### HTTP API — `POST /chat`

```jsonc
// Request body
{ "message": "where is order 1001?", "history": [ /* Content[] from prior response, or [] */ ] }

// 200 OK
{ "reply": "Order 1001 is Shipped...", "history": [ /* updated Content[] to send next turn */ ] }

// 400 Bad Request — message missing/blank
{ "error": "message is required" }

// 500 Internal Server Error — unexpected server failure
{ "error": "internal error" }
```

- `history` is **opaque** to the client: it stores what the server returned and sends it
  back unchanged next turn. The shape is `Content[]` from the core.
- A non-array `history` is coerced to `[]`. A missing/blank `message` is a 400 (the server
  does not call `chat()`).
- Because `chat()` never throws and returns its own fallback `reply`, model/tool failures
  surface as a normal **200 with a polite fallback**. The 500 path is only for unexpected
  server-side errors (e.g. dependency init), wrapped in a `try/catch`.

### Server — `src/server.ts`

```typescript
import express, { type Express } from "express";
import { chat, type ChatDeps, type ChatResult, type Content } from "./core/chatbot.js";

type ChatFn = (history: Content[], message: string, deps: ChatDeps) => Promise<ChatResult>;

// Factory so tests can inject fake deps and a stub chat (same DI seam as the core/CLI).
export function createApp(deps: ChatDeps, chatFn?: ChatFn): Express; // chatFn defaults to chat

// Entry point (not exported): loadConfig() -> build real Gemini deps ->
// createApp(deps) -> serve ./public statically -> listen on PORT (default 3000).
```

`createApp(deps)`:

- `express.json()` for body parsing; `express.static("public")` for the page.
- `POST /chat`: validate `message`; coerce `history`; `await chat(history, message, deps)`;
  return `{ reply, history }`. Wrap in `try/catch` → 500.

The real Gemini deps are built exactly as in `cli.ts` (`createGeminiClient` + `toolRegistry`),
keeping a single source of truth for wiring.

### Frontend — `public/index.html` + `public/chat.js`

- `index.html`: a centered card — title, scrollable message list, text input + send button,
  with minimal inline CSS.
- `chat.js` (vanilla, no build): keeps `let history = []`; on submit renders the user
  bubble, disables input, shows a "…" typing indicator, `POST /chat`, then renders the bot
  `reply` and replaces `history` with the response's. On `fetch` failure, shows an inline
  error bubble and re-enables input (history preserved).

### Module layout (added)

```text
src/
  server.ts          // createApp(deps) + entry point
public/
  index.html         // centered chat markup + CSS
  chat.js            // history state, fetch, render
```

### New dependencies / scripts

- Runtime: `express`. Dev: `supertest`, `@types/express`, `@types/supertest`.
- Script: `npm run serve` → `tsx src/server.ts`. `PORT` env overrides the default 3000.

## Behavioral invariants

- `src/core/**` is unchanged by this phase (the seam holds).
- Server is stateless: no per-user/session state is stored; history lives in the client and
  is passed through `chat()` each request.
- Secrets only via env (`GEMINI_API_KEY`); never sent to or stored by the browser.
- No state-mutating capability is added; the bot stays read-only (ADR-0001).
- `POST /chat` always responds with JSON: `{reply, history}` on success, `{error}` on 4xx/5xx.
- A blank/missing `message` never reaches `chat()` (400 first).
- `createApp` takes injected deps so it is testable without a real model/API key.

## Testing approach

- **Route tests via `supertest` with an injected fake `chat` (no real Gemini):**
  - valid body → 200 with `reply` + `history` echoed from the fake.
  - missing `message` → 400 `{ error }`, and `chat` is **not** called.
  - blank/whitespace `message` → 400.
  - non-array `history` → coerced to `[]` and passed to `chat`.
  - the handler passes the request's `history` + `message` through to `chat` and returns
    its `{reply, history}` verbatim.
- Inject the fake by having `createApp(deps)` call an injectable `chat`. Simplest seam:
  `createApp(deps, chatFn = chat)` — tests pass a stub `chatFn`; production uses the default.
- **Manual (real Gemini):** `npm run serve`, open the page, run FAQ hit, order found, order
  missing, and out-of-scope (expect support routing) — same scenarios as the CLI.
- Frontend `chat.js` is verified manually (thin DOM glue; no test harness — YAGNI).
- Tooling: Vitest + supertest. Existing 21 core tests must stay green.

## Acceptance criteria

- [ ] `createApp(deps, fakeChat)` serves `POST /chat`; valid body → 200 `{reply, history}`.
- [ ] Missing/blank `message` → 400 and `chat` is not invoked.
- [ ] Non-array `history` is coerced to `[]` before reaching `chat`.
- [ ] The route returns `chat`'s `{reply, history}` unchanged.
- [ ] `src/core/**` has no diff in this PR.
- [ ] `express.static` serves `public/index.html`; `npm run serve` starts a listener.
- [ ] New route tests + the existing 21 tests pass under Vitest; `tsc --noEmit` clean.
- [ ] README documents `npm run serve` and the manual scenarios.

## Risks and rollout

- Risk: Client-held history is lost on refresh and is tamper-able. Accepted — read-only
  demo, no trust placed in history contents (ADR-0001 keeps the blast radius to wrong text).
- Risk: `@types/express` / Express v5 API differences. Verify versions at install time; the
  route surface used here (`express.json`, `static`, `post`) is stable across v4/v5.
- Rollout: additive only — new files + deps, no core changes. The CLI keeps working. A later
  phase can re-skin the page as the EC-site popup widget, or add streaming.

## References

- Phase 1 design: [0001-faq-order-chatbot.md](0001-faq-order-chatbot.md)
- Related ADR: [ADR-0001](../adr/0001-read-only-llm-grounding.md)
