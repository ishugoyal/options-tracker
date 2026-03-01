import Link from "next/link";
import type { ClosedPosition } from "@/lib/open-positions";

interface ClosedPositionsPreviewProps {
  positions: ClosedPosition[];
  totalProfit: number;
  maxRows?: number;
}

export function ClosedPositionsPreview({ positions, totalProfit, maxRows = 5 }: ClosedPositionsPreviewProps) {
  const show = positions.slice(0, maxRows);

  if (positions.length === 0) {
    return (
      <p className="rounded-lg border border-slate-700 bg-slate-800/30 p-6 text-center text-slate-400 text-sm">
        No closed positions yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-slate-400 text-sm">
        Total profit:{" "}
        <span className={`font-semibold ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
          {totalProfit >= 0 ? "+" : ""}${totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
            <tr>
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Strike</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {show.map((p, i) => (
              <tr key={`${p.ticker}-${p.expiry}-${p.strike}-${p.optionType}-${i}`} className="hover:bg-slate-800/50">
                <td className="px-4 py-2 font-medium text-white">{p.ticker}</td>
                <td className="px-4 py-2 capitalize text-slate-300">{p.optionType}</td>
                <td className="px-4 py-2 text-slate-300">{p.strike}</td>
                <td className="px-4 py-2 text-slate-300">{p.expiry}</td>
                <td className={`px-4 py-2 font-medium ${p.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {p.profit >= 0 ? "+" : ""}${p.profit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {positions.length > maxRows && (
        <p className="text-slate-500 text-xs">+{positions.length - maxRows} more</p>
      )}
    </div>
  );
}
