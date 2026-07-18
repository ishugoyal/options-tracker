import type { Trade } from "@prisma/client";

export type OrphanCloseForCandidates = Pick<
  Trade,
  "id" | "ticker" | "optionType" | "strike" | "expiry" | "action" | "quantity" | "tradeDate"
>;

export type OpenTradeCandidate = Pick<
  Trade,
  "id" | "ticker" | "optionType" | "strike" | "expiry" | "action" | "quantity" | "pricePerContract" | "tradeDate" | "source" | "notes"
> & {
  /** Contracts on this open not yet linked to a close */
  remainingQuantity: number;
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function strikesMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

/** Sum of close quantities already linked to each opening trade id. */
export function closedQuantityByOpenId(allTrades: Trade[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of allTrades) {
    if (t.closesTradeId == null) continue;
    counts.set(t.closesTradeId, (counts.get(t.closesTradeId) ?? 0) + t.quantity);
  }
  return counts;
}

function remainingOpenQuantity(trade: Trade, closedByOpenId: Map<string, number>): number {
  const closed = closedByOpenId.get(trade.id) ?? 0;
  return Math.max(0, trade.quantity - closed);
}

/**
 * Opening trades that can be linked to an orphan close (same option, opposite action, remaining qty).
 */
export function getOrphanOpenCandidates(
  orphan: OrphanCloseForCandidates,
  allTrades: Trade[]
): OpenTradeCandidate[] {
  const oppositeAction = orphan.action === "buy" ? "sell" : "buy";
  const closedByOpenId = closedQuantityByOpenId(allTrades);
  const orphanTicker = normalizeTicker(orphan.ticker);

  return allTrades
    .filter((t) => {
      if (t.id === orphan.id) return false;
      if (t.isOrphanClose) return false;
      if (t.closesTradeId != null) return false;
      if (normalizeTicker(t.ticker) !== orphanTicker) return false;
      if (t.optionType !== orphan.optionType) return false;
      if (!strikesMatch(t.strike, orphan.strike)) return false;
      if (t.expiry !== orphan.expiry) return false;
      if (t.action !== oppositeAction) return false;
      if (t.tradeDate > orphan.tradeDate) return false;
      if (remainingOpenQuantity(t, closedByOpenId) < 1) return false;
      return true;
    })
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate) || a.id.localeCompare(b.id))
    .map((t) => ({
      id: t.id,
      ticker: t.ticker,
      optionType: t.optionType,
      strike: t.strike,
      expiry: t.expiry,
      action: t.action,
      quantity: t.quantity,
      pricePerContract: t.pricePerContract,
      tradeDate: t.tradeDate,
      source: t.source,
      notes: t.notes,
      remainingQuantity: remainingOpenQuantity(t, closedByOpenId),
    }));
}

export function maxLinkQuantity(
  orphanQuantity: number,
  openTrade: Trade,
  closedByOpenId: Map<string, number>
): number {
  return Math.min(orphanQuantity, remainingOpenQuantity(openTrade, closedByOpenId));
}

export function isValidOrphanOpenLink(
  orphan: OrphanCloseForCandidates,
  openTrade: Trade,
  closedByOpenId: Map<string, number>,
  linkQuantity: number
): boolean {
  const oppositeAction = orphan.action === "buy" ? "sell" : "buy";
  const qty = Math.floor(linkQuantity);
  return (
    qty >= 1 &&
    qty <= orphan.quantity &&
    !openTrade.isOrphanClose &&
    openTrade.closesTradeId == null &&
    normalizeTicker(openTrade.ticker) === normalizeTicker(orphan.ticker) &&
    openTrade.optionType === orphan.optionType &&
    strikesMatch(openTrade.strike, orphan.strike) &&
    openTrade.expiry === orphan.expiry &&
    openTrade.action === oppositeAction &&
    openTrade.tradeDate <= orphan.tradeDate &&
    remainingOpenQuantity(openTrade, closedByOpenId) >= qty
  );
}

/** Split fees proportionally when peeling qty off an orphan close. */
export function splitOrphanFees(
  totalFees: number | null | undefined,
  linkQuantity: number,
  orphanQuantity: number
): { linkedFees: number | null; remainingFees: number | null } {
  if (totalFees == null || orphanQuantity <= 0) {
    return { linkedFees: null, remainingFees: totalFees ?? null };
  }
  const linkedFees = Math.round((totalFees * linkQuantity) / orphanQuantity * 100) / 100;
  const remainingFees = Math.round((totalFees - linkedFees) * 100) / 100;
  return { linkedFees, remainingFees };
}
