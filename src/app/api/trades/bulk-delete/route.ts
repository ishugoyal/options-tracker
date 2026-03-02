import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids must be a non-empty array" },
        { status: 400 }
      );
    }

    const validIds = ids.filter((id: unknown) => typeof id === "string" && id.length > 0);
    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "No valid trade ids provided" },
        { status: 400 }
      );
    }

    // Orphan any closing trades that referenced these open trades
    await prisma.trade.updateMany({
      where: { closesTradeId: { in: validIds } },
      data: { closesTradeId: null, isOrphanClose: true },
    });

    await prisma.trade.deleteMany({
      where: { id: { in: validIds } },
    });

    revalidatePath("/");
    revalidatePath("/trades");
    revalidatePath("/open-positions");
    revalidatePath("/closed-positions");
    revalidatePath("/orphaned-closes");

    return NextResponse.json({ ok: true, deleted: validIds.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete trades" }, { status: 500 });
  }
}
