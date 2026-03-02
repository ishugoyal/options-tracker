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
  /** If set, this trade closes the opening trade with this id */
  closesTradeId?: string | null;
  /** Closing trade with no matching open; excluded from position calculations */
  isOrphanClose?: boolean;
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

/** Normalize Prisma trade (string optionType/action) to Trade type. */
export function toTrade(
  t: {
    id: string;
    ticker: string;
    optionType: string;
    strike: number;
    expiry: string;
    action: string;
    quantity: number;
    pricePerContract: number;
    tradeDate: string;
    notes?: string | null;
    fees?: number | null;
    source: string;
    importId?: string | null;
    closesTradeId?: string | null;
    isOrphanClose?: boolean;
    createdAt: Date;
  }
): Trade {
  return {
    ...t,
    notes: t.notes ?? null,
    importId: t.importId ?? null,
    closesTradeId: t.closesTradeId ?? null,
    isOrphanClose: t.isOrphanClose ?? false,
    createdAt: t.createdAt.toISOString(),
    optionType: t.optionType === "put" ? "put" : "call",
    action: t.action === "sell" ? "sell" : "buy",
  };
}
