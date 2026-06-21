---
status: accepted
date: 2026-06-22
deciders: igarashi.kouki
---

# ADR-0001: Read-only LLM grounding via Function Calling

## Context

We are building an automated customer-support chatbot (the kind seen on e-commerce
sites) that answers FAQ questions and looks up order/product information. The core
question is how to keep an inherently probabilistic LLM from producing fabricated
("hallucinated") answers about real business data such as order status.

Key constraint: an LLM offers **no deterministic guarantee** about its output. Prompt
rules, low `temperature`, and well-shaped tools only *reduce the probability* of bad
output; they do not eliminate it.

## Decision

1. **Ground every factual answer in tool results.** The model never answers about
   orders or FAQ content from its own memory. It must call a tool
   (`search_faq`, `get_order_status`), and answer only from what the tool returns.

2. **Tools return facts only.** A tool returns raw data or a "not found" marker
   (`{ found: false }` / `{ matches: [] }`). Tools never apologize, never route to
   support, never phrase a user-facing message. Wording is the LLM's job, governed by
   the system prompt.

3. **The bot is strictly read-only.** We expose only read tools. There is no tool that
   cancels an order, issues a refund, or mutates any state. This makes catastrophic
   *write* failure *structurally impossible* (deterministic guarantee), independent of how
   the LLM behaves. The worst write-side case is a wrong sentence, never a wrong side
   effect.

   Scope note: read-only bounds *write* damage, not *read* damage. An unauthenticated
   lookup (e.g. `getOrderStatus` over guessable IDs) could still expose another user's
   data. That is a separate authorization concern, out of scope for this ADR and handled
   as a non-goal/risk in the design doc; it must be addressed before any real deployment.

4. **Guardrails are deferred but not designed out.** Input moderation (banned words,
   length, injection checks) and output verification (e.g. cross-checking order numbers
   in the reply against tool results) are real deterministic guards. We do not build
   them now, but the architecture must allow adding them later without touching the core.

## Consequences

- **Positive:** No financial/data damage is possible while the bot stays read-only.
  Changing user-facing wording is a single-place edit (the system prompt). Adding a new
  capability is adding a new tool.
- **Positive:** The design is provider-independent — the same tool-grounding pattern
  works with Gemini, and could be ported to another LLM.
- **Negative:** Wrong-text risk remains and cannot be reduced to zero. We accept this
  for read-only scope and rely on layered mitigation (tools + prompt + low temperature)
  plus manual checks.
- **Future:** Moving to "take action" features (level 3: cancellations, returns) removes
  the read-only guarantee. That step requires a new ADR and real guardrails before any
  write-capable tool is added.

## References

- Related design: docs/design/0001-faq-order-chatbot.md
