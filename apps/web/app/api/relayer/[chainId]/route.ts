import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for the Zama relayer.
 *
 * Browser apps should never call the relayer directly with an API key. The
 * Zama Relayer SDK (real mode) is configured to call `/api/relayer/<chainId>`,
 * and this route forwards the request to the upstream relayer, injecting the
 * secret `ZAMA_RELAYER_API_KEY` from the server environment.
 *
 * In demo mode this route is never hit. In real mode, set:
 *   ZAMA_RELAYER_URL=https://relayer.testnet.zama.cloud
 *   ZAMA_RELAYER_API_KEY=...   (optional, depending on the relayer)
 */

export const runtime = "nodejs";

async function forward(req: NextRequest, chainId: string) {
  const upstream = process.env.ZAMA_RELAYER_URL;
  if (!upstream) {
    return NextResponse.json(
      {
        error:
          "Relayer proxy not configured. Set ZAMA_RELAYER_URL to enable real Zama mode, or use NEXT_PUBLIC_ZAMA_MODE=demo.",
      },
      { status: 501 },
    );
  }

  const targetUrl = `${upstream.replace(/\/$/, "")}/${chainId}${new URL(req.url).search}`;
  const headers = new Headers();
  headers.set("content-type", req.headers.get("content-type") ?? "application/json");
  if (process.env.ZAMA_RELAYER_API_KEY) {
    headers.set("x-api-key", process.env.ZAMA_RELAYER_API_KEY);
    headers.set("authorization", `Bearer ${process.env.ZAMA_RELAYER_API_KEY}`);
  }

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  try {
    const res = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Relayer proxy failed." },
      { status: 502 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { chainId: string } },
) {
  return forward(req, params.chainId);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { chainId: string } },
) {
  return forward(req, params.chainId);
}
