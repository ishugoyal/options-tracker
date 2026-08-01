import { getActionLabels } from "@/lib/action-labels";

export type TradeForRoll = {
  id: string;
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  action: string;
  quantity: number;
  pricePerContract: number;
  tradeDate: string;
  fees?: number | null;
  closesTradeId?: string | null;
  isOrphanClose?: boolean;
  notes?: string | null;
};

export type RollLinkRecord = {
  id: string;
  closeTradeId: string;
  openTradeId: string;
  quantity: number;
  createdAt: string | Date;
};

export type RollTradePreview = {
  id: string;
  ticker: string;
  optionType: "call" | "put";
  strike: number;
  expiry: string;
  action: "buy" | "sell";
  quantity: number;
  pricePerContract: number;
  tradeDate: string;
  label: string;
};

export type RollCandidate = {
  key: string;
  ticker: string;
  tradeDate: string;
  optionType: "call" | "put";
  quantity: number;
  confidence: "high" | "medium";
  reason: string;
  closeTrade: RollTradePreview;
  openTrade: RollTradePreview;
  /** @deprecated use pl.premium — kept for compatibility */
  creditDebit: number;
  pl: RollPL;
};

export type ConfirmedRoll = {
  id: string;
  ticker: string;
  tradeDate: string;
  optionType: "call" | "put";
  quantity: number;
  reason: string;
  closeTrade: RollTradePreview;
  openTrade: RollTradePreview;
  /** @deprecated use pl.premium */
  creditDebit: number;
  pl: RollPL;
  createdAt: string;
};

export type RollChain = {
  id: string;
  ticker: string;
  optionType: "call" | "put";
  steps: ConfirmedRoll[];
  quantity: number;
  startedAt: string;
  lastActivityAt: string;
  closedAt: string | null;
  isClosed: boolean;
  startExpiry: string;
  startStrike: number;
  endExpiry: string;
  endStrike: number;
  originalOpen: RollTradePreview | null;
  finalCloses: RollTradePreview[];
  /** Whole-chain cash flow: original open + roll legs + final close(s), less fees. */
  pl: RollPL;
};

export type RollPLSummary = {
  count: number;
  premium: number;
  fees: number;
  pl: number;
  credits: number;
  debits: number;
};

function optionKey(t: Pick<TradeForRoll, "ticker" | "optionType" | "strike" | "expiry">): string {
  return `${t.ticker}|${t.optionType}|${t.strike}|${t.expiry}`;
}

function asOptionType(v: string): "call" | "put" {
  return v === "put" ? "put" : "call";
}

function asAction(v: string): "buy" | "sell" {
  return v === "sell" ? "sell" : "buy";
}

function isClosingLabel(label: string): boolean {
  return label.includes("to close");
}

function isOpeningLabel(label: string): boolean {
  return label.includes("to open");
}

function tradeLabel(t: TradeForRoll, labels: Record<string, string>): string {
  if (t.isOrphanClose || t.closesTradeId) {
    return t.action === "buy" ? "Buy to close" : "Sell to close";
  }
  return labels[t.id] ?? (t.action === "buy" ? "Buy to open" : "Sell to open");
}

function toPreview(t: TradeForRoll, labels: Record<string, string>): RollTradePreview {
  return {
    id: t.id,
    ticker: t.ticker,
    optionType: asOptionType(t.optionType),
    strike: t.strike,
    expiry: t.expiry,
    action: asAction(t.action),
    quantity: t.quantity,
    pricePerContract: t.pricePerContract,
    tradeDate: t.tradeDate,
    label: tradeLabel(t, labels),
  };
}

function creditDebit(close: TradeForRoll, open: TradeForRoll, quantity: number): number {
  const closePremium = quantity * close.pricePerContract * 100 * (close.action === "sell" ? 1 : -1);
  const openPremium = quantity * open.pricePerContract * 100 * (open.action === "sell" ? 1 : -1);
  return closePremium + openPremium;
}

