import { describe, expect, test } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  test("reads the API key from env", () => {
    expect(loadConfig({ GEMINI_API_KEY: "abc" }).geminiApiKey).toBe("abc");
  });

  test("defaults the model when unset", () => {
    expect(loadConfig({ GEMINI_API_KEY: "abc" }).model).toBe("gemini-2.5-flash");
  });

  test("honors a GEMINI_MODEL override", () => {
    const c = loadConfig({ GEMINI_API_KEY: "abc", GEMINI_MODEL: "gemini-2.0-flash" });
    expect(c.model).toBe("gemini-2.0-flash");
  });

  test("throws a helpful error when the key is missing", () => {
    expect(() => loadConfig({})).toThrow(/GEMINI_API_KEY/);
  });

  test("treats a blank key as missing", () => {
    expect(() => loadConfig({ GEMINI_API_KEY: "   " })).toThrow(/GEMINI_API_KEY/);
  });
});
