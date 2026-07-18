import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  closedQuantityByOpenId,
  isValidOrphanOpenLink,
  splitOrphanFees,
} from "@/lib/orphan-open-candidates";

function revalidateOrphanPaths() {
  revalidatePath("/");
  revalidatePath("/trades");
  revalidatePath("/open-positions");
  revalidatePath("/closed-positions");
  revalidatePath("/orphaned-closes");
  revalidatePath("/reports");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orphanId } = await params;
    const orphan = await prisma.trade.findFirst({
      where: { id: orphanId, isOrphanClose: true },
    });
    if (!orphan) {
      return NextResponse.json({ error: "Orphan close trade not found" }, { status: 404 });
    }

    const body = await request.json();
    const openTradeId = body.openTradeId != null ? String(body.openTradeId).trim() : "";

    if (openTradeId) {
      const openTrade = await prisma.trade.findUnique({ where: { id: openTradeId } });
      if (!openTrade) {
        return NextResponse.json({ error: "Opening trade not found" }, { status: 404 });
      }

      const rawLinkQty = body.linkQuantity != null ? Number(body.linkQuantity) : orphan.quantity;
      const linkQuantity = Math.floor(rawLinkQty);
      if (!Number.isFinite(linkQuantity) || linkQuantity < 1) {
        return NextResponse.json({ error: "Link quantity must be at least 1" }, { status: 400 });
      }

      const allTrades = await prisma.trade.findMany();
      const closedByOpenId = closedQuantityByOpenId(allTrades);

      if (!isValidOrphanOpenLink(orphan, openTrade, closedByOpenId, linkQuantity)) {
        return NextResponse.json(
          { error: "Selected trade cannot be linked for that quantity" },
          { status: 400 }
        );
      }

      if (linkQuantity === orphan.quantity) {
        await prisma.trade.update({
          where: { id: orphanId },
          data: { closesTradeId: openTrade.id, isOrphanClose: false },
        });
      } else {
        const { linkedFees, remainingFees } = splitOrphanFees(
          orphan.fees,
          linkQuantity,
          orphan.quantity
        );

        await prisma.$transaction([
          prisma.trade.create({
            data: {
              ticker: orphan.ticker,
              optionType: orphan.optionType,
              strike: orphan.strike,
              expiry: orphan.expiry,
              action: orphan.action,
              quantity: linkQuantity,
              pricePerContract: orphan.pricePerContract,
              tradeDate: orphan.tradeDate,
              notes: orphan.notes,
              fees: linkedFees,
              source: orphan.source,
              importId: orphan.importId,
              closesTradeId: openTrade.id,
              isOrphanClose: false,
            },
          }),
          prisma.trade.update({
            where: { id: orphanId },
            data: {
              quantity: orphan.quantity - linkQuantity,
              fees: remainingFees,
            },
          }),
        ]);
      }

      revalidateOrphanPaths();

      return NextResponse.json({
        ok: true,
        openTradeId: openTrade.id,
        linked: true,
        linkQuantity,
        orphanRemaining: linkQuantity === orphan.quantity ? 0 : orphan.quantity - linkQuantity,
      });
    }

    const tradeDate = String(body.tradeDate ?? "").trim();
    const pricePerContract = Number(body.pricePerContract ?? 0);
    const fees = body.fees != null ? Number(body.fees) : null;
    const rawLinkQty = body.linkQuantity != null ? Number(body.linkQuantity) : orphan.quantity;
    const linkQuantity = Math.floor(rawLinkQty);

    if (!tradeDate) {
      return NextResponse.json({ error: "Opening trade date is required" }, { status: 400 });
    }

    if (tradeDate > orphan.tradeDate) {
      return NextResponse.json(
        { error: "Opening trade date cannot be after the close date" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(linkQuantity) || linkQuantity < 1 || linkQuantity > orphan.quantity) {
      return NextResponse.json(
        { error: `Resolve quantity must be between 1 and ${orphan.quantity}` },
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
        quantity: linkQuantity,
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

    if (linkQuantity === orphan.quantity) {
      await prisma.trade.update({
        where: { id: orphanId },
        data: { closesTradeId: openTrade.id, isOrphanClose: false },
      });
    } else {
      const { linkedFees, remainingFees } = splitOrphanFees(
        orphan.fees,
        linkQuantity,
        orphan.quantity
      );

      await prisma.$transaction([
        prisma.trade.create({
          data: {
            ticker: orphan.ticker,
            optionType: orphan.optionType,
            strike: orphan.strike,
            expiry: orphan.expiry,
            action: orphan.action,
            quantity: linkQuantity,
            pricePerContract: orphan.pricePerContract,
            tradeDate: orphan.tradeDate,
            notes: orphan.notes,
            fees: linkedFees,
            source: orphan.source,
            importId: orphan.importId,
            closesTradeId: openTrade.id,
            isOrphanClose: false,
          },
        }),
        prisma.trade.update({
          where: { id: orphanId },
          data: {
            quantity: orphan.quantity - linkQuantity,
            fees: remainingFees,
          },
        }),
      ]);
    }

    revalidateOrphanPaths();

    return NextResponse.json({
      ok: true,
      openTradeId: openTrade.id,
      linked: false,
      linkQuantity,
      orphanRemaining: linkQuantity === orphan.quantity ? 0 : orphan.quantity - linkQuantity,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to resolve orphan" },
      { status: 500 }
    );
  }
}
