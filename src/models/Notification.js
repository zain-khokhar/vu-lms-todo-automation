/**
 * Notification Model - Tracks scheduled and sent notifications
 */

import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Activity',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  notificationType: {
    type: String,
    required: true,
    enum: ['start', 'reminder'],
    index: true
  },
  scheduledFor: {
    type: Date,
    required: true,
    index: true
  },
  sentAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending',
    index: true
  },
  error: {
    type: String,
    default: null
  },
  attempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
notificationSchema.index({ userId: 1, status: 1, scheduledFor: 1 });
notificationSchema.index({ activityId: 1, notificationType: 1 }, { unique: true });

// Method to mark notification as sent
notificationSchema.methods.markAsSent = function() {
  this.status = 'sent';
  this.sentAt = new Date();
  return this.save();
};

// Method to mark notification as failed
notificationSchema.methods.markAsFailed = function(errorMessage) {
  this.status = 'failed';
  this.error = errorMessage;
  this.attempts += 1;
  return this.save();
};

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
