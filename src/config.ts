export type Config = {
  geminiApiKey: string;
  /** Gemini model id; override with GEMINI_MODEL. */
  model: string;
};

type Env = Record<string, string | undefined>;

const DEFAULT_MODEL = "gemini-2.5-flash";

/** Read configuration from the environment, failing fast if the key is absent. */
export function loadConfig(env: Env = process.env): Config {
  const geminiApiKey = env.GEMINI_API_KEY?.trim();
  if (!geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Copy .env.example to .env and add your key " +
        "(get one at https://aistudio.google.com/apikey).",
    );
  }
  return { geminiApiKey, model: env.GEMINI_MODEL?.trim() || DEFAULT_MODEL };
}
