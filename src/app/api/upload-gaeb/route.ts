import { NextRequest, NextResponse } from 'next/server';

const WEBHOOK_URL = 'https://n8n.kivosoftware.de/webhook/gaeb/x83-to-csv';

export async function POST(request: NextRequest) {
  try {
    // Get the content-type header to forward it properly
    const contentType = request.headers.get('content-type') || '';

    // Forward the raw body to the webhook
    const body = await request.arrayBuffer();

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Webhook error:', response.status, errorText);
      return NextResponse.json(
        { error: `Webhook returned status ${response.status}` },
        { status: response.status }
      );
    }

    // Try to return the response data
    const responseContentType = response.headers.get('content-type');
    if (responseContentType?.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const text = await response.text();
      return NextResponse.json({ message: text || 'Upload successful' });
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
