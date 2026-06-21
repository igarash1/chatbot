# chatbot-example

An automated customer-support chatbot for e-commerce, built as a learning project.

It answers **FAQ questions** and **looks up order/product information** using Gemini
with Function Calling. The chat "brain" is a single, stateless, interface-agnostic core
(`chat()`), first driven by a CLI and later by a web chat UI that reuses the same core.

The bot is **read-only**: it only reads FAQ/order data and never mutates state, so it
cannot cancel orders or issue refunds. See the design docs for the reasoning.

## Status

Design phase. No implementation yet — see the design docs below.

## Documentation

- [ADR-0001: Read-only LLM grounding](docs/adr/0001-read-only-llm-grounding.md) — the
  core architecture decision (why answers are grounded in tools and why the bot is
  read-only).
- [Design: FAQ + Order-lookup Chatbot](docs/design/0001-faq-order-chatbot.md) — how the
  CLI core is built (interface, tools, conversation loop, testing).

## Planned stack

- TypeScript + Node.js
- Gemini (`@google/genai`) with Function Calling
- Vitest for tests
