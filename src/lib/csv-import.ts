import { parse } from "papaparse";
import { format, parse as parseDate } from "date-fns";
import type { BrokerPreset, OurField } from "./broker-presets";

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
