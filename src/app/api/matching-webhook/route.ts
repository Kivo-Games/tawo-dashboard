import { NextRequest, NextResponse } from 'next/server';

const MATCHING_WEBHOOK_PRODUCTION =
  'https://tawo.app.n8n.cloud/webhook/f00e3175-721e-450b-b48c-fd0f6faa2d6d';

/** Allow up to 15 minutes for n8n webhook (can take ~3 min per request). */
const UPSTREAM_TIMEOUT_MS = 15 * 60 * 1000;

export const maxDuration = 900; // 15 minutes (Vercel/hosting)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object' || !Array.isArray((body as any).rows)) {
      return NextResponse.json(
        { error: 'Expected JSON body with { rows: [...] }' },
        { status: 400 }
      );
    }

    const payload = JSON.stringify(body);
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
    const upstreamText = await upstream.text();

    console.log(
      'Matching webhook upstream:',
      upstream.status,
      'content-type:',
      upstreamContentType,
      'len:',
      upstreamText.length
    );

    if (!upstream.ok) {
      // include upstream body for debugging (trim if needed)
      return NextResponse.json(
        { error: `Webhook returned ${upstream.status}`, upstream: upstreamText },
        { status: upstream.status }
      );
    }

    // If upstream returns JSON, forward it as JSON.
    if (upstreamContentType.includes('application/json') && upstreamText) {
      try {
        return NextResponse.json(JSON.parse(upstreamText), { status: upstream.status });
      } catch {
        // JSON header but invalid JSON payload; fall back to text
        return new NextResponse(upstreamText, {
          status: upstream.status,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }

    // Otherwise just forward text
    return new NextResponse(upstreamText || 'OK', {
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
