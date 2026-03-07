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
  /** Optional fees (commission) for this trade; subtracted from profit. */
  fees?: number | null;
  /** Optional trade date (YYYY-MM-DD) for FIFO ordering; required for correct round-trip matching. */
  tradeDate?: string;
}

export interface TradeForClosedWithDate extends TradeForClosed {
  tradeDate: string; // YYYY-MM-DD
}

export interface ClosedPosition {
  ticker: string;
  optionType: "call" | "put";
  strike: number;
  expiry: string;
  quantity: number;
  profit: number;
}

export interface ClosedPositionWithDate extends ClosedPosition {
  closedAt: string; // YYYY-MM-DD — date when position was closed
}

/** One open lot (FIFO queue entry). */
interface OpenLot {
  quantity: number;
  pricePerContract: number;
  tradeDate: string;
  fees: number; // remaining fees for this lot (reduced when partially closed)
}

/**
 * FIFO matching: for each option, match opens with closes in chronological order.
 * Emits one closed position per round trip (one open + one close).
 */
function getClosedPositionsFIFO<T extends TradeForClosed>(
  trades: T[],
  withDate: boolean
): (ClosedPosition | ClosedPositionWithDate)[] {
  const key = (t: TradeForClosed) => `${t.ticker}|${t.optionType}|${t.strike}|${t.expiry}`;
  const sorted = [...trades].sort((a, b) => {
    const kA = key(a);
    const kB = key(b);
    if (kA !== kB) return kA.localeCompare(kB);
    const dA = "tradeDate" in a ? (a.tradeDate ?? "") : "";
    const dB = "tradeDate" in b ? (b.tradeDate ?? "") : "";
    return dA.localeCompare(dB);
  });

  const positions: (ClosedPosition | ClosedPositionWithDate)[] = [];

  let i = 0;
  while (i < sorted.length) {
    const t = sorted[i];
    const k = key(t);
    const [ticker, optionType, strike, expiry] = k.split("|");
    const shortLots: OpenLot[] = [];
    const longLots: OpenLot[] = [];

    while (i < sorted.length && key(sorted[i]) === k) {
      const cur = sorted[i];
      const qty = cur.quantity;
      const price = cur.pricePerContract;
      const date = "tradeDate" in cur ? (cur.tradeDate ?? "") : "";
      const fees = cur.fees != null ? cur.fees : 0;
      const premium = qty * price * 100;

      if (cur.action === "buy") {
        let remaining = qty;
        while (remaining > 0 && shortLots.length > 0) {
          const lot = shortLots[0];
          const closeQty = Math.min(remaining, lot.quantity);
          const openPremium = lot.pricePerContract * closeQty * 100;
          const closePremium = price * closeQty * 100;
          const openFeesAlloc = lot.fees * (closeQty / lot.quantity);
          const closeFeesAlloc = fees * (closeQty / qty);
          const profit = openPremium - closePremium - openFeesAlloc - closeFeesAlloc;
          positions.push({
            ticker,
            optionType: optionType as "call" | "put",
            strike: Number(strike),
            expiry,
            quantity: closeQty,
            profit,
            ...(withDate && { closedAt: date }),
          } as ClosedPosition & Partial<ClosedPositionWithDate>);

          remaining -= closeQty;
          lot.quantity -= closeQty;
          lot.fees -= openFeesAlloc;
          if (lot.quantity <= 0) shortLots.shift();
        }
        if (remaining > 0) {
          longLots.push({ quantity: remaining, pricePerContract: price, tradeDate: date, fees: fees * (remaining / qty) });
        }
      } else {
        let remaining = qty;
        while (remaining > 0 && longLots.length > 0) {
          const lot = longLots[0];
          const closeQty = Math.min(remaining, lot.quantity);
          const openPremium = lot.pricePerContract * closeQty * 100;
          const closePremium = price * closeQty * 100;
          const openFeesAlloc = lot.fees * (closeQty / lot.quantity);
          const closeFeesAlloc = fees * (closeQty / qty);
          const profit = closePremium - openPremium - openFeesAlloc - closeFeesAlloc;
          positions.push({
            ticker,
            optionType: optionType as "call" | "put",
            strike: Number(strike),
            expiry,
            quantity: closeQty,
            profit,
            ...(withDate && { closedAt: date }),
          } as ClosedPosition & Partial<ClosedPositionWithDate>);

          remaining -= closeQty;
          lot.quantity -= closeQty;
          lot.fees -= openFeesAlloc;
          if (lot.quantity <= 0) longLots.shift();
        }
        if (remaining > 0) {
          shortLots.push({ quantity: remaining, pricePerContract: price, tradeDate: date, fees: fees * (remaining / qty) });
        }
      }
      i++;
    }
  }

  const byDate = (a: ClosedPosition | ClosedPositionWithDate, b: ClosedPosition | ClosedPositionWithDate) => {
    const aDate = "closedAt" in a ? (a.closedAt ?? "") : "";
    const bDate = "closedAt" in b ? (b.closedAt ?? "") : "";
    return (bDate as string).localeCompare(aDate as string) || a.ticker.localeCompare(b.ticker);
  };
  return positions.sort(byDate);
}

/**
 * Closed positions = one entry per round trip (FIFO). Same option sold/bought multiple times = multiple entries.
 * Profit = earnings minus fees for that round trip.
 */
export function getClosedPositions(trades: TradeForClosed[]): ClosedPosition[] {
  return getClosedPositionsFIFO(trades, false) as ClosedPosition[];
}

/**
 * Like getClosedPositions but each entry has closedAt (date of the closing trade).
 * One entry per round trip (FIFO).
 */
export function getClosedPositionsWithDates(trades: TradeForClosedWithDate[]): ClosedPositionWithDate[] {
  return getClosedPositionsFIFO(trades, true) as ClosedPositionWithDate[];
}
