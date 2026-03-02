import { format, parse as parseDate } from "date-fns";
import type { NormalizedRow } from "./csv-import";

/**
 * Fidelity CSV columns (from sample):
 * Run Date, Action, Symbol, Description, Type, Exchange Quantity, Exchange Currency, Currency,
 * Price, Quantity, Exchange Rate, Commission, Fees, Accrued Interest, Amount, Cash Balance, Settlement Date
 *
 * Symbol format: -MSFT260327P365 = optional minus, ticker, YYMMDD, C|P, strike
 * Action: "YOU BOUGHT ..." / "YOU SOLD ..." (or "CLOSING TRANSACTION" etc.)
 */

function parseNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  const s = String(val).replace(/[$,\s]/g, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

/** Parse Fidelity date MM/DD/YYYY to YYYY-MM-DD */
function toISODate(s: string): string {
  const trimmed = String(s ?? "").trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  try {
    const d = parseDate(trimmed, "MM/dd/yyyy", new Date());
    return format(d, "yyyy-MM-dd");
  } catch {
    return trimmed;
  }
}

/** Parse Symbol e.g. -MSFT260327P365 or MSFT260327C400 → { ticker, expiry, optionType, strike } */
function parseFidelitySymbol(symbol: string): { ticker: string; expiry: string; optionType: "call" | "put"; strike: number } | null {
  const s = String(symbol ?? "").replace(/^\s*-/, "").trim(); // drop leading minus
  // Ticker (2-6 chars) + YYMMDD + C|P + strike (integer or decimal)
  const m = s.match(/^([A-Z]{2,6})(\d{6})([CP])(\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const [, ticker, yymmdd, cp, strikeStr] = m;
  const yy = yymmdd.slice(0, 2);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const year = parseInt(yy, 10) >= 70 ? `19${yy}` : `20${yy}`; // 70-99 = 1970-1999, 00-69 = 2000-2069
  const expiry = `${year}-${mm}-${dd}`;
  const optionType = cp.toUpperCase() === "P" ? "put" : "call";
  const strike = parseNumber(strikeStr);
  return { ticker: ticker.toUpperCase(), expiry, optionType: optionType as "call" | "put", strike };
}

/** Parse Action for buy vs sell */
function parseFidelityAction(action: string): "buy" | "sell" {
  const s = String(action ?? "").toUpperCase();
  if (s.includes("SOLD") || s.includes("SELL")) return "sell";
  return "buy";
}

/** Parse Action for opening vs closing transaction */
function parseFidelityOpenClose(action: string): "open" | "close" | null {
  const s = String(action ?? "").toUpperCase();
  if (s.includes("CLOSING")) return "close";
  if (s.includes("OPENING")) return "open";
  return null;
}

/** Get value from row by header (case-insensitive, trim header match) */
function get(row: Record<string, string>, header: string): string {
  const key = Object.keys(row).find((k) => k.trim().toLowerCase() === header.trim().toLowerCase());
  const val = key != null ? row[key] : undefined;
  return val != null ? String(val).trim() : "";
}

/**
 * Parse one Fidelity CSV row into a normalized trade, or null if not an option trade.
 */
export function parseFidelityRow(row: Record<string, string>): NormalizedRow | null {
  const symbol = get(row, "Symbol");
  const description = get(row, "Description");
  const actionStr = get(row, "Action");

  // Option rows: Symbol like MSFT260327P365 or Description contains PUT/CALL
  const fromSymbol = parseFidelitySymbol(symbol);
  const isOption =
    fromSymbol !== null ||
    /(?:^|\s)(PUT|CALL)\s*\(/i.test(description) ||
    /\b(PUT|CALL)\b/i.test(description);

  if (!isOption) return null;

  const ticker = fromSymbol?.ticker ?? "";
  const optionType =
    fromSymbol?.optionType ?? (/(?:^|\s)PUT\s*\(/i.test(description) || /\bPUT\b/i.test(description) ? "put" : "call");
  const strike = fromSymbol?.strike ?? 0;
  const expiry = fromSymbol?.expiry ?? "";

  // If we didn't get ticker/expiry/strike from Symbol, try Description e.g. "PUT (MSFT) ... MAR 27 26 $365"
  let finalTicker = ticker;
  let finalExpiry = expiry;
  let finalStrike = strike;

  if (!finalTicker) {
    const tickerMatch =
      description.match(/PUT\s*\(([A-Z]+)\)/i) ?? description.match(/CALL\s*\(([A-Z]+)\)/i) ?? description.match(/\(([A-Z]{2,6})\)/);
    if (tickerMatch) finalTicker = tickerMatch[1].toUpperCase();
  }
  if (!finalExpiry && description) {
    const monthMatch = description.match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})\s+(\d{2,4})\b/i);
    if (monthMatch) {
      const [, mon, day, year] = monthMatch;
      const yr =
        year.length === 2
          ? (parseInt(year, 10) >= 70 ? `19${year}` : `20${year}`)
          : year;
      try {
        const fmt = year.length === 2 ? "MMM d yy" : "MMM d yyyy";
        const d = parseDate(`${mon} ${day} ${yr}`, fmt, new Date());
        finalExpiry = format(d, "yyyy-MM-dd");
      } catch {
        finalExpiry = "";
      }
    }
  }
  if (finalStrike === 0 && description) {
    const strikeMatch = description.match(/\$(\d+(?:\.\d+)?)/);
    if (strikeMatch) finalStrike = parseNumber(strikeMatch[1]);
  }

  const runDate = get(row, "Run Date");
  const tradeDate = toISODate(runDate || get(row, "Settlement Date"));
  const price = parseNumber(get(row, "Price"));
  const rawQty = parseNumber(get(row, "Quantity"));
  const quantity = Math.max(0, Math.floor(Math.abs(rawQty))) || 1;
  const action = parseFidelityAction(actionStr);
  const commission = parseNumber(get(row, "Commission"));
  const feesCol = parseNumber(get(row, "Fees"));
  const fees = commission + feesCol;

  if (!finalTicker || !tradeDate) return null;

  const openClose = parseFidelityOpenClose(actionStr);
  const notesParts: string[] = [];
  if (openClose) notesParts.push(openClose === "open" ? "Opening" : "Closing");
  if (description) notesParts.push(description);
  const notes = notesParts.length > 0 ? notesParts.join(" · ") : null;

  return {
    ticker: finalTicker,
    optionType: finalOptionType(optionType),
    strike: finalStrike,
    expiry: finalExpiry || tradeDate,
    action,
    quantity,
    pricePerContract: price,
    tradeDate,
    notes,
    fees: fees > 0 ? fees : undefined,
    openClose: openClose ?? undefined,
  };
}

function finalOptionType(v: string): "call" | "put" {
  return v.toLowerCase().includes("put") ? "put" : "call";
}