/** Allocate fees from a trade proportional to the roll quantity. */
function allocatedFees(trade: TradeForRoll, quantity: number): number {
  if (trade.fees == null || trade.quantity <= 0) return 0;
  return trade.fees * (quantity / trade.quantity);
}

export type RollPL = {
  /** Net premium for the roll legs (sell +, buy −) */
  premium: number;
  /** Fees allocated to this roll qty from both legs */
  fees: number;
  /** premium − fees */
  pl: number;
};

export function computeRollPL(close: TradeForRoll, open: TradeForRoll, quantity: number): RollPL {
  const premium = creditDebit(close, open, quantity);
  const fees = allocatedFees(close, quantity) + allocatedFees(open, quantity);
  return {
    premium,
    fees,
    pl: premium - fees,
  };
}

function describeRoll(close: TradeForRoll, open: TradeForRoll): string {
  const parts: string[] = [];
  if (close.expiry !== open.expiry) {
    parts.push(open.expiry > close.expiry ? "roll out" : "roll in");
  }
  if (close.strike !== open.strike) {
    parts.push(open.strike > close.strike ? "roll up" : "roll down");
  }
  if (parts.length === 0) parts.push("same strike/expiry (unusual)");
  return parts.join(" + ");
}

function candidateKey(closeId: string, openId: string): string {
  return `${closeId}|${openId}`;
}

/**
 * Detect same-day historical roll candidates:
 * close one option and open a different option of the same ticker/type.
 */
export function detectHistoricalRollCandidates(
  trades: TradeForRoll[],
  existingLinks: RollLinkRecord[] = []
): RollCandidate[] {
  const labels = getActionLabels(trades);
  const usedCloseIds = new Set(existingLinks.map((l) => l.closeTradeId));
  const usedOpenIds = new Set(existingLinks.map((l) => l.openTradeId));

  const byTickerDate = new Map<string, TradeForRoll[]>();
  for (const t of trades) {
    const k = `${t.ticker}|${t.tradeDate}`;
    const list = byTickerDate.get(k) ?? [];
    list.push(t);
    byTickerDate.set(k, list);
  }

  const candidates: RollCandidate[] = [];

  for (const [, dayTrades] of byTickerDate) {
    const closes = dayTrades.filter((t) => isClosingLabel(tradeLabel(t, labels)));
    const opens = dayTrades.filter((t) => isOpeningLabel(tradeLabel(t, labels)));

    for (const close of closes) {
      if (usedCloseIds.has(close.id)) continue;
      for (const open of opens) {
        if (usedOpenIds.has(open.id)) continue;
        if (close.id === open.id) continue;
        if (close.ticker !== open.ticker) continue;
        if (close.optionType !== open.optionType) continue;
        if (optionKey(close) === optionKey(open)) continue;

        // Classic roll: opposite actions (BTC+STO or STC+BTO)
        if (close.action === open.action) continue;

        const quantity = Math.min(close.quantity, open.quantity);
        if (quantity < 1) continue;

        const confidence: "high" | "medium" =
          close.quantity === open.quantity && (Boolean(close.closesTradeId) || close.isOrphanClose)
            ? "high"
            : "medium";

        const pl = computeRollPL(close, open, quantity);
        candidates.push({
          key: candidateKey(close.id, open.id),
          ticker: close.ticker,
          tradeDate: close.tradeDate,
          optionType: asOptionType(close.optionType),
          quantity,
          confidence,
          reason: describeRoll(close, open),
          closeTrade: toPreview(close, labels),
          openTrade: toPreview(open, labels),
          creditDebit: pl.premium,
          pl,
        });
      }
    }
  }

  return candidates.sort((a, b) => {
    const dateCmp = b.tradeDate.localeCompare(a.tradeDate);
    if (dateCmp !== 0) return dateCmp;
    if (a.confidence !== b.confidence) return a.confidence === "high" ? -1 : 1;
    return a.ticker.localeCompare(b.ticker);
  });
}

