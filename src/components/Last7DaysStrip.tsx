function fmtMoney(n: number): string {
  return (
    (n >= 0 ? "+" : "-") +
    "$" +
    Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function fmtShortDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function contractLine(p: {
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  quantity: number;
}): string {
  return `${p.ticker} ${p.optionType.toUpperCase()} $${p.strike} · ${p.expiry} ×${p.quantity}`;
}

type ClosedItem = {
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  quantity: number;
  profit: number;
  date: string;
};

type OpenedItem = {
  id: string;
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  quantity: number;
  premium: number;
  date: string;
};

type Props = {
  start: string;
  end: string;
  realizedPl: number;
  closedCount: number;
  newPremium: number;
  openedCount: number;
  closedItems: ClosedItem[];
  openedItems: OpenedItem[];
};

export function Last7DaysStrip({
  start,
  end,
  realizedPl,
  closedCount,
  newPremium,
  openedCount,
  closedItems,
  openedItems,
}: Props) {
  const eventCount = closedCount + openedCount;

  return (
    <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/30 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Last 7 days</h2>
        <p className="text-sm text-slate-400">
          {fmtShortDate(start)} – {fmtShortDate(end)} · {eventCount} event{eventCount !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <p className="text-sm text-slate-400">Realized</p>
          <p className={`text-2xl font-bold ${realizedPl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {fmtMoney(realizedPl)}
          </p>
          <p className="text-xs text-slate-500">
            {closedCount} closed position{closedCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <p className="text-sm text-slate-400">New premium opened</p>
          <p className="text-2xl font-bold text-sky-400">{fmtMoney(newPremium)}</p>
          <p className="text-xs text-slate-500">
            {openedCount} sell to open{openedCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-medium text-slate-300">Closed</h3>
          {closedItems.length === 0 ? (
            <p className="rounded border border-slate-700/80 bg-slate-900/20 px-3 py-4 text-sm text-slate-500">
              No closes in this window.
            </p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {closedItems.map((p, i) => (
                <li
                  key={`${p.ticker}-${p.expiry}-${p.strike}-${p.date}-${i}`}
                  className="rounded border border-slate-700/80 bg-slate-900/30 px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{contractLine(p)}</p>
                      <p className="text-xs text-slate-500">{fmtShortDate(p.date)}</p>
                    </div>
                    <p className={`shrink-0 font-medium ${p.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {fmtMoney(p.profit)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium text-slate-300">Opened</h3>
          {openedItems.length === 0 ? (
            <p className="rounded border border-slate-700/80 bg-slate-900/20 px-3 py-4 text-sm text-slate-500">
              No new sells to open in this window.
            </p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {openedItems.map((p) => (
                <li
                  key={p.id}
                  className="rounded border border-slate-700/80 bg-slate-900/30 px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{contractLine(p)}</p>
                      <p className="text-xs text-slate-500">{fmtShortDate(p.date)}</p>
                    </div>
                    <p className="shrink-0 font-medium text-sky-400">{fmtMoney(p.premium)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
