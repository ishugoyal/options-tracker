"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Trade } from "@/types/trade";

const defaultValues = {
  ticker: "",
  optionType: "call" as "call" | "put",
  strike: "",
  expiry: "",
  action: "buy" as "buy" | "sell",
  quantity: "1",
  pricePerContract: "",
  fees: "",
  tradeDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

interface TradeFormProps {
  trade?: Trade | null;
}

export function TradeForm({ trade }: TradeFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(defaultValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (trade) {
      setForm({
        ticker: trade.ticker,
        optionType: trade.optionType,
        strike: String(trade.strike),
        expiry: trade.expiry,
        action: trade.action,
        quantity: String(trade.quantity),
        pricePerContract: String(trade.pricePerContract),
        fees: trade.fees != null ? String(trade.fees) : "",
        tradeDate: trade.tradeDate,
        notes: trade.notes ?? "",
      });
    }
  }, [trade]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ticker: form.ticker.trim().toUpperCase(),
        optionType: form.optionType,
        strike: Number(form.strike),
        expiry: form.expiry,
        action: form.action,
        quantity: Math.floor(Number(form.quantity)) || 1,
        pricePerContract: Number(form.pricePerContract),
        fees: form.fees.trim() === "" ? null : Number(form.fees),
        tradeDate: form.tradeDate,
        notes: form.notes.trim() || null,
      };
      const url = trade ? `/api/trades/${trade.id}` : "/api/trades";
      const method = trade ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      if (!trade) setForm(defaultValues);
      router.push("/trades");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4 rounded-lg border border-slate-700 bg-slate-800/30 p-6">
      {error && (
        <div className="rounded bg-red-900/30 px-4 py-2 text-red-300 text-sm">{error}</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Ticker</label>
          <input
            type="text"
            required
            value={form.ticker}
            onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            placeholder="AAPL"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Option type</label>
          <select
            value={form.optionType}
            onChange={(e) => setForm((f) => ({ ...f, optionType: e.target.value as "call" | "put" }))}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
          >
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Strike</label>
          <input
            type="number"
            required
            step="0.01"
            value={form.strike}
            onChange={(e) => setForm((f) => ({ ...f, strike: e.target.value }))}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            placeholder="150.00"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Expiry (YYYY-MM-DD)</label>
          <input
            type="date"
            required
            value={form.expiry}
            onChange={(e) => setForm((f) => ({ ...f, expiry: e.target.value }))}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Action</label>
          <select
            value={form.action}
            onChange={(e) => setForm((f) => ({ ...f, action: e.target.value as "buy" | "sell" }))}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Quantity (contracts)</label>
          <input
            type="number"
            required
            min="1"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Price per contract ($)</label>
          <input
            type="number"
            required
            step="0.01"
            min="0"
            value={form.pricePerContract}
            onChange={(e) => setForm((f) => ({ ...f, pricePerContract: e.target.value }))}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            placeholder="2.50"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Fees ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.fees}
            onChange={(e) => setForm((f) => ({ ...f, fees: e.target.value }))}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            placeholder="Optional – e.g. commission"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Trade date</label>
          <input
            type="date"
            required
            value={form.tradeDate}
            onChange={(e) => setForm((f) => ({ ...f, tradeDate: e.target.value }))}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-400">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          placeholder="Optional"
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {submitting ? "Saving…" : trade ? "Update trade" : "Save trade"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/trades")}
          className="rounded border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
