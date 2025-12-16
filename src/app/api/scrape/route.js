import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { loginToLMS, navigateToCalendar, scrapeActivities, logout, wait } from '@/lib/scraper';
import { formatStudentResult } from '@/lib/activityParser';
import db from '@/lib/db';
import logger from '@/lib/logger';
import User from '@/models/User';
import Activity from '@/models/Activity';
import scheduler from '@/lib/scheduler';

// Format single activity message for WhatsApp - SIMPLIFIED FORMAT
function formatActivityMessage(activity) {
  const dueDate = new Date(activity.due_date);
  const formattedDueDate = dueDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  let message = `*${activity.course_code}*\n`;
  message += `${activity.activity_type}\n`;
  message += `Due: ${formattedDueDate}`;

  return message;
}

// Filter activities for next 7 days from today (within current month)
function getUpcomingActivities(activities) {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Start of today
  
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  sevenDaysLater.setHours(23, 59, 59, 999); // End of 7th day
  
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return activities.filter(activity => {
    if (!activity.due_date) return false;
    
    const dueDate = new Date(activity.due_date);
    dueDate.setHours(12, 0, 0, 0); // Normalize to noon
    
    const dueDateMonth = dueDate.getMonth();
    const dueDateYear = dueDate.getFullYear();
    
    // Must be: 1) from today onwards, 2) within 7 days, 3) in current month
    const isInCurrentMonth = dueDateYear === currentYear && dueDateMonth === currentMonth;
    const isWithin7Days = dueDate >= now && dueDate <= sevenDaysLater;
    
    return isInCurrentMonth && isWithin7Days;
  }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)); // Sort by due date
}

