interface SummaryCardsProps {
  /** Chain-realization P/L for the period (FIFO profits already net of fees). */
  chainPlAfterFees: number;
  /** Closed earnings events: one per standalone close or closed roll chain. */
  positionsTraded: number;
  year: number;
}

export function SummaryCards({ chainPlAfterFees, positionsTraded, year }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
        <p className="text-sm text-slate-400">P/L (chain realization)</p>
        <p
          className={`text-2xl font-bold ${
            chainPlAfterFees >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {chainPlAfterFees >= 0 ? "+" : ""}
          $
          {chainPlAfterFees.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <p className="text-xs text-slate-500">After fees · {year} · closed chains + standalone closes</p>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
        <p className="text-sm text-slate-400">Positions traded</p>
        <p className="text-2xl font-bold text-white">{positionsTraded}</p>
        <p className="text-xs text-slate-500">Roll chain counts as one · {year}</p>
      </div>
    </div>
  );
}
