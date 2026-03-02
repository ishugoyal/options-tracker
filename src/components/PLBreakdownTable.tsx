import type { PLBucket } from "@/lib/pl-breakdown";

interface PLBreakdownTableProps {
  title: string;
  buckets: PLBucket[];
  columnLabel: string; // e.g. "Ticker" or "Week" or "Month" or "Year"
  totalProfit: number;
}

function fmt(profit: number) {
  return (profit >= 0 ? "+" : "") + "$" + profit.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function PLBreakdownTable({ title, buckets, columnLabel, totalProfit }: PLBreakdownTableProps) {
  if (buckets.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>
        <p className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 text-slate-400 text-sm">
          No closed positions to show for this breakdown.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
            <tr>
              <th className="px-4 py-3">{columnLabel}</th>
              <th className="px-4 py-3 text-right">P/L</th>
              <th className="px-4 py-3 text-right">Positions</th>
              <th className="px-4 py-3 text-right">% of total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {buckets.map((b) => {
              const pct = totalProfit !== 0 ? (b.profit / totalProfit) * 100 : 0;
              return (
                <tr key={b.label} className="hover:bg-slate-800/50">
                  <td className="px-4 py-2 font-medium text-white">{b.label}</td>
                  <td
                    className={`px-4 py-2 text-right font-medium ${b.profit >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {fmt(b.profit)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-300">{b.count}</td>
                  <td className="px-4 py-2 text-right text-slate-400">
                    {totalProfit === 0 ? "—" : `${pct.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
