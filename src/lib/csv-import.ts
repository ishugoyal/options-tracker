import { parse } from "papaparse";
import { format, parse as parseDate } from "date-fns";
import type { BrokerPreset, OurField } from "./broker-presets";
import { parseFidelityRow } from "./fidelity-csv";

export interface NormalizedRow {
  ticker: string;
  optionType: "call" | "put";
  strike: number;
  expiry: string;
  action: "buy" | "sell";
  quantity: number;
  pricePerContract: number;
  tradeDate: string;
  notes: string | null;
  /** Optional fees (commission + fees) for this trade */
  fees?: number;
  /** If "close", import should link this trade to a matching opening trade via closesTradeId */
  openClose?: "open" | "close";
}

function optionKey(r: NormalizedRow): string {
  return `${r.ticker}|${r.optionType}|${r.strike}|${r.expiry}`;
}

/** One line in the import preview: either a matched pair, an unclosed open, or an orphan close */
export type ImportPreviewRow =
  | {
      kind: "pair";
      ticker: string;
      optionType: "call" | "put";
      strike: number;
      expiry: string;
      openDate: string;
      closeDate: string;
      action: "buy" | "sell"; // open side (sell = short, buy = long)
      quantity: number;
      openPrice: number;
      closePrice: number;
      profit: number; // realized P/L from this pair
      openRow: NormalizedRow;
      closeRow: NormalizedRow;
    }
  | {
      kind: "open_only";
      ticker: string;
      optionType: "call" | "put";
      strike: number;
      expiry: string;
      tradeDate: string;
      action: "buy" | "sell";
      quantity: number;
      pricePerContract: number;
      row: NormalizedRow;
    }
  | {
      kind: "orphan_close";
      ticker: string;
      optionType: "call" | "put";
      strike: number;
      expiry: string;
      tradeDate: string;
      action: "buy" | "sell";
      quantity: number;
      pricePerContract: number;
      row: NormalizedRow;
    };

/**
 * Build preview rows from normalized Fidelity rows: pair opens with closes (one line + P/L),
 * list unclosed opens with "Not closed yet", list orphan closes with "Verify opening trade".
 */
export function buildImportPreview(rows: NormalizedRow[]): ImportPreviewRow[] {
  const result: ImportPreviewRow[] = [];
  const opensByKey = new Map<string, NormalizedRow[]>();

  for (const r of rows) {
    const key = optionKey(r);
    if (r.openClose === "open") {
      const list = opensByKey.get(key) ?? [];
      list.push(r);
      opensByKey.set(key, list);
    }
  }

  const usedOpens = new Set<NormalizedRow>();

  for (const r of rows) {
    if (r.openClose !== "close") continue;

    const key = optionKey(r);
    const openList = opensByKey.get(key) ?? [];
    const oppositeAction = r.action === "buy" ? "sell" : "buy";
    const matchIndex = openList.findIndex(
      (o) => !usedOpens.has(o) && o.action === oppositeAction && o.tradeDate <= r.tradeDate
    );
    if (matchIndex >= 0) {
      const openRow = openList[matchIndex];
      usedOpens.add(openRow);
      const openPrice = openRow.pricePerContract;
      const closePrice = r.pricePerContract;
      const qty = openRow.quantity;
      const profit =
        openRow.action === "sell"
          ? (openPrice - closePrice) * 100 * qty
          : (closePrice - openPrice) * 100 * qty;
      result.push({
        kind: "pair",
        ticker: r.ticker,
        optionType: r.optionType,
        strike: r.strike,
        expiry: r.expiry,
        openDate: openRow.tradeDate,
        closeDate: r.tradeDate,
        action: openRow.action,
        quantity: qty,
        openPrice,
        closePrice,
        profit,
        openRow,
        closeRow: r,
      });
    } else {
      result.push({
        kind: "orphan_close",
        ticker: r.ticker,
        optionType: r.optionType,
        strike: r.strike,
        expiry: r.expiry,
        tradeDate: r.tradeDate,
        action: r.action,
        quantity: r.quantity,
        pricePerContract: r.pricePerContract,
        row: r,
      });
    }
  }

  for (const r of rows) {
    if (r.openClose !== "open" || usedOpens.has(r)) continue;
    result.push({
      kind: "open_only",
      ticker: r.ticker,
      optionType: r.optionType,
      strike: r.strike,
      expiry: r.expiry,
      tradeDate: r.tradeDate,
      action: r.action,
      quantity: r.quantity,
      pricePerContract: r.pricePerContract,
      row: r,
    });
  }

  return result;
}

function parseNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  const s = String(val).replace(/[$,\s]/g, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

function parseOptionType(val: unknown): "call" | "put" {
  const s = String(val ?? "").toLowerCase();
  if (s.includes("put") || s === "p") return "put";
  return "call";
}

function parseAction(val: unknown): "buy" | "sell" {
  const s = String(val ?? "").toLowerCase();
  if (s.includes("sell") || s.includes("short") || s === "s") return "sell";
  return "buy";
}

/** Try to parse date and return YYYY-MM-DD */
function normalizeDate(val: unknown, dateFormat?: "MM/DD/YYYY" | "YYYY-MM-DD"): string {
  if (val === null || val === undefined || val === "") return "";
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    if (dateFormat === "MM/DD/YYYY") {
      const d = parseDate(s, "MM/dd/yyyy", new Date());
      return format(d, "yyyy-MM-dd");
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
  } catch {
    // ignore
  }
  return s;
}

export function parseCsvFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const headers = results.meta.fields ?? (rows[0] ? Object.keys(rows[0]) : []);
        resolve({ headers, rows });
      },
      error: (err) => reject(err),
    });
  });
}

export function normalizeRows(
  rows: Record<string, string>[],
  preset: BrokerPreset
): { ok: NormalizedRow[]; errors: string[] } {
  if (preset.id === "fidelity") {
    return normalizeFidelityRows(rows);
  }

  const map = preset.columnMap;
  const errors: string[] = [];
  const ok: NormalizedRow[] = [];

  const get = (row: Record<string, string>, ourField: OurField): string => {
    const csvHeader = Object.entries(map).find(([, f]) => f === ourField)?.[0];
    if (!csvHeader) return "";
    const val = row[csvHeader];
    return val != null ? String(val).trim() : "";
  };

  rows.forEach((row, i) => {
    const ticker = get(row, "ticker").toUpperCase() || get(row, "ticker");
    const tradeDate = normalizeDate(get(row, "tradeDate"), preset.dateFormat);
    const expiry = normalizeDate(get(row, "expiry"), preset.dateFormat) || tradeDate;
    const optionType = parseOptionType(get(row, "optionType"));
    const action = parseAction(get(row, "action"));
    const quantity = Math.max(0, Math.floor(parseNumber(get(row, "quantity"))));
    const pricePerContract = parseNumber(get(row, "pricePerContract"));
    const strike = parseNumber(get(row, "strike"));

    if (!ticker) {
      errors.push(`Row ${i + 2}: missing ticker`);
      return;
    }
    if (!tradeDate) {
      errors.push(`Row ${i + 2}: missing trade date`);
      return;
    }

    ok.push({
      ticker,
      optionType,
      strike,
      expiry,
      action,
      quantity: quantity || 1,
      pricePerContract,
      tradeDate,
      notes: get(row, "notes") || null,
    });
  });

  return { ok, errors };
}

/** Fidelity CSV: use row parser instead of column map. Skips non-option rows. */
function normalizeFidelityRows(rows: Record<string, string>[]): { ok: NormalizedRow[]; errors: string[] } {
  const ok: NormalizedRow[] = [];
  const errors: string[] = [];

  rows.forEach((row, i) => {
    const parsed = parseFidelityRow(row);
    if (parsed === null) {
      // Skip non-option rows (e.g. cash, dividends) without error
      return;
    }
    ok.push(parsed);
  });

  return { ok, errors };
}
