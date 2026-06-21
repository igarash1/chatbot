# chatbot-example

An automated customer-support chatbot for e-commerce, built as a learning project.

It answers **FAQ questions** and **looks up order/product information** using Gemini
with Function Calling. The chat "brain" is a single, stateless, interface-agnostic core
(`chat()`), first driven by a CLI and later by a web chat UI that reuses the same core.

The bot is **read-only**: it only reads FAQ/order data and never mutates state, so it
cannot cancel orders or issue refunds. See the design docs for the reasoning.

## Quick start

```bash
npm install
cp .env.example .env   # then add your Gemini API key (https://aistudio.google.com/apikey)
npm run chat           # start the CLI chatbot
```

Try: `How much is shipping?`, `Where is order 1001?`, `Where is order 9999?`,
`Can you restock this item?` (out-of-scope → routed to support).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run chat` | Run the CLI chatbot (needs `GEMINI_API_KEY`). |
| `npm test` | Run the Vitest suite (tools + chat loop; no API key needed). |
| `npm run typecheck` | Type-check with `tsc --noEmit`. |

Set `GEMINI_MODEL` to override the default model (`gemini-2.5-flash`).

## How it works

- **`src/core/chatbot.ts`** — the stateless `chat(history, message, deps)` loop. It calls
  the model, runs any requested tool, feeds the result back, and repeats (bounded to 5
  turns). It depends only on a small injected `ModelClient` seam, so the loop is tested
  with a fake model — no API key required.
- **`src/core/tools/`** — `search_faq` and `get_order_status`. They return **facts only**
  (data or a "not found" marker); wording is the model's job. Both are read-only.
- **`src/core/gemini.ts`** — adapts the `@google/genai` SDK to the `ModelClient` seam.
- **`src/core/prompt.ts`** — the system prompt that turns "no facts" into a safe refusal.
- **`src/cli.ts`** — thin terminal shell over `chat()`. A web UI would replace just this.

Data lives in `src/data/*.json` (dummy FAQ + orders), separate from code.

## Status

Phase 1 (CLI core) implemented and tested. Web UI and guardrails are future work; see the
design docs.

## Documentation

- [ADR-0001: Read-only LLM grounding](docs/adr/0001-read-only-llm-grounding.md) — the
  core architecture decision (why answers are grounded in tools and why the bot is
  read-only).
- [Design: FAQ + Order-lookup Chatbot](docs/design/0001-faq-order-chatbot.md) — how the
  CLI core is built (interface, tools, conversation loop, testing).

## Stack

- TypeScript + Node.js (ESM, run via `tsx`)
- Gemini (`@google/genai`) with Function Calling
- Vitest for tests
