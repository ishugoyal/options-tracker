import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrphanOpenCandidates } from "@/lib/orphan-open-candidates";

export async function GET(
  _request: Request,
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

    const allTrades = await prisma.trade.findMany();
    const candidates = getOrphanOpenCandidates(orphan, allTrades);

    return NextResponse.json({ candidates });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load candidates" },
      { status: 500 }
    );
  }
}
