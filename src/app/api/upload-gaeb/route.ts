import { NextRequest, NextResponse } from 'next/server';

const WEBHOOK_URL = 'https://n8n.kivosoftware.de/webhook/gaeb/x83-to-csv';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Webhook returned status ${response.status}` },
        { status: response.status }
      );
    }

    // Try to return the response data
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
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
