/**
 * Activity Model - Stores scraped LMS activities
 */

import mongoose from 'mongoose';
import crypto from 'crypto';

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  courseCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  activityType: {
    type: String,
    required: true,
    default: 'Unknown'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  startDate: {
    type: Date,
    default: null
  },
  dueDate: {
    type: Date,
    required: true,
    index: true
  },
  link: {
    type: String,
    required: true
  },
  activityHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  }
}, {
  timestamps: true
});

// Create compound index for efficient queries
activitySchema.index({ userId: 1, dueDate: 1 });
activitySchema.index({ userId: 1, activityHash: 1 });

// Static method to generate activity hash
activitySchema.statics.generateHash = function(userId, courseCode, title, dueDate) {
  const data = `${userId}|${courseCode}|${title}|${dueDate}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

const Activity = mongoose.models.Activity || mongoose.model('Activity', activitySchema);

export default Activity;
