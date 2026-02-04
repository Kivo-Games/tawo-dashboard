import { NextRequest, NextResponse } from 'next/server';

const MATCHING_WEBHOOK_PRODUCTION =
  'https://tawo.app.n8n.cloud/webhook/87040d37-7862-4840-b723-1c156c00b2d4';
const MATCHING_WEBHOOK_TEST =
  'https://tawo.app.n8n.cloud/webhook-test/87040d37-7862-4840-b723-1c156c00b2d4';

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

    const sendTo = async (url: string, label: string) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      console.log(`Matching webhook (${label}): status ${res.status}, body length ${(await res.text()).length}`);
      return res;
    };

    const resProd = await sendTo(MATCHING_WEBHOOK_PRODUCTION, 'production');
    await new Promise((r) => setTimeout(r, 100));
    const resTest = await sendTo(MATCHING_WEBHOOK_TEST, 'test');

    if (!resProd.ok) {
      console.error('Matching webhook production failed:', resProd.status);
      return NextResponse.json(
        { error: `Production webhook returned ${resProd.status}` },
        { status: resProd.status }
      );
    }
    if (!resTest.ok) {
      console.error('Matching webhook test failed:', resTest.status);
      return NextResponse.json(
        { error: `Test webhook returned ${resTest.status}` },
        { status: resTest.status }
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
