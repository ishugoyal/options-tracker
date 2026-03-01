"use client";

import { tradeCost, tradeFees } from "@/types/trade";
import type { Trade } from "@/types/trade";

interface SummaryCardsProps {
  trades: Trade[];
  totalRealizedPL: number;
  allTradesForFees: Trade[];
}

export function SummaryCards({ trades, totalRealizedPL, allTradesForFees }: SummaryCardsProps) {
  const count = trades.length;
  const totalFees = allTradesForFees.reduce((sum, t) => sum + tradeFees(t), 0);
  const plAfterFees = totalRealizedPL - totalFees;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
        <p className="text-sm text-slate-400">Total P/L</p>
        <p className={`text-2xl font-bold ${totalRealizedPL >= 0 ? "text-green-400" : "text-red-400"}`}>
          {totalRealizedPL >= 0 ? "+" : ""}${totalRealizedPL.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-slate-500">Realized from closed positions</p>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
        <p className="text-sm text-slate-400">Total fees</p>
        <p className="text-2xl font-bold text-white">
          ${totalFees.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-slate-500">Sum of fees on all trades</p>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
        <p className="text-sm text-slate-400">P/L after fees</p>
        <p className={`text-2xl font-bold ${plAfterFees >= 0 ? "text-green-400" : "text-red-400"}`}>
          {plAfterFees >= 0 ? "+" : ""}${plAfterFees.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-slate-500">P/L − total fees</p>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
        <p className="text-sm text-slate-400">Trades</p>
        <p className="text-2xl font-bold text-white">{count}</p>
      </div>
    </div>
  );
}
