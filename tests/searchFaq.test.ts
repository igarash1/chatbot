import { describe, expect, test } from "vitest";
import { searchFaq, type FaqEntry } from "../src/core/tools/searchFaq.js";

const fixture: FaqEntry[] = [
  { question: "How much is shipping?", answer: "Shipping is $5 flat." },
  { question: "What is your return policy?", answer: "Return within 30 days." },
  { question: "How do I return an item?", answer: "Start a return from Orders." },
  { question: "What payment methods?", answer: "We accept Visa and Mastercard." },
];

describe("searchFaq", () => {
  test("returns the entry matching a keyword", () => {
    const { matches } = searchFaq("shipping", fixture);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.question).toBe("How much is shipping?");
  });

  test("returns empty matches when nothing is relevant", () => {
    expect(searchFaq("xyzzy", fixture).matches).toEqual([]);
  });

  test("ranks by number of matching query terms, descending", () => {
    // "return policy" hits entry 1 (both terms) and entry 2 (return only).
    const { matches } = searchFaq("return policy", fixture);
    expect(matches[0]?.question).toBe("What is your return policy?");
    expect(matches[1]?.question).toBe("How do I return an item?");
  });

  test("caps results at the top 3", () => {
    // "return shipping payment" matches 4 entries; only 3 come back.
    const { matches } = searchFaq("return shipping payment", fixture);
    expect(matches).toHaveLength(3);
  });

  test("breaks score ties by original order", () => {
    // Both return entries match "return" once; entry 1 precedes entry 2.
    const { matches } = searchFaq("return", fixture);
    expect(matches.map((m) => m.question)).toEqual([
      "What is your return policy?",
      "How do I return an item?",
    ]);
  });

  test("returns facts only — no apology or routing text injected", () => {
    const { matches } = searchFaq("nonexistent topic", fixture);
    // The tool never fabricates a user-facing message; that is the LLM's job.
    expect(matches).toEqual([]);
  });
});
