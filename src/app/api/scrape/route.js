import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { loginToLMS, navigateToCalendar, scrapeActivities, logout, wait } from '@/lib/scraper';
import { formatStudentResult } from '@/lib/activityParser';

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

    console.log(`[API] Starting automation for ${students.length} student(s)`);

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

      console.log(`\n[API] Processing student ${i + 1}/${students.length}: ${username}`);

      // Create new page for this student
      const page = await browser.newPage();
      
      // Set viewport
      await page.setViewport({ width: 1280, height: 800 });

      // Block unnecessary resources to reduce memory usage and improve speed
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      try {
        // Step 1: Login
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
            console.log('[API] Waiting 60 seconds before next student...');
            await wait(parseInt(process.env.WAIT_TIME_MS) || 60000);
          }
          continue;
        }

        // Step 2: Navigate to Activity Calendar
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
            console.log('[API] Waiting 60 seconds before next student...');
            await wait(parseInt(process.env.WAIT_TIME_MS) || 60000);
          }
          continue;
        }

        // Step 3: Scrape activities
        const activities = await scrapeActivities(page);

        // Step 4: Logout
        await logout(page);

        // Add successful result
        results.push(
          formatStudentResult(
            username,
            whatsapp,
            activities,
            'success'
          )
        );

        console.log(`[API] ✓ Completed processing for ${username}: ${activities.length} activities found`);

      } catch (error) {
        console.error(`[API] Error processing ${username}:`, error.message);
        
        results.push(
          formatStudentResult(
            username,
            whatsapp,
            [],
            'error',
            `Processing error: ${error.message}`
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
              console.warn(`[API] Page close warning: ${closeError.message}`);
            });
          }
        } catch (cleanupError) {
          console.warn(`[API] Cleanup warning for ${username}: ${cleanupError.message}`);
        }
      }

      // Wait exactly 60 seconds before processing next student (except for the last one)
      if (i < students.length - 1) {
        console.log('[API] Waiting 60 seconds before next student...');
        await wait(parseInt(process.env.WAIT_TIME_MS) || 60000);
      }
    }

    console.log('\n[API] ✓ Automation completed for all students');

    return NextResponse.json({
      success: true,
      total: students.length,
      results: results
    });

  } catch (error) {
    console.error('[API] Fatal error:', error);
    
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
          console.warn('[API] Browser close warning:', err.message);
        });
        
        console.log('[API] Browser closed');
      } catch (browserCleanupError) {
        console.warn('[API] Browser cleanup warning:', browserCleanupError.message);
      }
    }
  }
}
