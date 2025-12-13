/**
 * MongoDB connection manager
 */

import mongoose from 'mongoose';
import logger from './logger.js';

class Database {
  constructor() {
    this.connection = null;
    this.isConnecting = false;
  }

  async connect() {
    if (this.connection && mongoose.connection.readyState === 1) {
      logger.info('[DB] Already connected to MongoDB');
      return this.connection;
    }

    if (this.isConnecting) {
      logger.info('[DB] Connection already in progress, waiting...');
      // Wait for connection to complete
      while (this.isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.connection;
    }

    try {
      this.isConnecting = true;
      const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

      if (!mongoUri) {
        throw new Error('MONGO_URI is not defined in environment variables');
      }

      logger.info('[DB] Connecting to MongoDB...');

      this.connection = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });

      logger.info('[DB] ✓ MongoDB connected successfully');

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        logger.error('[DB] MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('[DB] MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('[DB] MongoDB reconnected');
      });

      return this.connection;
    } catch (error) {
      logger.error('[DB] Failed to connect to MongoDB:', error.message);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect() {
    if (this.connection) {
      try {
        await mongoose.disconnect();
        logger.info('[DB] MongoDB disconnected gracefully');
        this.connection = null;
      } catch (error) {
        logger.error('[DB] Error disconnecting from MongoDB:', error.message);
        throw error;
      }
    }
  }

  getConnection() {
    return this.connection;
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }
}

// Singleton instance
const db = new Database();

export default db;
