import Link from "next/link";
import type { OpenPosition } from "@/lib/open-positions";

interface OpenPositionsPreviewProps {
  positions: OpenPosition[];
  maxRows?: number;
}

export function OpenPositionsPreview({ positions, maxRows = 5 }: OpenPositionsPreviewProps) {
  const show = positions.slice(0, maxRows);

  if (positions.length === 0) {
    return (
      <p className="rounded-lg border border-slate-700 bg-slate-800/30 p-6 text-center text-slate-400 text-sm">
        No open positions.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
          <tr>
            <th className="px-4 py-3">Ticker</th>
            <th className="px-4 py-3">Side</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Strike</th>
            <th className="px-4 py-3">Expiry</th>
            <th className="px-4 py-3">Qty</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {show.map((p, i) => (
            <tr key={`${p.ticker}-${p.expiry}-${p.strike}-${p.optionType}-${p.side}-${i}`} className="hover:bg-slate-800/50">
              <td className="px-4 py-2 font-medium text-white">{p.ticker}</td>
              <td className="px-4 py-2 capitalize text-slate-300">{p.side}</td>
              <td className="px-4 py-2 capitalize text-slate-300">{p.optionType}</td>
              <td className="px-4 py-2 text-slate-300">{p.strike}</td>
              <td className="px-4 py-2 text-slate-300">{p.expiry}</td>
              <td className="px-4 py-2 text-slate-300">{p.quantityToClose}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {positions.length > maxRows && (
        <p className="px-4 py-2 text-slate-500 text-xs">+{positions.length - maxRows} more</p>
      )}
    </div>
  );
}
