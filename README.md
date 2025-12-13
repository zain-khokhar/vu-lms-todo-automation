# 📚 VU LMS Todo Automation

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=for-the-badge&logo=next.js)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge&logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)
![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot-25D366?style=for-the-badge&logo=whatsapp)
![Puppeteer](https://img.shields.io/badge/Puppeteer-Automation-40B5A4?style=for-the-badge&logo=puppeteer)

**🚀 Automated LMS Activity Scraper & WhatsApp Notification System**

*Never miss an assignment, quiz, or GDB deadline again!*

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [API](#-api-endpoints) • [Tech Stack](#-tech-stack)

</div>

---

## 🎯 Overview

**VU LMS Todo Automation** is a powerful, full-stack automation tool designed for **Virtual University of Pakistan** students. It automatically scrapes your LMS Activity Calendar, stores upcoming activities in a database, and sends **WhatsApp notifications** to remind you of deadlines.

### 🔥 Why Use This?

- ⏰ **Save Time** - No need to manually check LMS daily
- 📱 **WhatsApp Alerts** - Get notified directly on your phone
- 🗓️ **Smart Scheduling** - Automatic reminders before deadlines
- 👥 **Multi-Student Support** - Process multiple students at once
- 🔄 **Auto-Sync** - Background scheduler keeps data updated

---

## ✨ Features

### 🤖 Web Automation
- **Headless Browser Automation** using Puppeteer
- Secure LMS login with credential handling
- FullCalendar widget parsing for activity extraction
- Automatic session management and logout

### 📊 Activity Management
- **24+ Activity Types** supported (Assignments, Quizzes, GDBs, etc.)
- Duplicate detection using SHA-256 hashing
- Past activity filtering
- MongoDB persistence with indexing

### 📱 WhatsApp Integration
- **Real-time Notifications** via WhatsApp Web.js
- QR Code authentication (scan once, stay logged in)
- Formatted activity summaries
- Scheduled reminder notifications

### 🎨 Modern UI
- **Next.js 16** App Router architecture
- Responsive Tailwind CSS design
- Real-time processing status
- JSON result viewer

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 |
| **Backend** | Node.js, Next.js API Routes |
| **Database** | MongoDB Atlas, Mongoose ODM |
| **Automation** | Puppeteer, whatsapp-web.js |
| **Scheduling** | node-cron, Custom Scheduler |
| **Logging** | Winston Logger |

---

## 📦 Installation

### Prerequisites

- **Node.js** v20 or higher
- **MongoDB** Atlas account (free tier works)
- **Chrome/Chromium** browser (for Puppeteer)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/lms-todo-automation.git
cd lms-todo-automation

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# MongoDB Connection
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/lms_automation

# LMS Configuration
LMS_URL=https://vulms.vu.edu.pk/

# Puppeteer Settings
HEADLESS=false
WAIT_TIME_MS=60000
```

---

## 🚀 Usage

### 1. Start the Application

```bash
npm run dev
```

This starts:
- 🌐 **Next.js App** on `http://localhost:3000`
- 📡 **WhatsApp Server** on `http://localhost:3001`
- ⏱️ **Background Scheduler** for notifications

### 2. Authenticate WhatsApp

1. Open `http://localhost:3000/api/whatsapp/qr`
2. Scan QR code with WhatsApp mobile app
3. Wait for "Client is ready" message

### 3. Add Students & Process

1. Open `http://localhost:3000`
2. Enter student credentials and WhatsApp number
3. Click "Start Processing"
4. Receive activity summary on WhatsApp!

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/scrape` | Scrape activities for students |
| `GET` | `/api/whatsapp/qr` | Get WhatsApp QR code |
| `GET` | `/api/whatsapp/status` | Check WhatsApp connection |
| `POST` | `/api/notifications/process` | Process pending notifications |

### Example Request

```javascript
// POST /api/scrape
{
  "students": [
    {
      "username": "BC240436388",
      "password": "your_password",
      "whatsapp": "+923001234567"
    }
  ]
}
```

---

## 📁 Project Structure

```
lms-todo-automation/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes
│   │   │   ├── scrape/        # LMS Scraping
│   │   │   ├── whatsapp/      # WhatsApp APIs
│   │   │   └── notifications/ # Notification APIs
│   │   ├── page.js            # Main UI
│   │   └── layout.js          # Root Layout
│   ├── lib/                   # Utilities
│   │   ├── scraper.js         # Puppeteer automation
│   │   ├── whatsapp.js        # WhatsApp client
│   │   ├── scheduler.js       # Notification scheduler
│   │   ├── db.js              # MongoDB connection
│   │   └── logger.js          # Winston logger
│   └── models/                # Mongoose Models
│       ├── User.js
│       ├── Activity.js
│       └── Notification.js
├── server.js                  # Background services
├── package.json
└── .env
```

---

## 🔔 Notification System

### Automatic Scheduling

When activities are scraped, the system automatically schedules:

1. **Start Notification** - When activity opens
2. **Reminder Notification** - 1 day before deadline

### Background Processing

The scheduler runs every **5 minutes** to:
- Check pending notifications
- Send WhatsApp messages
- Retry failed notifications (up to 3 attempts)

---

## 🛡️ Security

- ⚠️ **Never commit `.env` files**
- 🔐 WhatsApp session stored locally in `.wwebjs_auth/`
- 🔑 Passwords are used only for LMS login (not stored)
- 📝 All sensitive files in `.gitignore`

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Zain Khokhar**

- GitHub: [@zainkhokhar](https://github.com/zainkhokhar)

---

## ⭐ Show Your Support

Give a ⭐ if this project helped you!

---

<div align="center">

**Built with ❤️ for VU Students**

*Automate your LMS, focus on learning!*

</div>
