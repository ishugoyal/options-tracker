/**
 * For each trade, determine if it opened or closed a position.
 * Returns a map of trade id -> display label: "Buy to open", "Sell to open", "Buy to close", "Sell to close".
 */
export interface TradeForActionLabel {
  id: string;
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  action: string;
  quantity: number;
  tradeDate: string;
}

export function getActionLabels(trades: TradeForActionLabel[]): Record<string, string> {
  const key = (t: TradeForActionLabel) => `${t.ticker}|${t.optionType}|${t.strike}|${t.expiry}`;
  const byKey = new Map<string, TradeForActionLabel[]>();

  for (const t of trades) {
    const k = key(t);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(t);
  }

  const labels: Record<string, string> = {};

  for (const [, group] of byKey) {
    group.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate) || a.id.localeCompare(b.id));
    let runningNet = 0;
    for (const t of group) {
      const q = t.action === "buy" ? t.quantity : -t.quantity;
      if (t.action === "sell") {
        labels[t.id] = runningNet > 0 ? "Sell to close" : "Sell to open";
      } else {
        labels[t.id] = runningNet < 0 ? "Buy to close" : "Buy to open";
      }
      runningNet += q;
    }
  }

  return labels;
}
