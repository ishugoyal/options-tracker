import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orphanId } = await params;
    const orphan = await prisma.trade.findUnique({
      where: { id: orphanId, isOrphanClose: true },
    });
    if (!orphan) {
      return NextResponse.json({ error: "Orphan close trade not found" }, { status: 404 });
    }

    const body = await request.json();
    const tradeDate = String(body.tradeDate ?? "").trim();
    const pricePerContract = Number(body.pricePerContract ?? 0);
    const fees = body.fees != null ? Number(body.fees) : null;

    if (!tradeDate) {
      return NextResponse.json({ error: "Opening trade date is required" }, { status: 400 });
    }

    if (tradeDate > orphan.tradeDate) {
      return NextResponse.json(
        { error: "Opening trade date cannot be after the close date" },
        { status: 400 }
      );
    }

    const oppositeAction = orphan.action === "buy" ? "sell" : "buy";

    const openTrade = await prisma.trade.create({
      data: {
        ticker: orphan.ticker,
        optionType: orphan.optionType,
        strike: orphan.strike,
        expiry: orphan.expiry,
        action: oppositeAction,
        quantity: orphan.quantity,
        pricePerContract,
        tradeDate,
        notes: `Opening trade (resolved orphan ${orphanId.slice(0, 8)})`,
        fees,
        source: "manual",
        importId: null,
        closesTradeId: null,
        isOrphanClose: false,
      },
    });

    await prisma.trade.update({
      where: { id: orphanId },
      data: { closesTradeId: openTrade.id, isOrphanClose: false },
    });

    revalidatePath("/");
    revalidatePath("/trades");
    revalidatePath("/open-positions");
    revalidatePath("/closed-positions");
    revalidatePath("/orphaned-closes");

    return NextResponse.json({ ok: true, openTradeId: openTrade.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to resolve orphan" },
      { status: 500 }
    );
  }
}
