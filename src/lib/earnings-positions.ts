import type { ClosedPositionWithDate } from "@/lib/open-positions";
import type { RollChain, RollTradePreview } from "@/lib/rolls";

/** How Earnings aggregates realized P/L over time. */
export type EarningsTimingMode = "cash" | "chain";

function matchesClose(
  position: ClosedPositionWithDate,
  close: Pick<RollTradePreview, "ticker" | "optionType" | "strike" | "expiry" | "tradeDate" | "quantity">
): boolean {
  return (
    position.ticker === close.ticker &&
    position.optionType === close.optionType &&
    position.strike === close.strike &&
    position.expiry === close.expiry &&
    position.closedAt === close.tradeDate &&
    position.quantity === close.quantity
  );
}

/**
 * Build the closed-position set used for Earnings totals / by-period / by-ticker.
 *
 * - cash: FIFO closed positions as-is (P/L on each close date).
 * - chain: confirmed roll-chain legs are suppressed; closed chains contribute one
 *   P/L event on the final close date (sum of those legs' FIFO P/Ls). Open-chain
 *   intermediate closes contribute $0 until the chain finishes. Linking/unlinking
 *   changes results because this is derived from current chains.
 *
 * The Closed positions list should keep using raw FIFO positions separately.
 */
export function buildEarningsPositions(
  fifoPositions: ClosedPositionWithDate[],
  rollChains: RollChain[],
  mode: EarningsTimingMode
): ClosedPositionWithDate[] {
  if (mode === "cash") return fifoPositions;

  const remaining = fifoPositions.map((p, index) => ({ p, index, used: false }));

  function takeForClose(close: RollTradePreview): ClosedPositionWithDate | null {
    const hit = remaining.find((row) => !row.used && matchesClose(row.p, close));
    if (!hit) return null;
    hit.used = true;
    return hit.p;
  }

  const synthetic: ClosedPositionWithDate[] = [];

  for (const chain of rollChains) {
    const legPositions: ClosedPositionWithDate[] = [];

    for (const step of chain.steps) {
      const pos = takeForClose(step.closeTrade);
      if (pos) legPositions.push(pos);
    }

    if (chain.isClosed && chain.closedAt) {
      for (const finalClose of chain.finalCloses) {
        const pos = takeForClose(finalClose);
        if (pos) legPositions.push(pos);
      }

      const profit = legPositions.reduce((sum, p) => sum + p.profit, 0);
      synthetic.push({
        ticker: chain.ticker,
        optionType: chain.optionType,
        strike: chain.endStrike,
        expiry: chain.endExpiry,
        quantity: chain.quantity,
        profit,
        closedAt: chain.closedAt,
        openedAt: chain.startedAt,
      });
    }
    // Open chain: intermediate legs already marked used → excluded from earnings.
  }

  const kept = remaining.filter((row) => !row.used).map((row) => row.p);
  return [...kept, ...synthetic].sort(
    (a, b) => (b.closedAt || "").localeCompare(a.closedAt || "") || a.ticker.localeCompare(b.ticker)
  );
}
