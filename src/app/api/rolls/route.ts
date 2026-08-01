import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  buildConfirmedRolls,
  buildRollChains,
  detectHistoricalRollCandidates,
  getOpenChainTips,
  validateRollPair,
  type TradeForRoll,
} from "@/lib/rolls";

function toTradeForRoll(t: {
  id: string;
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  action: string;
  quantity: number;
  pricePerContract: number;
  tradeDate: string;
  fees: number | null;
  closesTradeId: string | null;
  isOrphanClose: boolean;
  notes: string | null;
}): TradeForRoll {
  return {
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
  };
}

export async function GET() {
  try {
    const [trades, links] = await Promise.all([
      prisma.trade.findMany({ orderBy: [{ tradeDate: "asc" }, { createdAt: "asc" }] }),
      prisma.rollLink.findMany({ orderBy: { createdAt: "desc" } }),
    ]);

    const tradeRows = trades.map(toTradeForRoll);
    const candidates = detectHistoricalRollCandidates(tradeRows, links);
    const confirmed = buildConfirmedRolls(tradeRows, links);
    const chains = buildRollChains(confirmed, tradeRows);
    const openTips = getOpenChainTips(chains);

    return NextResponse.json({
      candidates,
      confirmed,
      openTips,
      stats: {
        tradeCount: trades.length,
        candidateCount: candidates.length,
        confirmedCount: confirmed.length,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load rolls" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const closeTradeId = String(body.closeTradeId ?? "").trim();
    const openTradeId = String(body.openTradeId ?? "").trim();
    const quantity = Math.floor(Number(body.quantity ?? 0));

    if (!closeTradeId || !openTradeId) {
      return NextResponse.json({ error: "closeTradeId and openTradeId are required" }, { status: 400 });
    }

    const [close, open, existingClose, existingOpen] = await Promise.all([
      prisma.trade.findUnique({ where: { id: closeTradeId } }),
      prisma.trade.findUnique({ where: { id: openTradeId } }),
      prisma.rollLink.findFirst({ where: { closeTradeId } }),
      prisma.rollLink.findFirst({ where: { openTradeId } }),
    ]);

    if (!close || !open) {
      return NextResponse.json({ error: "One or both trades were not found" }, { status: 404 });
    }
    if (existingClose || existingOpen) {
      return NextResponse.json(
        { error: "One of these trades is already part of a confirmed roll" },
        { status: 400 }
      );
    }

    const validationError = validateRollPair(toTradeForRoll(close), toTradeForRoll(open), quantity);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const link = await prisma.rollLink.create({
      data: {
        closeTradeId,
        openTradeId,
        quantity,
      },
    });

    revalidatePath("/trades");
    revalidatePath("/rolls");
    revalidatePath("/reports");
    revalidatePath("/open-positions");

    return NextResponse.json({ ok: true, link });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create roll link" },
      { status: 500 }
    );
  }
}
