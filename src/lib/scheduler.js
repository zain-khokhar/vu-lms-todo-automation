/**
 * Notification Scheduler
 * Handles scheduling and processing of WhatsApp notifications
 */

import logger from './logger.js';
import whatsappClient from './whatsapp.js';
import User from '../models/User.js';
import Activity from '../models/Activity.js';
import Notification from '../models/Notification.js';

class NotificationScheduler {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.processInterval = null;
  }

  /**
   * Schedule notifications for a new activity
   * @param {Object} activity - Activity document from MongoDB
   * @returns {Promise<Array>} - Array of created notification documents
   */
  async scheduleNotifications(activity) {
    try {
      const notifications = [];
      const now = new Date();
      
      // Notification 1: On activity start date (if it has a start date and it's in the future)
      if (activity.startDate && new Date(activity.startDate) > now) {
        try {
          const startNotification = await Notification.create({
            activityId: activity._id,
            userId: activity.userId,
            notificationType: 'start',
            scheduledFor: new Date(activity.startDate),
            status: 'pending'
          });
          notifications.push(startNotification);
          logger.info(`[SCHEDULER] Scheduled start notification for activity: ${activity.title}`);
        } catch (error) {
          if (error.code === 11000) {
            logger.info(`[SCHEDULER] Start notification already exists for activity: ${activity.title}`);
          } else {
            throw error;
          }
        }
      }

      // Notification 2: One day before due date (if due date is more than 1 day away)
      const dueDate = new Date(activity.dueDate);
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      
      if (reminderDate > now) {
        try {
          const reminderNotification = await Notification.create({
            activityId: activity._id,
            userId: activity.userId,
            notificationType: 'reminder',
            scheduledFor: reminderDate,
            status: 'pending'
          });
          notifications.push(reminderNotification);
          logger.info(`[SCHEDULER] Scheduled reminder notification for activity: ${activity.title}`);
        } catch (error) {
          if (error.code === 11000) {
            logger.info(`[SCHEDULER] Reminder notification already exists for activity: ${activity.title}`);
          } else {
            throw error;
          }
        }
      }

      return notifications;
    } catch (error) {
      logger.error('[SCHEDULER] Error scheduling notifications:', error);
      throw error;
    }
  }

  /**
   * Format activity as WhatsApp message
   * @param {Object} activity - Activity document
   * @param {string} notificationType - 'start' or 'reminder'
   * @returns {string} - Formatted message
   */
  formatMessage(activity, notificationType) {
    const emoji = notificationType === 'start' ? '🔔 *NEW ACTIVITY*' : '⏰ *DEADLINE REMINDER*';
    
    const dueDate = new Date(activity.dueDate);
    const dueDateStr = dueDate.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Calculate days remaining
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueDateClean = new Date(dueDate);
    dueDateClean.setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil((dueDateClean - now) / (1000 * 60 * 60 * 24));

    return `${emoji}

📚 *Course:* ${activity.courseCode}
📋 *Type:* ${activity.activityType}
📝 *Title:* ${activity.title}

📅 *Due Date:* ${dueDateStr}
⏳ *Days Remaining:* ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}

🔗 ${activity.link}

━━━━━━━━━━━━━━━━━━━━━
*POWERED BY VUEDU*`;
  }

  /**
   * Process pending notifications that are due
   * @returns {Promise<Object>} - Summary of processing results
   */
  async processPendingNotifications() {
    if (this.isProcessing) {
      logger.info('[SCHEDULER] Already processing notifications, skipping...');
      return { processed: 0, sent: 0, failed: 0 };
    }

    try {
      this.isProcessing = true;
      const now = new Date();
      
      // Find pending notifications that are due
      const pendingNotifications = await Notification.find({
        status: 'pending',
        scheduledFor: { $lte: now }
      })
        .populate('activityId')
        .populate('userId')
        .limit(50); // Process max 50 at a time

      logger.info(`[SCHEDULER] Found ${pendingNotifications.length} pending notifications to process`);

      let sent = 0;
      let failed = 0;

      for (const notification of pendingNotifications) {
        try {
          // Check if WhatsApp client is ready
          if (!whatsappClient.isClientReady()) {
            logger.warn('[SCHEDULER] WhatsApp client not ready, skipping notification processing');
            break;
          }

          // Check if user is active
          if (!notification.userId.isActive) {
            logger.info(`[SCHEDULER] User ${notification.userId.username} is inactive, skipping notification`);
            await notification.markAsFailed('User is inactive');
            failed++;
            continue;
          }

          // Format and send message
          const message = this.formatMessage(
            notification.activityId,
            notification.notificationType
          );

          await whatsappClient.sendMessage(notification.userId.whatsapp, message);
          
          // Mark as sent
          await notification.markAsSent();
          sent++;
          
          logger.info(`[SCHEDULER] ✓ Sent ${notification.notificationType} notification to ${notification.userId.whatsapp}`);

          // Small delay between messages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          logger.error(`[SCHEDULER] Failed to send notification:`, error.message);
          await notification.markAsFailed(error.message);
          failed++;
        }
      }

      logger.info(`[SCHEDULER] Processing complete: ${sent} sent, ${failed} failed`);

      return {
        processed: pendingNotifications.length,
        sent,
        failed
      };

    } catch (error) {
      logger.error('[SCHEDULER] Error processing notifications:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start automatic notification processing (runs every 5 minutes)
   */
  startAutoProcessing() {
    if (this.processInterval) {
      logger.warn('[SCHEDULER] Auto-processing already running');
      return;
    }

    logger.info('[SCHEDULER] Starting auto-processing (every 5 minutes)');
    
    // Process immediately
    this.processPendingNotifications().catch(err => {
      logger.error('[SCHEDULER] Error in initial processing:', err);
    });

    // Then process every 5 minutes
    this.processInterval = setInterval(() => {
      this.processPendingNotifications().catch(err => {
        logger.error('[SCHEDULER] Error in scheduled processing:', err);
      });
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop automatic notification processing
   */
  stopAutoProcessing() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      logger.info('[SCHEDULER] Auto-processing stopped');
    }
  }

  /**
   * Retry failed notifications (with max 3 attempts)
   * @returns {Promise<number>} - Number of notifications retried
   */
  async retryFailedNotifications() {
    try {
      const failedNotifications = await Notification.find({
        status: 'failed',
        attempts: { $lt: 3 },
        scheduledFor: { $lte: new Date() }
      });

      logger.info(`[SCHEDULER] Retrying ${failedNotifications.length} failed notifications`);

      for (const notification of failedNotifications) {
        // Reset status to pending for retry
        notification.status = 'pending';
        await notification.save();
      }

      return failedNotifications.length;
    } catch (error) {
      logger.error('[SCHEDULER] Error retrying failed notifications:', error);
      throw error;
    }
  }
}

// Singleton instance
const scheduler = new NotificationScheduler();

export default scheduler;
