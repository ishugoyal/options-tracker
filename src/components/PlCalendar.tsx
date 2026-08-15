"use client";

import { useMemo, useState } from "react";
import {
  buildPlCalendar,
  type DashboardTrade,
} from "@/lib/dashboard-period";
import type { ClosedPositionWithDate } from "@/lib/open-positions";

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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

type Props = {
  chainEarnings: ClosedPositionWithDate[];
  trades: DashboardTrade[];
  initialYear: number;
  initialMonth: number; // 1-12
};

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function PlCalendar({ chainEarnings, trades, initialYear, initialMonth }: Props) {
  const [{ year, month }, setCursor] = useState({ year: initialYear, month: initialMonth });

  const model = useMemo(
    () => buildPlCalendar(chainEarnings, trades, year, month),
    [chainEarnings, trades, year, month]
  );

  const go = (delta: number) => setCursor((c) => shiftMonth(c.year, c.month, delta));

  const isCurrent =
    year === initialYear && month === initialMonth;

  return (
    <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-white">P/L calendar</h2>
          <div className="inline-flex items-center rounded-md border border-slate-600 bg-slate-900/50 text-sm">
            <button
              type="button"
              onClick={() => go(-1)}
              className="px-1.5 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="px-1.5 py-1 font-medium tabular-nums text-white">
              {model.monthLabel}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              className="px-1.5 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Next month"
            >
              ›
            </button>
            {!isCurrent && (
              <button
                type="button"
                onClick={() => setCursor({ year: initialYear, month: initialMonth })}
                className="border-l border-slate-600 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                Today
              </button>
            )}
          </div>
        </div>
        <p className={`text-sm font-medium ${model.monthTotal >= 0 ? "text-green-400" : "text-red-400"}`}>
          {fmtMoneyExact(model.monthTotal)}
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="mb-1 grid grid-cols-[repeat(5,minmax(0,1fr))_4.5rem] gap-1 text-center text-xs text-slate-500">
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
                className="grid grid-cols-[repeat(5,minmax(0,1fr))_4.5rem] gap-1"
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
