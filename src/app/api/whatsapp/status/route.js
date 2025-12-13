import { NextResponse } from 'next/server';
import whatsappClient from '@/lib/whatsapp';

/**
 * GET /api/whatsapp/status
 * Returns WhatsApp connection status
 */
export async function GET() {
  try {
    const status = whatsappClient.getStatus();
    const isReady = whatsappClient.isClientReady();

    return NextResponse.json({
      success: true,
      status,
      isReady,
      message: isReady 
        ? 'WhatsApp is connected and ready' 
        : status === 'waiting_qr'
        ? 'Waiting for QR code scan'
        : 'WhatsApp is disconnected'
    });

  } catch (error) {
    console.error('[API] Error getting WhatsApp status:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
