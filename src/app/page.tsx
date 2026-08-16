import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOpenPositions, getClosedPositionsWithDates } from "@/lib/open-positions";
import { buildEarningsPositions } from "@/lib/earnings-positions";
import { buildCumulativeEarningsSeries } from "@/lib/cumulative-earnings";
import {
  buildPeriodActivity,
  rollingDayRange,
  type DashboardTrade,
} from "@/lib/dashboard-period";
import { buildConfirmedRolls, buildRollChains, type TradeForRoll } from "@/lib/rolls";
import { SummaryCards } from "@/components/SummaryCards";
import { CumulativeEarningsChart } from "@/components/CumulativeEarningsChart";
import { Last7DaysStrip } from "@/components/Last7DaysStrip";
import { PlCalendar } from "@/components/PlCalendar";
import { OpenPositionsPreview } from "@/components/OpenPositionsPreview";
import { ClosedPositionsPreview } from "@/components/ClosedPositionsPreview";

export const dynamic = "force-dynamic";

const thisYear = new Date().getFullYear();
const yearStart = `${thisYear}-01-01`;
const yearEnd = `${thisYear}-12-31`;
const today = new Date().toISOString().slice(0, 10);
const asOf = today < yearEnd ? today : yearEnd;
const range7 = rollingDayRange(today, 7);
const range30 = rollingDayRange(today, 30);
const range60 = rollingDayRange(today, 60);

export default async function HomePage() {
  const [allTrades, rollLinks] = await Promise.all([
    prisma.trade.findMany({
      orderBy: { tradeDate: "desc" },
    }),
    prisma.rollLink.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const tradesForPositions = allTrades.filter((t) => t.isOrphanClose !== true);

  const openPositions = getOpenPositions(
    tradesForPositions.map((t) => ({
      ticker: t.ticker,
      optionType: t.optionType,
      strike: t.strike,
      expiry: t.expiry,
      action: t.action,
      quantity: t.quantity,
    }))
  );

  const closedPositionsAll = getClosedPositionsWithDates(
    tradesForPositions.map((t) => ({
      ticker: t.ticker,
      optionType: t.optionType,
      strike: t.strike,
      expiry: t.expiry,
      action: t.action,
      quantity: t.quantity,
      pricePerContract: t.pricePerContract,
      fees: t.fees,
      tradeDate: t.tradeDate,
    }))
  );
  const closedPositions = closedPositionsAll.filter(
    (p) => p.closedAt >= yearStart && p.closedAt <= yearEnd
  );
  const totalClosedProfit = closedPositions.reduce((sum, p) => sum + p.profit, 0);

  const rollTrades: TradeForRoll[] = allTrades.map((t) => ({
    id: t.id,
    ticker: t.ticker,
    optionType: t.optionType,
    strike: t.strike,
    expiry: t.expiry,
    action: t.action,
    quantity: t.quantity,
    pricePerContract: t.pricePerContract,
    tradeDate: t.tradeDate,
    fees: t.fees,
    closesTradeId: t.closesTradeId,
    isOrphanClose: t.isOrphanClose,
    notes: t.notes,
  }));
  const rollChains = buildRollChains(buildConfirmedRolls(rollTrades, rollLinks), rollTrades);
  const chainEarningsAll = buildEarningsPositions(closedPositionsAll, rollChains, "chain");
  const chainEarningsYear = chainEarningsAll.filter(
    (p) => p.closedAt >= yearStart && p.closedAt <= yearEnd
  );
  const chainPlAfterFees = chainEarningsYear.reduce((sum, p) => sum + p.profit, 0);
  const cumulativePoints = buildCumulativeEarningsSeries(chainEarningsYear, yearStart, asOf);

  const dashboardTrades: DashboardTrade[] = allTrades.map((t) => ({
    id: t.id,
    ticker: t.ticker,
    optionType: t.optionType,
    strike: t.strike,
    expiry: t.expiry,
    action: t.action,
    quantity: t.quantity,
    tradeDate: t.tradeDate,
    pricePerContract: t.pricePerContract,
    fees: t.fees,
  }));

  const last7 = buildPeriodActivity(chainEarningsAll, dashboardTrades, range7.start, range7.end);
  const last30 = buildPeriodActivity(chainEarningsAll, dashboardTrades, range30.start, range30.end);
  const last60 = buildPeriodActivity(chainEarningsAll, dashboardTrades, range60.start, range60.end);
  const calendarMonth = new Date().getMonth() + 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-slate-400">Options trading activity this year ({thisYear}).</p>
      </div>
      <SummaryCards
        chainPlAfterFees={chainPlAfterFees}
        positionsTraded={chainEarningsYear.length}
        year={thisYear}
      />

      <Last7DaysStrip
        periods={{
          "7d": last7,
          "30d": last30,
          "60d": last60,
        }}
      />

      <CumulativeEarningsChart points={cumulativePoints} year={thisYear} />

      <PlCalendar
        chainEarnings={chainEarningsAll}
        trades={dashboardTrades}
        initialYear={thisYear}
        initialMonth={calendarMonth}
      />

      <div className="flex gap-4">
        <Link href="/reports" className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm text-sky-400 hover:bg-slate-800">
          Earnings →
        </Link>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Open positions</h2>
          <Link href="/open-positions" className="text-sky-400 hover:underline">
            View all →
          </Link>
        </div>
        <OpenPositionsPreview positions={openPositions} />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Closed positions</h2>
          <Link href="/closed-positions" className="text-sky-400 hover:underline">
            View all →
          </Link>
        </div>
        <ClosedPositionsPreview
          positions={closedPositions}
          totalProfit={totalClosedProfit}
          viewAllHref={`/closed-positions?start=${yearStart}&end=${yearEnd}`}
        />
      </div>
    </div>
  );
}
