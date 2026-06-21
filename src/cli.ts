// Thin CLI shell over the core chat() function. The "brain" lives in src/core;
// this file only handles terminal I/O and owns the conversation history. A web
// server could replace this file without touching the core.

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { loadConfig } from "./config.js";
import { chat, type ChatDeps, type Content } from "./core/chatbot.js";
import { createGeminiClient } from "./core/gemini.js";
import { toolRegistry } from "./core/tools/index.js";

// Load a local .env if present (Node >= 20.12); otherwise use the real env.
try {
  process.loadEnvFile();
} catch {
  /* no .env file — rely on the existing environment */
}

async function main(): Promise<void> {
  const config = loadConfig();
  const deps: ChatDeps = {
    model: createGeminiClient({ apiKey: config.geminiApiKey, model: config.model }),
    tools: toolRegistry,
  };

  const rl = createInterface({ input: stdin, output: stdout });
  let history: Content[] = [];

  console.log("Support bot ready. Ask about orders or FAQs. Type 'exit' to quit.\n");

  try {
    while (true) {
      const input = (await rl.question("You: ")).trim();
      if (!input) continue;
      if (input === "exit" || input === "quit") break;

      const result = await chat(history, input, deps);
      history = result.history;
      console.log(`Bot: ${result.reply}\n`);
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
