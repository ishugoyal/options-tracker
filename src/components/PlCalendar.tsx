import type { PlCalendarModel } from "@/lib/dashboard-period";

function fmtMoney(n: number): string {
  return (
    (n >= 0 ? "+" : "-") +
    "$" +
    Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  );
}

function fmtMoneyExact(n: number): string {
  return (
    (n >= 0 ? "+" : "-") +
    "$" +
    Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  model: PlCalendarModel;
};

export function PlCalendar({ model }: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/30 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">P/L calendar</h2>
        <p className={`text-sm font-medium ${model.monthTotal >= 0 ? "text-green-400" : "text-red-400"}`}>
          {model.monthLabel} · {fmtMoneyExact(model.monthTotal)}
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="mb-1 grid grid-cols-[repeat(7,minmax(0,1fr))_4.5rem] gap-1 text-center text-xs text-slate-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
            <div className="py-1">Week</div>
          </div>

          <div className="space-y-1">
            {model.weeks.map((week) => (
              <div
                key={week.days[0]?.date ?? "week"}
                className="grid grid-cols-[repeat(7,minmax(0,1fr))_4.5rem] gap-1"
              >
                {week.days.map((day) => {
                  const hasActivity = day.closedCount > 0 || day.openedCount > 0;
                  return (
                    <div
                      key={day.date}
                      className={`min-h-[4.5rem] rounded border p-1.5 ${
                        day.inMonth
                          ? "border-slate-700 bg-slate-900/40"
                          : "border-transparent bg-slate-900/10 text-slate-600"
                      }`}
                    >
                      <p className={`text-xs ${day.inMonth ? "text-slate-400" : "text-slate-600"}`}>
                        {day.dayOfMonth}
                      </p>
                      {day.inMonth && day.closedCount > 0 && (
                        <p
                          className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            day.realized >= 0
                              ? "bg-green-900/50 text-green-300"
                              : "bg-red-900/50 text-red-300"
                          }`}
                        >
                          {fmtMoney(day.realized)}
                        </p>
                      )}
                      {day.inMonth && hasActivity && (
                        <p className="mt-1 text-[10px] leading-tight text-slate-500">
                          {day.closedCount > 0 && (
                            <span>
                              {day.closedCount} closed
                              {day.openedCount > 0 ? " · " : ""}
                            </span>
                          )}
                          {day.openedCount > 0 && <span>{day.openedCount} new</span>}
                        </p>
                      )}
                    </div>
                  );
                })}
                <div className="flex min-h-[4.5rem] items-center justify-center rounded border border-slate-700 bg-slate-900/30 px-1">
                  {(week.days.some((d) => d.inMonth && d.closedCount > 0) ||
                    week.weekTotal !== 0) && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        week.weekTotal >= 0
                          ? "bg-green-900/50 text-green-300"
                          : "bg-red-900/50 text-red-300"
                      }`}
                    >
                      {fmtMoney(week.weekTotal)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
