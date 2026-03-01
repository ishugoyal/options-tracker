import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

/**
 * Fetch current option quote for the exact expiry only. No fallback to nearest expiry.
 * GET /api/option-quote?ticker=AAPL&expiry=2025-01-17&strike=150&type=call
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const expiry = searchParams.get("expiry"); // YYYY-MM-DD
  const strikeParam = searchParams.get("strike");
  const type = searchParams.get("type"); // call | put

  if (!ticker || !expiry || !strikeParam || !type) {
    return NextResponse.json(
      { error: "Missing ticker, expiry, strike, or type" },
      { status: 400 }
    );
  }

  const strike = parseFloat(strikeParam);
  if (Number.isNaN(strike)) {
    return NextResponse.json({ error: "Invalid strike" }, { status: 400 });
  }

  function getStrike(o: Record<string, unknown>): number | null {
    const s = o.strike ?? (o as { strikePrice?: unknown }).strikePrice;
    if (typeof s === "number" && !Number.isNaN(s)) return s;
    if (s != null && typeof s === "object" && "raw" in s) return Number((s as { raw: unknown }).raw);
    if (typeof s === "string") return parseFloat(s);
    return null;
  }

  try {
    const yahooFinance = new YahooFinance();
    const strikeNum = Number(strike);
    const typeKey = type.toLowerCase() === "put" ? "puts" : "calls";
    const strikeMatches = (o: Record<string, unknown>): boolean => {
      const s = getStrike(o);
      return s != null && (Math.abs(s - strikeNum) < 0.01 || Math.round(s * 100) === Math.round(strikeNum * 100));
    };

    let data: unknown;
    try {
      data = await yahooFinance.options(ticker, { date: new Date(expiry + "T00:00:00.000Z") });
    } catch {
      data = null;
    }

    const raw = data as {
      options?: Array<{
        calls?: Array<Record<string, unknown>>;
        puts?: Array<Record<string, unknown>>;
      }>;
    } | null;

    const optionsList = raw?.options;
    const optionSet = optionsList?.[0];
    if (!optionSet?.calls?.length && !optionSet?.puts?.length) {
      return NextResponse.json(
        {
          error: `No option quote for ${ticker} expiry ${expiry}. Yahoo returned no chain for this exact date.`,
          last: null,
        },
        { status: 404 }
      );
    }

    const list = optionSet[typeKey] as Array<Record<string, unknown>> | undefined;
    const option =
      list?.find(strikeMatches) ??
      list?.find((o) => {
        const s = getStrike(o);
        return s != null && Math.abs(s - strikeNum) < 0.5;
      });

    if (!option) {
      const available = list
        ? [...new Set(list.map(getStrike).filter((s): s is number => s != null && !Number.isNaN(s)))].sort((a, b) => a - b)
        : [];
      const sample = available.slice(0, 15).join(", ") + (available.length > 15 ? "…" : "");
      return NextResponse.json(
        {
          error: `Strike ${strike} not found for ${ticker} expiry ${expiry}. ${available.length ? `Available strikes: ${sample}` : "No strikes in response."}`,
          last: null,
        },
        { status: 404 }
      );
    }

    const last =
      (option.lastPrice as number | undefined) ??
      (option.regularMarketPrice as number | undefined) ??
      (option.bid as number | undefined) ??
      (option.ask as number | undefined);
    const bid = option.bid as number | undefined;
    const ask = option.ask as number | undefined;

    return NextResponse.json({
      last: last != null ? Number(last) : null,
      bid: bid != null ? Number(bid) : null,
      ask: ask != null ? Number(ask) : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("option-quote error:", message);
    return NextResponse.json(
      { error: "Failed to fetch quote", last: null, detail: message },
      { status: 500 }
    );
  }
}