export async function POST(request) {
  let browser = null;
  const results = [];

  try {
    const { students } = await request.json();

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: students array is required' },
        { status: 400 }
      );
    }

    logger.info(`[API] Starting automation for ${students.length} student(s)`);

    // Connect to database
    await db.connect();

    // Launch browser with enhanced stability settings
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'true',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-web-security',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
        '--disable-features=VizDisplayCompositor',
        '--window-size=1280,800'
      ],
      defaultViewport: {
        width: 1280,
        height: 800
      },
      ignoreHTTPSErrors: true,
      timeout: 60000
    });

    // Process each student sequentially
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const { username, password, whatsapp } = student;

      logger.info(`[API] Processing student ${i + 1}/${students.length}: ${username}`);

      // Create new page for this student
      const page = await browser.newPage();
      
      // Set viewport
      await page.setViewport({ width: 1280, height: 800 });

      // Block unnecessary resources to reduce memory usage and improve speed
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        try {
          const resourceType = req.resourceType();
          if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            req.abort().catch(() => {});
          } else {
            req.continue().catch(() => {});
          }
        } catch (error) {
          // Ignore interception errors to prevent crashes
          req.continue().catch(() => {});
        }
      });

      try {
        // Step 1: Find or create user in database
        let user = await User.findOne({ username });
        
        if (!user) {
          logger.info(`[API] Creating new user: ${username}`);
          user = await User.create({
            username,
            password,
            whatsapp,
            isActive: true
          });
        } else {
          logger.info(`[API] User exists: ${username}`);
          // Update WhatsApp number if changed
          if (user.whatsapp !== whatsapp) {
            user.whatsapp = whatsapp;
            await user.save();
          }
        }

        // Step 2: Login
        const loginSuccess = await loginToLMS(page, username, password);
        
        if (!loginSuccess) {
          results.push(
            formatStudentResult(
              username,
              whatsapp,
              [],
              'error',
              'Login failed. Please check credentials.'
            )
          );
          await page.close();
          
          // Wait before next student (even on error)
          if (i < students.length - 1) {
            logger.info('[API] Waiting 60 seconds before next student...');
            await wait(parseInt(process.env.WAIT_TIME_MS) || 60000);
          }
          continue;
        }

        // Step 3: Navigate to Activity Calendar
        const navSuccess = await navigateToCalendar(page);
        
        if (!navSuccess) {
          results.push(
            formatStudentResult(
              username,
              whatsapp,
              [],
              'error',
              'Failed to navigate to Activity Calendar.'
            )
          );
          await logout(page);
          await page.close();
          
          if (i < students.length - 1) {
            logger.info('[API] Waiting 60 seconds before next student...');
            await wait(parseInt(process.env.WAIT_TIME_MS) || 60000);
          }
          continue;
        }

        // Step 4: Scrape activities
        const activities = await scrapeActivities(page);

        // Step 5: Logout
        await logout(page);

        // Step 6: Process and categorize activities
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Start of today
        
        const pastActivities = [];
        const futureActivities = [];
        let savedCount = 0;
        let scheduledCount = 0;

        for (const activity of activities) {
          try {
            // Parse dates
            const dueDate = activity.due_date ? new Date(activity.due_date) : null;
            const startDate = activity.start_date ? new Date(activity.start_date) : null;

            // Categorize as past or future
            const isPast = !dueDate || dueDate < now;
            
            if (isPast) {
              pastActivities.push(activity);
              logger.info(`[API] Past activity: ${activity.title} (due: ${activity.due_date})`);
              continue; // Don't save past activities
            }

            futureActivities.push(activity);

            // Generate activity hash
            const activityHash = Activity.generateHash(
              user._id,
              activity.course_code,
              activity.title,
              dueDate
            );

            // Check if activity already exists
            let existingActivity = await Activity.findOne({ activityHash });

            if (!existingActivity) {
              // Save new activity to database
              existingActivity = await Activity.create({
                userId: user._id,
                courseCode: activity.course_code,
                activityType: activity.activity_type,
                title: activity.title,
                startDate: startDate,
                dueDate: dueDate,
                link: activity.link,
                activityHash: activityHash
              });

              savedCount++;
              logger.info(`[API] Saved new activity: ${activity.title}`);

              // Schedule notifications for this activity
              const notifications = await scheduler.scheduleNotifications(existingActivity);
              scheduledCount += notifications.length;
              logger.info(`[API] Scheduled ${notifications.length} notifications for: ${activity.title}`);
            } else {
              logger.info(`[API] Activity already exists: ${activity.title}`);
            }

          } catch (activityError) {
            logger.error(`[API] Error processing activity ${activity.title}: ${activityError.message}`);
            console.error('[API] Full error:', activityError);
          }
        }

        // Add successful result with ALL activities (past + future)
        results.push({
          ...formatStudentResult(
            username,
            whatsapp,
            activities, // Return ALL activities, not just future
            'success'
          ),
          database: {
            saved: savedCount,
            scheduled: scheduledCount,
            total: activities.length,
            past: pastActivities.length,
            future: futureActivities.length
          }
        });

        logger.info(`[API] ✓ Completed processing for ${username}: ${activities.length} total (${pastActivities.length} past, ${futureActivities.length} future), ${savedCount} new, ${scheduledCount} notifications scheduled`);

        // Queue WhatsApp messages for later sending
        const upcomingWeek = getUpcomingActivities(futureActivities);
        
        if (upcomingWeek.length > 0) {
          logger.info(`[API] Queueing ${upcomingWeek.length} WhatsApp messages for ${username}`);
          
          // Store in results for batch sending after all students processed
          results[results.length - 1].whatsappQueue = upcomingWeek.map(activity => ({
            phone: whatsapp,
            activity: activity,
            studentName: username
          }));
        } else {
          logger.info(`[API] No activities due in next 7 days (current month) for ${username}`);
        }

      } catch (error) {
        // Log full error details for debugging
        logger.error(`[API] Error processing ${username}:`, {
          message: error.message || 'Unknown error',
          stack: error.stack || 'No stack trace available',
          error: error
        });
        
        results.push(
          formatStudentResult(
            username,
            whatsapp,
            [],
            'error',
            `Processing error: ${error.message || error.toString() || 'Unknown error occurred'}`
          )
        );
      } finally {
        // Safe page cleanup to prevent protocol errors
        try {
          // Check if page is still valid before cleanup
          if (page && !page.isClosed()) {
            // Remove all listeners to prevent memory leaks
            page.removeAllListeners();
            
            // Close the page safely
            await page.close().catch((closeError) => {
              logger.warn(`[API] Page close warning: ${closeError.message}`);
            });
          }
        } catch (cleanupError) {
          logger.warn(`[API] Cleanup warning for ${username}: ${cleanupError.message}`);
        }
      }

      // Wait exactly 60 seconds before processing next student (except for the last one)
      if (i < students.length - 1) {
        logger.info('[API] Waiting 60 seconds before next student...');
        await wait(parseInt(process.env.WAIT_TIME_MS) || 60000);
      }
    }

    logger.info('[API] ✓ Automation completed for all students');

    // Process WhatsApp queue - send messages after ensuring WhatsApp is ready
    logger.info('[API] Processing WhatsApp message queue...');
    
    let totalQueued = 0;
    let totalSent = 0;
    let totalFailed = 0;
    
    // Check WhatsApp status first
    try {
      const statusResponse = await fetch('http://localhost:3001/status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const statusData = await statusResponse.json();
      
      if (statusData.status !== 'ready') {
        logger.warn('[API] WhatsApp not ready yet, waiting 5 seconds...');
        await wait(5000);
        
        // Check again
        const retryStatusResponse = await fetch('http://localhost:3001/status');
        const retryStatusData = await retryStatusResponse.json();
        
        if (retryStatusData.status !== 'ready') {
          logger.error('[API] WhatsApp still not ready, messages will not be sent');
          return NextResponse.json({
            success: true,
            total: students.length,
            results: results,
            whatsapp: {
              status: 'not_ready',
              queued: totalQueued,
              sent: 0,
              failed: 0
            }
          });
        }
      }
      
      logger.info('[API] WhatsApp is ready, sending queued messages...');
      
      // Send all queued messages
      for (const result of results) {
        if (result.whatsappQueue && result.whatsappQueue.length > 0) {
          totalQueued += result.whatsappQueue.length;
          
          for (const queueItem of result.whatsappQueue) {
            try {
              const activityMessage = formatActivityMessage(queueItem.activity);
              const waResponse = await fetch('http://localhost:3001/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  phone: queueItem.phone, 
                  message: activityMessage 
                })
              });
              
              if (waResponse.ok) {
                totalSent++;
                logger.info(`[API] ✓ Sent WhatsApp to ${queueItem.phone}: ${queueItem.activity.title}`);
              } else {
                totalFailed++;
                const waError = await waResponse.json();
                logger.warn(`[API] WhatsApp send failed for ${queueItem.activity.title}: ${waError.error}`);
              }
              
              // Delay between messages to avoid rate limiting
              await wait(1500);
            } catch (waError) {
              totalFailed++;
              logger.error(`[API] Failed to send WhatsApp for ${queueItem.activity.title}:`, waError.message);
            }
          }
        }
      }
      
      logger.info(`[API] ✓ WhatsApp queue processed: ${totalSent}/${totalQueued} sent, ${totalFailed} failed`);
      
    } catch (waStatusError) {
      logger.error('[API] Error checking WhatsApp status:', waStatusError.message);
    }

    return NextResponse.json({
      success: true,
      total: students.length,
      results: results,
      whatsapp: {
        status: 'ready',
        queued: totalQueued,
        sent: totalSent,
        failed: totalFailed
      }
    });

  } catch (error) {
    logger.error('[API] Fatal error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        results: results
      },
      { status: 500 }
    );
  } finally {
    // Close browser safely
    if (browser) {
      try {
        // Get all pages before closing
        const pages = await browser.pages();
        
        // Close all remaining pages safely
        for (const page of pages) {
          try {
            if (page && !page.isClosed()) {
              await page.close().catch(() => {});
            }
          } catch (pageErr) {
            // Ignore individual page close errors
          }
        }
        
        // Close the browser
        await browser.close().catch((err) => {
          logger.warn('[API] Browser close warning:', err.message);
        });
        
        logger.info('[API] Browser closed');
      } catch (browserCleanupError) {
        logger.warn('[API] Browser cleanup warning:', browserCleanupError.message);
      }
    }
  }
}
