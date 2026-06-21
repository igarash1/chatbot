import { describe, expect, test } from "vitest";
import { getOrderStatus, type Order } from "../src/core/tools/getOrderStatus.js";

const fixture: Order[] = [
  { orderId: "1001", status: "Shipped", eta: "2026-06-25", items: ["Headphones"] },
  { orderId: "1002", status: "Processing", eta: "2026-06-28", items: ["Keyboard"] },
];

describe("getOrderStatus", () => {
  test("returns the order when the id exists", () => {
    const result = getOrderStatus("1001", fixture);
    expect(result).toEqual({
      found: true,
      status: "Shipped",
      eta: "2026-06-25",
      items: ["Headphones"],
    });
  });

  test("returns { found: false } when the id is unknown", () => {
    expect(getOrderStatus("9999", fixture)).toEqual({ found: false });
  });

  test("matches the id exactly — no partial/prefix match", () => {
    expect(getOrderStatus("100", fixture)).toEqual({ found: false });
  });

  test("trims surrounding whitespace from the id", () => {
    expect(getOrderStatus("  1002 ", fixture).found).toBe(true);
  });
});
