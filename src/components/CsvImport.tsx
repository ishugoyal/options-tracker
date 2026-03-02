"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseCsvFile, normalizeRows, buildImportPreview, type NormalizedRow, type ImportPreviewRow } from "@/lib/csv-import";
import { BROKER_PRESETS, type OurField } from "@/lib/broker-presets";

const OUR_FIELDS: OurField[] = [
  "ticker",
  "optionType",
  "strike",
  "expiry",
  "action",
  "quantity",
  "pricePerContract",
  "tradeDate",
  "notes",
];

export function CsvImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [brokerId, setBrokerId] = useState<string>(BROKER_PRESETS[0].id);
  const [customMap, setCustomMap] = useState<Record<OurField, string>>({} as Record<OurField, string>);
  const [preview, setPreview] = useState<NormalizedRow[] | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[] | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const preset = BROKER_PRESETS.find((p) => p.id === brokerId)!;
  const presetHasMap = Object.keys(preset.columnMap).length > 0;
  const effectiveMap = presetHasMap
    ? preset.columnMap
    : Object.fromEntries(OUR_FIELDS.map((f) => [customMap[f] || "", f]).filter(([k]) => k));

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setFile(f);
      setPreview(null);
      setPreviewRows(null);
      setMessage(null);
      try {
        const { headers: h, rows: r } = await parseCsvFile(f);
        setHeaders(h ?? []);
        setRows(r ?? []);
      } catch (err) {
        setMessage({ type: "err", text: "Failed to parse CSV" });
      }
    },
    []
  );

  const handlePreview = useCallback(() => {
    if (rows.length === 0) return;
    const presetForNormalize = {
      ...preset,
      columnMap: effectiveMap as Record<string, OurField>,
    };
    const { ok, errors } = normalizeRows(rows, presetForNormalize);
    setImportErrors(errors);
    setPreview(ok);
    const built = ok.length > 0 ? buildImportPreview(ok) : null;
    setPreviewRows(built);
    setSelectedIndices(built ? new Set(built.map((_, i) => i)) : new Set());
    if (ok.length === 0 && errors.length > 0) {
      setMessage({ type: "err", text: `No valid rows. ${errors.slice(0, 3).join("; ")}` });
    } else if (ok.length > 0) {
      setMessage(null);
    }
  }, [rows, preset, effectiveMap]);

  /** Build the list of NormalizedRow to send to the API from selected preview row indices (order preserved for pairing). */
  const getTradesToImport = useCallback((): NormalizedRow[] => {
    if (!previewRows || selectedIndices.size === 0) return [];
    const sorted = [...selectedIndices].sort((a, b) => a - b);
    const out: NormalizedRow[] = [];
    for (const i of sorted) {
      const row = previewRows[i];
      if (!row) continue;
      if (row.kind === "pair") {
        out.push(row.openRow);
        out.push(row.closeRow);
      } else {
        out.push(row.row);
      }
    }
    return out;
  }, [previewRows, selectedIndices]);

  const handleImport = useCallback(async () => {
    const tradesToImport = getTradesToImport();
    if (tradesToImport.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/trades/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trades: tradesToImport,
          importId: `import-${Date.now()}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [data.error, data.detail].filter(Boolean).join(" — ") || "Import failed";
        throw new Error(msg);
      }
      setMessage({ type: "ok", text: `Imported ${data.imported ?? tradesToImport.length} trades.` });
      setPreview(null);
      setPreviewRows(null);
      setSelectedIndices(new Set());
      setFile(null);
      setRows([]);
      setHeaders([]);
      router.refresh();
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Import failed" });
    } finally {
      setSubmitting(false);
    }
  }, [getTradesToImport, router]);

  const hasMapping =
    preset.id === "fidelity" ||
    (Object.keys(effectiveMap).length > 0 && Object.values(effectiveMap).some(Boolean));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">1. Select broker & upload CSV</h2>
        <div className="mb-4">
          <label className="mb-2 block text-sm text-slate-400">Broker</label>
          <select
            value={brokerId}
            onChange={(e) => {
              setBrokerId(e.target.value);
              setPreview(null);
            }}
            className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
          >
            {BROKER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm text-slate-400">CSV file</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="block w-full text-sm text-slate-300 file:mr-4 file:rounded file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-white file:hover:bg-sky-500"
          />
          {file && <p className="mt-2 text-slate-500 text-sm">{file.name}</p>}
        </div>
      </div>

      {headers.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">2. Map columns (Fidelity/Robinhood presets TBD)</h2>
          {preset.id === "fidelity" ? (
            <p className="mb-4 text-slate-400 text-sm">
              Fidelity format is auto-detected from your CSV (Run Date, Action, Symbol, Description, Price, Quantity, etc.). Option rows are parsed from Symbol (e.g. MSFT260327P365) and Action (YOU BOUGHT / YOU SOLD). Non-option rows are skipped. No column mapping needed.
            </p>
          ) : (
            <>
          <p className="mb-4 text-slate-400 text-sm">
            Map each app field to a CSV column. When you have sample exports, we can add exact Fidelity and Robinhood presets.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {OUR_FIELDS.map((field) => (
              <div key={field}>
                <label className="mb-1 block text-xs text-slate-500">{field}</label>
                <select
                  value={presetHasMap ? (Object.entries(preset.columnMap).find(([, f]) => f === field)?.[0] ?? "") : (customMap[field] ?? "")}
                  onChange={(e) => {
                    setCustomMap((m) => ({ ...m, [field]: e.target.value }));
                    setPreview(null);
                  }}
                  disabled={presetHasMap}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none disabled:opacity-70"
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {!presetHasMap && (
            <p className="mt-3 text-slate-400 text-sm">
              Map each app field to your CSV column. When you have sample Fidelity or Robinhood exports, we can add one-click presets.
            </p>
          )}
            </>
          )}
        </div>
      )}

      {headers.length > 0 && hasMapping && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">3. Preview & import</h2>
          <button
            type="button"
            onClick={handlePreview}
            className="rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-500"
          >
            Preview
          </button>
          {importErrors.length > 0 && (
            <ul className="mt-3 text-amber-400 text-sm list-disc list-inside">
              {importErrors.slice(0, 5).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {importErrors.length > 5 && <li>… and {importErrors.length - 5} more</li>}
            </ul>
          )}
          {preview && preview.length > 0 && (
            <>
              <p className="mt-4 text-slate-400">
                {previewRows?.length ?? 0} preview row(s) · {selectedIndices.size} selected → {getTradesToImport().length} trade(s) to import
              </p>
              <div className="mt-2 max-h-80 overflow-auto rounded border border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-800 text-slate-400">
                    <tr>
                      <th className="px-2 py-1 w-8">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!previewRows && selectedIndices.size === previewRows.length}
                            onChange={(e) => {
                              if (!previewRows) return;
                              if (e.target.checked) {
                                setSelectedIndices(new Set(previewRows.map((_, i) => i)));
                              } else {
                                setSelectedIndices(new Set());
                              }
                            }}
                            className="rounded border-slate-500"
                          />
                          <span className="text-slate-400 text-xs">All</span>
                        </label>
                      </th>
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1">Ticker</th>
                      <th className="px-2 py-1">Type</th>
                      <th className="px-2 py-1">Strike</th>
                      <th className="px-2 py-1">Expiry</th>
                      <th className="px-2 py-1">Open date</th>
                      <th className="px-2 py-1">Close date</th>
                      <th className="px-2 py-1">Qty</th>
                      <th className="px-2 py-1">P/L</th>
                      <th className="px-2 py-1">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {(previewRows ?? []).map((row, i) => {
                      const selected = selectedIndices.has(i);
                      const toggleSelect = () => {
                        setSelectedIndices((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          return next;
                        });
                      };
                      if (row.kind === "pair") {
                        return (
                          <tr key={i} className="bg-slate-800/50">
                            <td className="px-2 py-1">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={toggleSelect}
                                className="rounded border-slate-500"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <span className="rounded bg-green-900/40 px-1.5 py-0.5 text-green-300">Pair</span>
                            </td>
                            <td className="px-2 py-1 font-medium text-white">{row.ticker}</td>
                            <td className="px-2 py-1 capitalize text-slate-300">{row.optionType}</td>
                            <td className="px-2 py-1 text-slate-300">{row.strike}</td>
                            <td className="px-2 py-1 text-slate-300">{row.expiry}</td>
                            <td className="px-2 py-1 text-slate-300">{row.openDate}</td>
                            <td className="px-2 py-1 text-slate-300">{row.closeDate}</td>
                            <td className="px-2 py-1 text-slate-300">{row.quantity}</td>
                            <td className={`px-2 py-1 font-medium ${row.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {row.profit >= 0 ? "+" : ""}${row.profit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-2 py-1 text-slate-500">—</td>
                          </tr>
                        );
                      }
                      if (row.kind === "open_only") {
                        return (
                          <tr key={i}>
                            <td className="px-2 py-1">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={toggleSelect}
                                className="rounded border-slate-500"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-amber-300">Open</span>
                            </td>
                            <td className="px-2 py-1 font-medium text-white">{row.ticker}</td>
                            <td className="px-2 py-1 capitalize text-slate-300">{row.optionType}</td>
                            <td className="px-2 py-1 text-slate-300">{row.strike}</td>
                            <td className="px-2 py-1 text-slate-300">{row.expiry}</td>
                            <td className="px-2 py-1 text-slate-300">{row.tradeDate}</td>
                            <td className="px-2 py-1 text-slate-500">—</td>
                            <td className="px-2 py-1 text-slate-300">{row.quantity}</td>
                            <td className="px-2 py-1 text-slate-500">—</td>
                            <td className="px-2 py-1 text-amber-400/90 max-w-[140px]">Not closed yet</td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={i} className="bg-slate-800/30">
                          <td className="px-2 py-1">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={toggleSelect}
                              className="rounded border-slate-500"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-red-300">Orphan close</span>
                          </td>
                          <td className="px-2 py-1 font-medium text-white">{row.ticker}</td>
                          <td className="px-2 py-1 capitalize text-slate-300">{row.optionType}</td>
                          <td className="px-2 py-1 text-slate-300">{row.strike}</td>
                          <td className="px-2 py-1 text-slate-300">{row.expiry}</td>
                          <td className="px-2 py-1 text-slate-500">—</td>
                          <td className="px-2 py-1 text-slate-300">{row.tradeDate}</td>
                          <td className="px-2 py-1 text-slate-300">{row.quantity}</td>
                          <td className="px-2 py-1 text-slate-500">—</td>
                          <td className="px-2 py-1 text-red-400/90 max-w-[180px]">
                            No matching open in file. Opening may already be in app or missing — verify after import.
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={handleImport}
                disabled={submitting || selectedIndices.size === 0}
                className="mt-4 rounded bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {submitting ? "Importing…" : `Import ${getTradesToImport().length} selected trade(s)`}
              </button>
            </>
          )}
        </div>
      )}

      {message && (
        <div
          className={`rounded px-4 py-2 ${message.type === "ok" ? "bg-green-900/30 text-green-300" : "bg-red-900/30 text-red-300"}`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
