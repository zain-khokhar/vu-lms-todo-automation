/**
 * Background Server
 * Initializes WhatsApp client and starts notification auto-processing
 * Runs alongside Next.js server
 */

import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import whatsappClient from './src/lib/whatsapp.js';
import scheduler from './src/lib/scheduler.js';
import db from './src/lib/db.js';
import logger from './src/lib/logger.js';

// Simple HTTP server for WhatsApp messaging (port 3001)
function startWhatsAppServer() {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/send') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { phone, message } = JSON.parse(body);
          
          if (!whatsappClient.isClientReady()) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'WhatsApp not ready' }));
            return;
          }

          await whatsappClient.sendMessage(phone, message);
          logger.info(`[WA-SERVER] ✓ Message sent to ${phone}`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          logger.error(`[WA-SERVER] Error:`, error.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        ready: whatsappClient.isClientReady(),
        status: whatsappClient.getStatus()
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(3001, () => {
    logger.info('[WA-SERVER] WhatsApp API running on http://localhost:3001');
  });
}

async function startBackgroundServices() {
  try {
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('  VU LMS Todo Automation - Background Services');
    logger.info('═══════════════════════════════════════════════════════');
    
    // Step 1: Connect to MongoDB
    logger.info('[STARTUP] Connecting to MongoDB...');
    await db.connect();
    logger.info('[STARTUP] ✓ MongoDB connected');

    // Step 2: Initialize WhatsApp Client
    logger.info('[STARTUP] Initializing WhatsApp client...');
    await whatsappClient.initialize();
    logger.info('[STARTUP] ✓ WhatsApp client initialized');

    // Wait for WhatsApp to be ready or show QR code
    let waitCount = 0;
    while (!whatsappClient.isClientReady() && waitCount < 60) {
      const status = whatsappClient.getStatus();
      if (status === 'waiting_qr') {
        // QR code is displayed, no need to wait anymore
        logger.info('[STARTUP] WhatsApp QR code ready for scanning');
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitCount++;
    }

    if (whatsappClient.isClientReady()) {
      logger.info('[STARTUP] ✓ WhatsApp is authenticated and ready');
      
      // Step 3: Start notification auto-processing
      logger.info('[STARTUP] Starting notification auto-processing...');
      scheduler.startAutoProcessing();
      logger.info('[STARTUP] ✓ Notification auto-processing started (every 5 minutes)');
    } else {
      logger.warn('[STARTUP] WhatsApp not authenticated yet. Scan QR code at: http://localhost:3000/api/whatsapp/qr');
    }

    logger.info('═══════════════════════════════════════════════════════');
    logger.info('  ✓ Background services started successfully');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');
    logger.info('📱 WhatsApp Status: ' + whatsappClient.getStatus());
    logger.info('🔗 Next.js App: http://localhost:3000');
    logger.info('🔐 WhatsApp QR: http://localhost:3000/api/whatsapp/qr');
    logger.info('');

    // Start WhatsApp HTTP server for API communication
    startWhatsAppServer();

  } catch (error) {
    logger.error('[STARTUP] Fatal error starting background services:', error);
    process.exit(1);
  }
}

// Graceful shutdown
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    logger.info(`[SHUTDOWN] Received ${signal}, shutting down gracefully...`);
    
    try {
      // Stop notification processing
      scheduler.stopAutoProcessing();
      logger.info('[SHUTDOWN] Notification processing stopped');

      // Disconnect WhatsApp
      await whatsappClient.disconnect();
      logger.info('[SHUTDOWN] WhatsApp client disconnected');

      // Disconnect database
      await db.disconnect();
      logger.info('[SHUTDOWN] Database disconnected');

      logger.info('[SHUTDOWN] ✓ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('[SHUTDOWN] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('[FATAL] Uncaught exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('UNHANDLED_REJECTION');
  });
}

// Start the background services
setupGracefulShutdown();
startBackgroundServices();

// Export for use in other files if needed
export { whatsappClient, scheduler, db };
