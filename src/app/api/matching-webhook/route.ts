import { NextRequest, NextResponse } from 'next/server';

const MATCHING_WEBHOOK_PRODUCTION =
  'https://n8n.kivosoftware.de/webhook/ebffe043-8b78-4c28-bd7a-35d278511b44';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object' || !Array.isArray(body.rows)) {
      return NextResponse.json(
        { error: 'Expected JSON body with { rows: [...] }' },
        { status: 400 }
      );
    }

    const payload = JSON.stringify(body);
    console.log('Matching webhook: forwarding payload, rows count:', body.rows?.length ?? 0);

    const res = await fetch(MATCHING_WEBHOOK_PRODUCTION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    console.log('Matching webhook (production): status', res.status, 'body length', (await res.text()).length);

    if (!res.ok) {
      console.error('Matching webhook failed:', res.status);
      return NextResponse.json(
        { error: `Webhook returned ${res.status}` },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Matching webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Matching webhook failed' },
      { status: 500 }
    );
  }
}