export function buildConfirmedRolls(
  trades: TradeForRoll[],
  links: RollLinkRecord[]
): ConfirmedRoll[] {
  const labels = getActionLabels(trades);
  const byId = new Map(trades.map((t) => [t.id, t]));

  const confirmed: ConfirmedRoll[] = [];
  for (const link of links) {
    const close = byId.get(link.closeTradeId);
    const open = byId.get(link.openTradeId);
    if (!close || !open) continue;
    const pl = computeRollPL(close, open, link.quantity);
    confirmed.push({
      id: link.id,
      ticker: close.ticker,
      tradeDate: close.tradeDate,
      optionType: asOptionType(close.optionType),
      quantity: link.quantity,
      reason: describeRoll(close, open),
      closeTrade: toPreview(close, labels),
      openTrade: toPreview(open, labels),
      creditDebit: pl.premium,
      pl,
      createdAt: typeof link.createdAt === "string" ? link.createdAt : link.createdAt.toISOString(),
    });
  }

  return confirmed.sort((a, b) => b.tradeDate.localeCompare(a.tradeDate) || a.ticker.localeCompare(b.ticker));
}

export function summarizeRollPL(rolls: { pl: RollPL }[]): RollPLSummary {
  let premium = 0;
  let fees = 0;
  let credits = 0;
  let debits = 0;
  for (const r of rolls) {
    premium += r.pl.premium;
    fees += r.pl.fees;
    if (r.pl.premium >= 0) credits += r.pl.premium;
    else debits += r.pl.premium;
  }
  return {
    count: rolls.length,
    premium,
    fees,
    pl: premium - fees,
    credits,
    debits,
  };
}

/**
 * Group confirmed rolls into chains when the open contract of one step
 * matches the close contract of a later step (A→B then B→C).
 */
function tradeCashFlow(trade: TradeForRoll, quantity: number): RollPL {
  const allocatedQuantity = Math.min(quantity, trade.quantity);
  const premium =
    allocatedQuantity *
    trade.pricePerContract *
    100 *
    (trade.action === "sell" ? 1 : -1);
  const fees = allocatedFees(trade, allocatedQuantity);
  return { premium, fees, pl: premium - fees };
}

function sumPL(parts: RollPL[]): RollPL {
  const premium = parts.reduce((sum, p) => sum + p.premium, 0);
  const fees = parts.reduce((sum, p) => sum + p.fees, 0);
  return { premium, fees, pl: premium - fees };
}

/**
 * Build linked roll chains and calculate whole-chain cash flow.
 * Closed-position/FIFO calculations are intentionally untouched.
 */
