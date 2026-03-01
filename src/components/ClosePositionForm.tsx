"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OpenPosition } from "@/lib/open-positions";

interface ClosePositionFormProps {
  position: OpenPosition;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export function ClosePositionForm({ position, onCancel, onSuccess }: ClosePositionFormProps) {
  const router = useRouter();
  const [pricePerContract, setPricePerContract] = useState("");
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeAction = position.side === "short" ? "buy" : "sell";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: position.ticker,
          optionType: position.optionType,
          strike: position.strike,
          expiry: position.expiry,
          action: closeAction,
          quantity: position.quantityToClose,
          pricePerContract: Number(pricePerContract),
          tradeDate,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      if (onSuccess) {
        onSuccess();
        router.refresh();
      } else {
        router.push("/trades");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const actionLabel = position.side === "short" ? "Buy to close" : "Sell to close";
  const label = `${position.ticker} ${position.expiry} ${position.optionType} $${position.strike} (${position.quantityToClose} contract${position.quantityToClose !== 1 ? "s" : ""})`;

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-700 bg-slate-800/30 p-6">
      <p className="mb-4 text-slate-300">
        Closing: <span className="font-medium text-white">{label}</span>
      </p>
      <p className="mb-4 text-sm text-slate-400">{actionLabel}</p>
      {error && (
        <div className="mb-4 rounded bg-red-900/30 px-4 py-2 text-red-300 text-sm">{error}</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Price per contract ($)</label>
          <input
            type="number"
            required
            step="0.01"
            min="0"
            value={pricePerContract}
            onChange={(e) => setPricePerContract(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            placeholder="0.50"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Trade date</label>
          <input
            type="date"
            required
            value={tradeDate}
            onChange={(e) => setTradeDate(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-4">
        <label className="mb-1 block text-sm text-slate-400">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          placeholder="e.g. Buy to close"
        />
      </div>
      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Close position"}
        </button>
        <button
          type="button"
          onClick={() => (onCancel ? onCancel() : router.push("/trades"))}
          className="rounded border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
