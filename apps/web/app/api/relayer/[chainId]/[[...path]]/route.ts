import { NextRequest, NextResponse } from "next/server";

/**
 * Optional catch-all proxy for the Zama relayer (real mode).
 * SDK calls e.g. POST /api/relayer/11155111/v1/... → ZAMA_RELAYER_URL/v1/...
 */
export const runtime = "nodejs";

async function forward(
  req: NextRequest,
  pathSegments: string[] | undefined,
) {
  const upstream = (
    process.env.ZAMA_RELAYER_URL ?? "https://relayer.testnet.zama.org/v2"
  ).replace(/\/$/, "");

  const subPath =
    pathSegments && pathSegments.length ? `/${pathSegments.join("/")}` : "";
  const targetUrl = `${upstream}${subPath}${new URL(req.url).search}`;

  const headers = new Headers();
  headers.set(
    "content-type",
    req.headers.get("content-type") ?? "application/json",
  );
  if (process.env.ZAMA_RELAYER_API_KEY) {
    headers.set("x-api-key", process.env.ZAMA_RELAYER_API_KEY);
    headers.set("authorization", `Bearer ${process.env.ZAMA_RELAYER_API_KEY}`);
  }

  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  try {
    const res = await fetch(targetUrl, { method: req.method, headers, body });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Relayer proxy failed." },
      { status: 502 },
    );
  }
}

type RouteCtx = { params: { chainId: string; path?: string[] } };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return forward(req, ctx.params.path);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return forward(req, ctx.params.path);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return forward(req, ctx.params.path);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return forward(req, ctx.params.path);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return forward(req, ctx.params.path);
}
