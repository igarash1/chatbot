import orderData from "../../data/orders.json" with { type: "json" };

export type Order = {
  orderId: string;
  status: string;
  eta: string;
  items: string[];
};

export type OrderResult =
  | { found: true; status: string; eta: string; items: string[] }
  | { found: false };

/**
 * Look up an order by exact id. Returns facts only: the order fields when found,
 * or { found: false } when not. No user-facing wording, no apology, no routing —
 * the LLM phrases the reply based on this raw result.
 *
 * Note: this is an unauthenticated exact-id lookup over demo data; order ids are
 * guessable. A real deployment must authenticate and authorize access (see
 * docs/design/0001-faq-order-chatbot.md and ADR-0001).
 */
export function getOrderStatus(orderId: string, orders: Order[] = orderData): OrderResult {
  const id = orderId.trim();
  const order = orders.find((o) => o.orderId === id);
  if (!order) return { found: false };
  return { found: true, status: order.status, eta: order.eta, items: order.items };
}
