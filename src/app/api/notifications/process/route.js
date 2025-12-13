import { NextResponse } from 'next/server';
import db from '@/lib/db';
import scheduler from '@/lib/scheduler';
import logger from '@/lib/logger';

/**
 * POST /api/notifications/process
 * Manually trigger notification processing
 */
export async function POST() {
  try {
    // Connect to database
    await db.connect();

    logger.info('[API] Manual notification processing triggered');

    // Process pending notifications
    const result = await scheduler.processPendingNotifications();

    return NextResponse.json({
      success: true,
      ...result,
      message: `Processed ${result.processed} notifications: ${result.sent} sent, ${result.failed} failed`
    });

  } catch (error) {
    logger.error('[API] Error processing notifications:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/notifications/process
 * Get notification queue status
 */
export async function GET() {
  try {
    await db.connect();

    const Notification = (await import('@/models/Notification')).default;

    const [pending, sent, failed] = await Promise.all([
      Notification.countDocuments({ status: 'pending' }),
      Notification.countDocuments({ status: 'sent' }),
      Notification.countDocuments({ status: 'failed' })
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        pending,
        sent,
        failed,
        total: pending + sent + failed
      }
    });

  } catch (error) {
    logger.error('[API] Error getting notification stats:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
