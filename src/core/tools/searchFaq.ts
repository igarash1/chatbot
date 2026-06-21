import faqData from "../../data/faq.json" with { type: "json" };

export type FaqEntry = { question: string; answer: string };
export type FaqResult = { matches: FaqEntry[] };

const MAX_MATCHES = 3;

/** Split a string into lowercased alphanumeric terms. */
function terms(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Look up FAQ entries by simple keyword overlap. Returns facts only — the top 3
 * entries by number of matching query terms (score descending, ties broken by
 * original order), or an empty list if nothing matches. It never produces a
 * user-facing message; phrasing the answer (or an apology) is the LLM's job.
 */
export function searchFaq(query: string, entries: FaqEntry[] = faqData): FaqResult {
  const queryTerms = terms(query);

  const scored = entries.map((entry, index) => {
    const haystack = `${entry.question} ${entry.answer}`.toLowerCase();
    const score = queryTerms.filter((t) => haystack.includes(t)).length;
    return { entry, index, score };
  });

  const matches = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_MATCHES)
    .map((s) => s.entry);

  return { matches };
}
