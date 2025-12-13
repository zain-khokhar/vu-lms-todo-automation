/**
 * WhatsApp Client Manager
 * Handles WhatsApp Web.js connection, authentication, and message sending
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import logger from './logger.js';

class WhatsAppClient {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.qrCodeData = null;
    this.qrCodeUrl = null;
  }

  async initialize() {
    if (this.client) {
      logger.info('[WHATSAPP] Client already initialized');
      return;
    }

    try {
      logger.info('[WHATSAPP] Initializing WhatsApp client...');

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: '.wwebjs_auth'
        }),
        puppeteer: {
          headless: false,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
          ]
        }
      });

      // QR Code event - display in terminal and save for URL access
      this.client.on('qr', async (qr) => {
        logger.info('[WHATSAPP] QR Code received. Scan to authenticate.');
        
        // Display QR in terminal
        qrcodeTerminal.generate(qr, { small: true });
        
        // Generate QR code as data URL for browser access
        try {
          this.qrCodeData = qr;
          this.qrCodeUrl = await qrcode.toDataURL(qr);
          
          logger.info('╔════════════════════════════════════════════════════════════════╗');
          logger.info('║                    WHATSAPP QR CODE LOGIN                      ║');
          logger.info('╠════════════════════════════════════════════════════════════════╣');
          logger.info('║  Open this URL in your browser to see the QR code:            ║');
          logger.info('║  http://localhost:3000/api/whatsapp/qr                         ║');
          logger.info('║                                                                ║');
          logger.info('║  Or scan the QR code above with your WhatsApp mobile app      ║');
          logger.info('╚════════════════════════════════════════════════════════════════╝');
        } catch (error) {
          logger.error('[WHATSAPP] Error generating QR code URL:', error);
        }
      });

      // Ready event
      this.client.on('ready', () => {
        this.isReady = true;
        this.qrCodeData = null;
        this.qrCodeUrl = null;
        logger.info('[WHATSAPP] ✓ Client is ready and authenticated!');
      });

      // Authenticated event
      this.client.on('authenticated', () => {
        logger.info('[WHATSAPP] Authentication successful');
      });

      // Authentication failure event
      this.client.on('auth_failure', (msg) => {
        logger.error('[WHATSAPP] Authentication failed:', msg);
        this.qrCodeData = null;
        this.qrCodeUrl = null;
      });

      // Disconnected event
      this.client.on('disconnected', (reason) => {
        logger.warn('[WHATSAPP] Client disconnected:', reason);
        this.isReady = false;
        this.qrCodeData = null;
        this.qrCodeUrl = null;
      });

      // Error event
      this.client.on('error', (error) => {
        logger.error('[WHATSAPP] Client error:', error);
      });

      // Initialize the client
      await this.client.initialize();
      logger.info('[WHATSAPP] Client initialization started');

    } catch (error) {
      logger.error('[WHATSAPP] Failed to initialize client:', error);
      throw error;
    }
  }

  /**
   * Send a message to a WhatsApp number
   * @param {string} phoneNumber - Phone number with country code (e.g., '+923001234567')
   * @param {string} message - Message text to send
   * @returns {Promise<boolean>} - True if sent successfully
   */
  async sendMessage(phoneNumber, message) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready. Please authenticate first.');
    }

    try {
      // Format phone number for WhatsApp (remove + and add @c.us)
      const formattedNumber = phoneNumber.replace(/[^0-9]/g, '') + '@c.us';
      
      logger.info(`[WHATSAPP] Sending message to ${phoneNumber}...`);
      
      await this.client.sendMessage(formattedNumber, message);
      
      logger.info(`[WHATSAPP] ✓ Message sent successfully to ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error(`[WHATSAPP] Failed to send message to ${phoneNumber}:`, error.message);
      throw error;
    }
  }

  /**
   * Get QR code data URL for browser display
   * @returns {string|null} - QR code data URL or null if not available
   */
  getQRCodeUrl() {
    return this.qrCodeUrl;
  }

  /**
   * Check if client is ready
   * @returns {boolean}
   */
  isClientReady() {
    return this.isReady;
  }

  /**
   * Get connection status
   * @returns {string} - 'ready', 'waiting_qr', or 'disconnected'
   */
  getStatus() {
    if (this.isReady) return 'ready';
    if (this.qrCodeData) return 'waiting_qr';
    return 'disconnected';
  }

  /**
   * Gracefully disconnect the client
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.destroy();
        this.isReady = false;
        this.qrCodeData = null;
        this.qrCodeUrl = null;
        logger.info('[WHATSAPP] Client disconnected gracefully');
      } catch (error) {
        logger.error('[WHATSAPP] Error disconnecting client:', error);
      }
    }
  }
}

// Singleton instance
const whatsappClient = new WhatsAppClient();

export default whatsappClient;
