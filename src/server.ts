// Thin HTTP shell over the core chat() function. Like cli.ts, this owns no AI
// logic — it serves the chat page and turns a POST into a chat() call. The
// server is stateless: the browser holds the history and sends it each turn.

import { fileURLToPath } from "node:url";
import path from "node:path";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { chat, type ChatDeps, type ChatResult, type Content } from "./core/chatbot.js";
import { loadConfig } from "./config.js";
import { createGeminiClient } from "./core/gemini.js";
import { toolRegistry } from "./core/tools/index.js";

type ChatFn = (history: Content[], message: string, deps: ChatDeps) => Promise<ChatResult>;

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

/**
 * Build the Express app. `chatFn` is injectable so route tests can pass a stub
 * instead of the real (model-calling) chat(); production uses the default.
 */
export function createApp(deps: ChatDeps, chatFn: ChatFn = chat): Express {
  const app = express();
  app.use(express.json());
  app.use(express.static(publicDir));

  app.post("/chat", async (req: Request, res: Response) => {
    const message = typeof req.body?.message === "string" ? req.body.message : "";
    if (!message.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    const history: Content[] = Array.isArray(req.body?.history) ? req.body.history : [];

    try {
      const result = await chatFn(history, message, deps);
      res.json({ reply: result.reply, history: result.history });
    } catch (err) {
      console.error("chat handler failed:", err);
      res.status(500).json({ error: "internal error" });
    }
  });

  // Keep the API contract JSON even for errors Express raises before the handler
  // (e.g. a malformed JSON body from express.json()).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const isParseError =
      err instanceof SyntaxError ||
      (typeof err === "object" && err !== null && "type" in err &&
        (err as { type?: string }).type === "entity.parse.failed");
    if (isParseError) {
      res.status(400).json({ error: "invalid JSON body" });
      return;
    }
    console.error("unhandled error:", err);
    res.status(500).json({ error: "internal error" });
  });

  return app;
}

// --- entry point ----------------------------------------------------------

function main(): void {
  try {
    process.loadEnvFile();
  } catch {
    /* no .env file — rely on the existing environment */
  }

  const config = loadConfig();
  const deps: ChatDeps = {
    model: createGeminiClient({ apiKey: config.geminiApiKey, model: config.model }),
    tools: toolRegistry,
  };

  const port = Number(process.env.PORT) || 3000;
  createApp(deps).listen(port, () => {
    console.log(`Support bot web UI on http://localhost:${port}`);
  });
}

// Run only when executed directly (not when imported by tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
