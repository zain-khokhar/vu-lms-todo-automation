import { NextResponse } from 'next/server';

// This endpoint is called internally to send WhatsApp messages
// The actual WhatsApp client runs in server.js, we need to communicate with it

export async function POST(request) {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json(
        { error: 'Phone and message are required' },
        { status: 400 }
      );
    }

    // Import whatsapp client dynamically to get the server's instance
    const whatsappModule = await import('@/lib/whatsapp');
    const whatsappClient = whatsappModule.default;

    if (!whatsappClient.isClientReady()) {
      return NextResponse.json(
        { error: 'WhatsApp client not ready' },
        { status: 503 }
      );
    }

    await whatsappClient.sendMessage(phone, message);

    return NextResponse.json({ success: true, message: 'Message sent' });
  } catch (error) {
    console.error('[WhatsApp Send] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
