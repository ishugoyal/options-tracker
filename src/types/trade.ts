export interface Trade {
  id: string;
  ticker: string;
  optionType: "call" | "put";
  strike: number;
  expiry: string;
  action: "buy" | "sell";
  quantity: number;
  pricePerContract: number;
  tradeDate: string;
  notes: string | null;
  fees?: number | null;
  source: string;
  importId: string | null;
  createdAt: string;
}

export interface TradeInput {
  ticker: string;
  optionType: "call" | "put";
  strike: number;
  expiry: string;
  action: "buy" | "sell";
  quantity: number;
  pricePerContract: number;
  tradeDate: string;
  notes?: string | null;
  fees?: number | null;
  source?: string;
  importId?: string | null;
}

export function tradeCost(t: { quantity: number; pricePerContract: number; action: string }): number {
  const cost = t.quantity * t.pricePerContract * 100;
  return t.action === "sell" ? cost : -cost;
}

export function tradeFees(t: { fees?: number | null }): number {
  return t.fees != null ? t.fees : 0;
}