export function buildRollChains(
  confirmed: ConfirmedRoll[],
  trades: TradeForRoll[] = []
): RollChain[] {
  const sorted = [...confirmed].sort(
    (a, b) => a.tradeDate.localeCompare(b.tradeDate) || a.createdAt.localeCompare(b.createdAt)
  );
  const labels = getActionLabels(trades);
  const tradesById = new Map(trades.map((t) => [t.id, t]));

  const used = new Set<string>();
  const chains: RollChain[] = [];

  function openKey(r: ConfirmedRoll): string {
    return `${r.openTrade.ticker}|${r.openTrade.optionType}|${r.openTrade.strike}|${r.openTrade.expiry}`;
  }
  function closeKey(r: ConfirmedRoll): string {
    return `${r.closeTrade.ticker}|${r.closeTrade.optionType}|${r.closeTrade.strike}|${r.closeTrade.expiry}`;
  }

  for (const start of sorted) {
    if (used.has(start.id)) continue;
    const steps: ConfirmedRoll[] = [start];
    used.add(start.id);

    let guard = 0;
    while (guard++ < 20) {
      const last = steps[steps.length - 1];
      const next = sorted.find(
        (r) =>
          !used.has(r.id) &&
          r.ticker === last.ticker &&
          r.optionType === last.optionType &&
          closeKey(r) === openKey(last) &&
          r.tradeDate >= last.tradeDate
      );
      if (!next) break;
      steps.push(next);
      used.add(next.id);
    }

    const first = steps[0];
    const last = steps[steps.length - 1];
    const quantity = Math.min(...steps.map((step) => step.quantity));
    const firstClose = tradesById.get(first.closeTrade.id);
    const lastOpen = tradesById.get(last.openTrade.id);

    let originalOpen =
      firstClose?.closesTradeId != null
        ? tradesById.get(firstClose.closesTradeId) ?? null
        : null;

    // Fallback for older/manual trades without closesTradeId: infer the FIFO opening leg.
    if (!originalOpen && firstClose) {
      originalOpen =
        trades
          .filter(
            (t) =>
              t.id !== firstClose.id &&
              t.ticker === firstClose.ticker &&
              t.optionType === firstClose.optionType &&
              t.strike === firstClose.strike &&
              t.expiry === firstClose.expiry &&
              t.action !== firstClose.action &&
              t.tradeDate <= firstClose.tradeDate &&
              isOpeningLabel(tradeLabel(t, labels))
          )
          .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate) || a.id.localeCompare(b.id))[0] ??
        null;
    }

    const stepCloseIds = new Set(steps.map((step) => step.closeTrade.id));
    let terminalCloses = lastOpen
      ? trades
          .filter(
            (t) =>
              !stepCloseIds.has(t.id) &&
              t.closesTradeId === lastOpen.id &&
              t.tradeDate >= lastOpen.tradeDate
          )
          .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate) || a.id.localeCompare(b.id))
      : [];

    // Fallback for manual final closes that were not explicitly linked.
    if (terminalCloses.length === 0 && lastOpen) {
      terminalCloses = trades
        .filter(
          (t) =>
            !stepCloseIds.has(t.id) &&
            t.id !== lastOpen.id &&
            t.ticker === lastOpen.ticker &&
            t.optionType === lastOpen.optionType &&
            t.strike === lastOpen.strike &&
            t.expiry === lastOpen.expiry &&
            t.action !== lastOpen.action &&
            t.tradeDate >= lastOpen.tradeDate &&
            isClosingLabel(tradeLabel(t, labels))
        )
        .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate) || a.id.localeCompare(b.id));
    }

    const usedTerminalCloses: { trade: TradeForRoll; quantity: number }[] = [];
    let remainingToClose = quantity;
    for (const close of terminalCloses) {
      if (remainingToClose <= 0) break;
      const closeQty = Math.min(remainingToClose, close.quantity);
      usedTerminalCloses.push({ trade: close, quantity: closeQty });
      remainingToClose -= closeQty;
    }

    const isClosed = Boolean(originalOpen) && remainingToClose === 0;
    const cashFlowParts: RollPL[] = [];
    if (originalOpen) cashFlowParts.push(tradeCashFlow(originalOpen, quantity));
    for (const step of steps) {
      const close = tradesById.get(step.closeTrade.id);
      const open = tradesById.get(step.openTrade.id);
      if (close) cashFlowParts.push(tradeCashFlow(close, quantity));
      if (open) cashFlowParts.push(tradeCashFlow(open, quantity));
    }
    for (const close of usedTerminalCloses) {
      cashFlowParts.push(tradeCashFlow(close.trade, close.quantity));
    }
    const pl = sumPL(cashFlowParts);
    const finalClose = usedTerminalCloses[usedTerminalCloses.length - 1]?.trade;
    const lastActivityAt =
      finalClose?.tradeDate ?? last.tradeDate;

    chains.push({
      id: steps.map((s) => s.id).join("|"),
      ticker: first.ticker,
      optionType: first.optionType,
      steps,
      quantity,
      startedAt: originalOpen?.tradeDate ?? first.tradeDate,
      lastActivityAt,
      closedAt: isClosed ? lastActivityAt : null,
      isClosed,
      startExpiry: first.closeTrade.expiry,
      startStrike: first.closeTrade.strike,
      endExpiry: last.openTrade.expiry,
      endStrike: last.openTrade.strike,
      originalOpen: originalOpen ? toPreview(originalOpen, labels) : null,
      finalCloses: usedTerminalCloses.map(({ trade }) => toPreview(trade, labels)),
      pl,
    });
  }

  return chains.sort((a, b) => {
    const aDate = a.steps[a.steps.length - 1]?.tradeDate ?? "";
    const bDate = b.steps[b.steps.length - 1]?.tradeDate ?? "";
    return bDate.localeCompare(aDate) || a.ticker.localeCompare(b.ticker);
  });
}

