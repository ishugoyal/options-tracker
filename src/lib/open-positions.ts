/**
 * Open short position = we've sold more than we've bought for the same option.
 * Key is (ticker, optionType, strike, expiry). Net = buys - sells; if net < 0, we're short |net|.
 */
export interface OpenShortPosition {
  ticker: string;
  optionType: "call" | "put";
  strike: number;
  expiry: string;
  quantityToClose: number;
}

/**
 * Open position = short (sold more than bought) or long (bought more than sold).
 * quantityToClose = contracts to buy back (short) or sell (long) to close.
 */
export interface OpenPosition {
  ticker: string;
  optionType: "call" | "put";
  strike: number;
  expiry: string;
  side: "short" | "long";
  quantityToClose: number;
}

export interface TradeForPosition {
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  action: string;
  quantity: number;
}

export function getOpenShortPositions(trades: TradeForPosition[]): OpenShortPosition[] {
  return getOpenPositions(trades).filter((p) => p.side === "short").map(({ side: _s, ...p }) => ({ ...p }));
}

/**
 * Returns all open positions: shorts (net < 0) and longs (net > 0).
 */
export function getOpenPositions(trades: TradeForPosition[]): OpenPosition[] {
  const key = (t: TradeForPosition) => `${t.ticker}|${t.optionType}|${t.strike}|${t.expiry}`;
  const net = new Map<string, number>();

  for (const t of trades) {
    const k = key(t);
    const q = t.action === "buy" ? t.quantity : -t.quantity;
    net.set(k, (net.get(k) ?? 0) + q);
  }

  const positions: OpenPosition[] = [];
  for (const [k, n] of net) {
    if (n === 0) continue;
    const [ticker, optionType, strike, expiry] = k.split("|");
    positions.push({
      ticker,
      optionType: optionType as "call" | "put",
      strike: Number(strike),
      expiry,
      side: n < 0 ? "short" : "long",
      quantityToClose: Math.abs(n),
    });
  }

  return positions.sort((a, b) => a.ticker.localeCompare(b.ticker) || a.expiry.localeCompare(b.expiry));
}

/** Trade with price for P&L. */
export interface TradeForClosed {
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  action: string;
  quantity: number;
  pricePerContract: number;
}

export interface ClosedPosition {
  ticker: string;
  optionType: "call" | "put";
  strike: number;
  expiry: string;
  quantity: number;
  profit: number;
}

/**
 * Closed position = same option (ticker, type, strike, expiry) with net quantity 0.
 * Profit = premium received from sells - premium paid for buys.
 */
export function getClosedPositions(trades: TradeForClosed[]): ClosedPosition[] {
  const key = (t: TradeForClosed) => `${t.ticker}|${t.optionType}|${t.strike}|${t.expiry}`;
  const netQty = new Map<string, number>();
  const profit = new Map<string, number>();

  for (const t of trades) {
    const k = key(t);
    const q = t.action === "buy" ? t.quantity : -t.quantity;
    netQty.set(k, (netQty.get(k) ?? 0) + q);
    const premium = t.quantity * t.pricePerContract * 100;
    const pnl = t.action === "sell" ? premium : -premium;
    profit.set(k, (profit.get(k) ?? 0) + pnl);
  }

  const positions: ClosedPosition[] = [];
  const totalSells = new Map<string, number>();

  for (const t of trades) {
    const k = key(t);
    if (netQty.get(k) !== 0) continue;
    if (t.action === "sell") totalSells.set(k, (totalSells.get(k) ?? 0) + t.quantity);
  }

  for (const [k, n] of netQty) {
    if (n !== 0) continue;
    const p = profit.get(k) ?? 0;
    const [ticker, optionType, strike, expiry] = k.split("|");
    positions.push({
      ticker,
      optionType: optionType as "call" | "put",
      strike: Number(strike),
      expiry,
      quantity: totalSells.get(k) ?? 0,
      profit: p,
    });
  }

  return positions.sort((a, b) => a.ticker.localeCompare(b.ticker) || a.expiry.localeCompare(b.expiry));
}
