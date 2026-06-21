import type { FunctionDeclaration } from "@google/genai";
import type { ToolRegistry } from "../chatbot.js";
import { searchFaq } from "./searchFaq.js";
import { getOrderStatus } from "./getOrderStatus.js";

// Declarations handed to Gemini (what each tool is and how to call it).
export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "search_faq",
    description:
      "Search the store's FAQ for answers to general questions such as shipping, " +
      "returns, refunds, payment methods, and delivery times. Returns matching FAQ " +
      "entries, or an empty list if nothing matches.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The user's question or relevant keywords.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_order_status",
    description:
      "Look up the status of a specific order by its order number. Returns the " +
      "order's status, ETA, and items, or { found: false } if no such order exists.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "The order number, e.g. 1001.",
        },
      },
      required: ["order_id"],
    },
  },
];

// Executors invoked when the model calls a tool. Each returns facts only.
export const toolRegistry: ToolRegistry = {
  search_faq: (args) => searchFaq(String(args.query ?? "")),
  get_order_status: (args) => getOrderStatus(String(args.order_id ?? "")),
};