export function validateRollPair(
  close: TradeForRoll,
  open: TradeForRoll,
  quantity: number,
  labels?: Record<string, string>
): string | null {
  const resolvedLabels = labels ?? getActionLabels([close, open]);
  if (quantity < 1) return "Quantity must be at least 1";
  if (quantity > close.quantity || quantity > open.quantity) {
    return "Quantity exceeds one of the selected trades";
  }
  if (close.ticker !== open.ticker) return "Roll legs must share the same ticker";
  if (close.optionType !== open.optionType) return "Roll legs must share the same option type";
  if (optionKey(close) === optionKey(open)) return "Roll legs must be different contracts";
  if (close.tradeDate !== open.tradeDate) return "Pilot only supports same-day rolls";
  if (close.action === open.action) return "Roll legs must be opposite buy/sell actions";
  if (!isClosingLabel(tradeLabel(close, resolvedLabels))) return "First leg must be a closing trade";
  if (!isOpeningLabel(tradeLabel(open, resolvedLabels))) return "Second leg must be an opening trade";
  return null;
}

export type OpenChainTip = {
  ticker: string;
  optionType: "call" | "put";
  strike: number;
  expiry: string;
  key: string;
};

/** Tip contracts of open (not finally closed) roll chains — used to label import continuations. */
export function getOpenChainTips(chains: RollChain[]): OpenChainTip[] {
  return chains
    .filter((c) => !c.isClosed)
    .map((c) => ({
      ticker: c.ticker,
      optionType: c.optionType,
      strike: c.endStrike,
      expiry: c.endExpiry,
      key: `${c.ticker}|${c.optionType}|${c.endStrike}|${c.endExpiry}`,
    }));
}

export type ImportRollRow = {
  importKey: string;
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  action: string;
  quantity: number;
  pricePerContract: number;
  tradeDate: string;
  fees?: number | null;
  openClose?: "open" | "close";
};

export type ImportRollCandidate = RollCandidate & {
  closeImportKey: string;
  openImportKey: string;
  continuesExistingChain: boolean;
};

/** Build provisional trades for roll detection; importKey is used as temporary id. */
export function tradesFromImportRows(rows: ImportRollRow[]): TradeForRoll[] {
  return rows.map((r) => ({
    id: r.importKey,
    ticker: String(r.ticker ?? "").toUpperCase(),
    optionType: r.optionType === "put" ? "put" : "call",
    strike: Number(r.strike ?? 0),
    expiry: String(r.expiry ?? ""),
    action: r.action === "sell" ? "sell" : "buy",
    quantity: Number(r.quantity ?? 0),
    pricePerContract: Number(r.pricePerContract ?? 0),
    tradeDate: String(r.tradeDate ?? ""),
    fees: r.fees ?? null,
    closesTradeId: null,
    // Prefer CSV open/close so same-day rolls label correctly before DB ids exist.
    isOrphanClose: r.openClose === "close",
    notes: null,
  }));
}

/**
 * Detect same-day roll suggestions within an import batch (both legs must be in `rows`).
 * Marks suggestions whose close contract matches an existing open-chain tip.
 */
export function detectImportRollCandidates(
  rows: ImportRollRow[],
  openTips: OpenChainTip[] = []
): ImportRollCandidate[] {
  const trades = tradesFromImportRows(rows);
  const tipKeys = new Set(openTips.map((t) => t.key));
  return detectHistoricalRollCandidates(trades, []).map((c) => ({
    ...c,
    closeImportKey: c.closeTrade.id,
    openImportKey: c.openTrade.id,
    continuesExistingChain: tipKeys.has(optionKey(c.closeTrade)),
  }));
}
