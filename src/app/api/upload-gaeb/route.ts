import { NextRequest, NextResponse } from 'next/server';

const WEBHOOK_URL = 'https://tawo.app.n8n.cloud/webhook/gaeb/x83-to-csv';

export async function POST(request: NextRequest) {
  try {
    // Get the content-type header to forward it properly
    const contentType = request.headers.get('content-type') || '';

    // Forward the raw body to the webhook
    const body = await request.arrayBuffer();

    console.log('Forwarding request to webhook, body size:', body.byteLength);

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body: body,
    });

    console.log('Webhook response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Webhook error:', response.status, errorText);
      return NextResponse.json(
        { error: `Webhook returned status ${response.status}` },
        { status: response.status }
      );
    }

    // Try to return the response data safely
    const responseContentType = response.headers.get('content-type');
    const responseText = await response.text();

    console.log('Webhook response content-type:', responseContentType);
    console.log('Webhook response body length:', responseText.length);

    if (responseContentType?.includes('application/json') && responseText) {
      try {
        const data = JSON.parse(responseText);
        return NextResponse.json(data);
      } catch {
        // JSON parse failed, return as message
        return NextResponse.json({ message: responseText || 'Upload successful' });
      }
    } else {
      return NextResponse.json({ message: responseText || 'Upload successful' });
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
