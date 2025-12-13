import { NextResponse } from 'next/server';
import whatsappClient from '@/lib/whatsapp';

/**
 * GET /api/whatsapp/qr
 * Returns QR code for WhatsApp authentication
 */
export async function GET() {
  try {
    const qrUrl = whatsappClient.getQRCodeUrl();
    const status = whatsappClient.getStatus();

    if (!qrUrl) {
      return NextResponse.json({
        success: false,
        status,
        message: status === 'ready' 
          ? 'WhatsApp is already authenticated' 
          : 'QR code not available yet. Please restart the server.'
      });
    }

    // Return HTML page with QR code
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp QR Code - VU LMS Automation</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 24px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .qr-container {
      background: #f8f9fa;
      padding: 30px;
      border-radius: 15px;
      margin-bottom: 30px;
    }
    .qr-code {
      max-width: 100%;
      height: auto;
      border-radius: 10px;
    }
    .instructions {
      background: #e8f4fd;
      border-left: 4px solid #2196F3;
      padding: 20px;
      border-radius: 8px;
      text-align: left;
      margin-bottom: 20px;
    }
    .instructions h3 {
      color: #2196F3;
      margin-bottom: 15px;
      font-size: 16px;
    }
    .instructions ol {
      padding-left: 20px;
      color: #555;
      line-height: 1.8;
    }
    .instructions li {
      margin-bottom: 8px;
    }
    .status {
      display: inline-block;
      padding: 8px 16px;
      background: #fff3cd;
      color: #856404;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 10px;
    }
    .refresh-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 30px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-top: 10px;
    }
    .refresh-btn:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 WhatsApp Authentication</h1>
    <p class="subtitle">VU LMS Automation System</p>
    
    <div class="qr-container">
      <img src="${qrUrl}" alt="WhatsApp QR Code" class="qr-code" />
    </div>
    
    <div class="instructions">
      <h3>📱 How to Connect:</h3>
      <ol>
        <li>Open WhatsApp on your phone</li>
        <li>Tap <strong>Menu</strong> or <strong>Settings</strong></li>
        <li>Select <strong>Linked Devices</strong></li>
        <li>Tap <strong>Link a Device</strong></li>
        <li>Scan this QR code</li>
      </ol>
    </div>
    
    <div class="status">⏳ Waiting for scan...</div>
    
    <br>
    <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Page</button>
    
    <script>
      // Auto-refresh every 30 seconds to check status
      setTimeout(() => {
        location.reload();
      }, 30000);
    </script>
  </div>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    console.error('[API] Error getting QR code:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
