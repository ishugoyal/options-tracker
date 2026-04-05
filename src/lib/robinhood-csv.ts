import { format, parse as parseDate } from "date-fns";
import type { NormalizedRow } from "./csv-import";

/**
 * Robinhood CSV columns (from export):
 * Activity Date, Process Date, Settle Date, Instrument, Description, Trans Code, Quantity, Price, Amount
 *
 * Instrument = ticker (e.g. LMND, HOOD)
 * Description = "LMND 11/22/2024 Call $35.00" → expiry, option type, strike
 * Trans Code = BTO (buy to open), STO (sell to open), BTC (buy to close), STC (sell to close)
 */

function parseNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  const s = String(val).replace(/[$,\s()]/g, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

/** Parse date MM/DD/YYYY to YYYY-MM-DD */
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

/** Get value from row by header (case-insensitive) */
function get(row: Record<string, string>, header: string): string {
  const key = Object.keys(row).find((k) => k.trim().toLowerCase() === header.trim().toLowerCase());
  const val = key != null ? row[key] : undefined;
  return val != null ? String(val).trim() : "";
}

/** Parse Description e.g. "LMND 11/22/2024 Call $35.00" or "HOOD 12/13/2024 Put $40.00" */
function parseRobinhoodDescription(
  description: string
): { expiry: string; optionType: "call" | "put"; strike: number } | null {
  const s = String(description ?? "").trim();
  const m = s.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\s+(Call|Put)\s+\$(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const [, dateStr, callPut, strikeStr] = m;
  const expiry = toISODate(dateStr);
  const optionType = callPut.toLowerCase() === "put" ? "put" : "call";
  const strike = parseNumber(strikeStr);
  return { expiry, optionType: optionType as "call" | "put", strike };
}

/** Trans Code → action (buy/sell) and open/close */
function parseTransCode(code: string): { action: "buy" | "sell"; openClose: "open" | "close" } | null {
  const s = String(code ?? "").toUpperCase().trim();
  switch (s) {
    case "BTO":
      return { action: "buy", openClose: "open" };
    case "STO":
      return { action: "sell", openClose: "open" };
    case "BTC":
      return { action: "buy", openClose: "close" };
    case "STC":
      return { action: "sell", openClose: "close" };
    default:
      return null;
  }
}

/**
 * Parse one Robinhood CSV row into a normalized trade, or null if not an option trade.
 */
export function parseRobinhoodRow(row: Record<string, string>): NormalizedRow | null {
  const activityDate = get(row, "Activity Date");
  const instrument = get(row, "Instrument");
  const description = get(row, "Description");
  const transCode = get(row, "Trans Code");
  const quantity = Math.max(0, Math.floor(parseNumber(get(row, "Quantity")))) || 1;
  const price = parseNumber(get(row, "Price"));
  const amountStr = get(row, "Amount");

  const parsed = parseTransCode(transCode);
  if (!parsed) return null;

  const fromDesc = parseRobinhoodDescription(description);
  if (!fromDesc) return null;

  const ticker = instrument.toUpperCase();
  if (!ticker) return null;

  const tradeDate = toISODate(activityDate);
  if (!tradeDate) return null;

  const amount = parseNumber(amountStr);
  const premium = quantity * price * 100;
  const fees = Math.abs(Math.abs(amount) - premium);
  const feesValue = fees > 0.001 ? fees : undefined;

  const notesParts: string[] = [];
  notesParts.push(parsed.openClose === "open" ? "Opening" : "Closing");
  if (description) notesParts.push(description);
  const notes = notesParts.length > 0 ? notesParts.join(" · ") : null;

  return {
    ticker,
    optionType: fromDesc.optionType,
    strike: fromDesc.strike,
    expiry: fromDesc.expiry || tradeDate,
    action: parsed.action,
    quantity,
    pricePerContract: price,
    tradeDate,
    notes,
    fees: feesValue,
    openClose: parsed.openClose,
  };
}
