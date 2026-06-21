import { GoogleGenAI, type Content as SdkContent } from "@google/genai";
import type { Content, ModelClient, ModelTurn } from "./chatbot.js";
import { toolDeclarations } from "./tools/index.js";
import { SYSTEM_PROMPT } from "./prompt.js";

export type GeminiOptions = {
  apiKey: string;
  model: string;
  /** Low temperature suppresses invention (mitigation, not a guarantee). */
  temperature?: number;
};

/**
 * Adapt the @google/genai SDK to the loop's ModelClient seam: send the running
 * `contents` with the system prompt + tool declarations, then normalize the
 * response into a ModelTurn (text, requested function calls, raw model content).
 */
export function createGeminiClient(opts: GeminiOptions): ModelClient {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  const temperature = opts.temperature ?? 0.2;

  return {
    async generate(contents: Content[]): Promise<ModelTurn> {
      const response = await ai.models.generateContent({
        model: opts.model,
        contents: contents as unknown as SdkContent[],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature,
          tools: [{ functionDeclarations: toolDeclarations }],
        },
      });

      const functionCalls = (response.functionCalls ?? []).map((fc) => ({
        id: fc.id,
        name: fc.name ?? "",
        args: (fc.args ?? {}) as Record<string, unknown>,
      }));

      const content =
        (response.candidates?.[0]?.content as Content | undefined) ??
        ({ role: "model", parts: [] } satisfies Content);

      // On a tool turn, skip response.text: reading it while non-text parts are
      // present triggers a noisy SDK warning, and the loop ignores text here anyway.
      const text = functionCalls.length > 0 ? "" : (response.text ?? "");

      return { text, functionCalls, content };
    },
  };
}
