import { NextRequest, NextResponse } from 'next/server';

const MATCHING_WEBHOOK_PRODUCTION =
  'https://tawo.app.n8n.cloud/webhook/22a8bfed-af0d-426a-9ae4-f7440ad15a24';

/** Wait up to 25 minutes for n8n; 524/timeouts are ignored on the client (row stays without result). */
const UPSTREAM_TIMEOUT_MS = 25 * 60 * 1000;

export const maxDuration = 1500; // 25 minutes (Vercel/hosting)

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid or missing JSON body' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).rows)) {
      return NextResponse.json(
        { error: 'Expected JSON body with { rows: [...] }' },
        { status: 400 }
      );
    }

    const payload = JSON.stringify(body);
    if (payload.length < 10) {
      return NextResponse.json(
        { error: 'Body too small or empty' },
        { status: 400 }
      );
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(MATCHING_WEBHOOK_PRODUCTION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    const upstreamContentType = upstream.headers.get('content-type') || '';
    const upstreamText = (await upstream.text()).trim();

    console.log(
      'Matching webhook upstream:',
      upstream.status,
      'content-type:',
      upstreamContentType,
      'len:',
      upstreamText.length
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Webhook returned ${upstream.status}`, upstream: upstreamText || undefined },
        { status: upstream.status }
      );
    }

    // If upstream returns JSON, forward it as JSON.
    if (upstreamContentType.includes('application/json') && upstreamText.length > 0) {
      try {
        return NextResponse.json(JSON.parse(upstreamText), { status: upstream.status });
      } catch {
        return new NextResponse(upstreamText, {
          status: upstream.status,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }

    // Empty or non-JSON response (e.g. 204-style "Kein Inhalt") – return a valid JSON body so client can handle it
    if (upstreamText.length === 0) {
      return NextResponse.json(
        { message: 'Webhook returned no content', ok: true },
        { status: 200 }
      );
    }

    return new NextResponse(upstreamText, {
      status: upstream.status,
      headers: { 'Content-Type': upstreamContentType || 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('Matching webhook error:', error);
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      {
        error: isTimeout
          ? 'Matching webhook timed out (15 min)'
          : error instanceof Error
            ? error.message
            : 'Matching webhook failed',
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
