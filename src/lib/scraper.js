/**
 * Core scraping utilities for VU LMS automation
 */

/**
 * Login to VU LMS
 * @param {Page} page - Puppeteer page instance
 * @param {string} username - Student username
 * @param {string} password - Student password
 * @returns {Promise<boolean>} - True if login successful
 */
export async function loginToLMS(page, username, password) {
  try {
    console.log(`[LOGIN] Attempting login for user: ${username}`);
    
    // Set a realistic user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to login page
    await page.goto(process.env.LMS_URL || 'https://vulms.vu.edu.pk/', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    // Wait a bit for page to fully load
    await wait(2000);

    // Wait for login form elements using the correct IDs
    await page.waitForSelector('#txtStudentID', { timeout: 15000 });
    await page.waitForSelector('#txtPassword', { timeout: 15000 });
    await page.waitForSelector('#ibtnLogin', { timeout: 15000 });

    console.log('[LOGIN] Login form detected, entering credentials...');

    // Clear fields first (in case of cached values)
    await page.click('#txtStudentID', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    
    await page.click('#txtPassword', { clickCount: 3 });
    await page.keyboard.press('Backspace');

    // Enter credentials with realistic delays
    await page.type('#txtStudentID', username, { delay: 100 });
    await wait(500);
    await page.type('#txtPassword', password, { delay: 100 });
    await wait(500);

    console.log('[LOGIN] Clicking login button...');

    // Click login button and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
      page.click('#ibtnLogin')
    ]);

    // Wait for page to stabilize
    await wait(2000);

    // Check if we're on the student portal (successful login)
    const currentUrl = page.url();
    
    // VU LMS redirects to Home.aspx or StudentPortal after successful login
    if (currentUrl.includes('Home.aspx') || 
        currentUrl.includes('StudentPortal') || 
        currentUrl.includes('Default') || 
        currentUrl.includes('Student')) {
      console.log(`[LOGIN] ✓ Login successful for: ${username} - URL: ${currentUrl}`);
      return true;
    } else {
      console.log(`[LOGIN] ✗ Login failed for: ${username} - URL: ${currentUrl}`);
      return false;
    }
  } catch (error) {
    console.error(`[LOGIN] Error during login for ${username}:`, error.message);
    return false;
  }
}

/**
 * Navigate to Activity Calendar by clicking sidebar button
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<boolean>} - True if navigation successful
 */
export async function navigateToCalendar(page) {
  try {
    console.log('[NAVIGATION] Clicking Activity Calendar button in sidebar...');
    
    // Wait for the sidebar button to be present
    await page.waitForSelector('#lbtnActivityCalendar', { 
      timeout: 15000 
    });
    
    console.log('[NAVIGATION] Activity Calendar button found, preparing to click...');
    
    // Scroll the element into view and ensure it's clickable
    await page.evaluate(() => {
      const element = document.querySelector('#lbtnActivityCalendar');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    
    // Wait a moment for scroll to complete
    await wait(500);
    
    // Try normal click first with navigation wait
    let clickSuccess = false;
    try {
      console.log('[NAVIGATION] Attempting normal click...');
      await Promise.all([
        page.waitForNavigation({ 
          waitUntil: 'domcontentloaded', 
          timeout: 30000 
        }).catch(() => {
          // Sometimes clicking triggers AJAX instead of navigation
          console.log('[NAVIGATION] No navigation detected, content may load via AJAX');
        }),
        page.click('#lbtnActivityCalendar')
      ]);
      clickSuccess = true;
      console.log('[NAVIGATION] Normal click succeeded');
    } catch (clickError) {
      console.warn('[NAVIGATION] Normal click failed:', clickError.message);
      console.log('[NAVIGATION] Attempting JavaScript click fallback...');
      
      // Fallback: Click using JavaScript
      const jsClickResult = await page.evaluate(() => {
        const element = document.querySelector('#lbtnActivityCalendar');
        if (element) {
          element.click();
          return true;
        }
        return false;
      });
      
      if (jsClickResult) {
        console.log('[NAVIGATION] JavaScript click succeeded');
        clickSuccess = true;
        // Wait for potential navigation
        await page.waitForNavigation({ 
          waitUntil: 'domcontentloaded', 
          timeout: 30000 
        }).catch(() => {
          console.log('[NAVIGATION] No navigation after JS click, assuming AJAX load');
        });
      } else {
        throw new Error('Element not found for JavaScript click');
      }
    }

    if (!clickSuccess) {
      throw new Error('Failed to click Activity Calendar button');
    }

    // Wait for page to stabilize
    await wait(2000);

    // Wait for the main content div to be present
    console.log('[NAVIGATION] Waiting for activities container...');
    await page.waitForSelector('#MainContent_divMain', { 
      visible: true,
      timeout: 20000 
    });
    
    // Give the dynamic content extra time to load
    await wait(3000);
    
    console.log('[NAVIGATION] ✓ Successfully navigated to Activity Calendar');
    return true;
  } catch (error) {
    console.error('[NAVIGATION] Error navigating to calendar:', error.message);
    
    // Try to get current URL for debugging
    try {
      const currentUrl = page.url();
      console.error(`[NAVIGATION] Current URL: ${currentUrl}`);
    } catch (urlError) {
      console.error('[NAVIGATION] Could not get current URL');
    }
    
    return false;
  }
}

/**
 * Scrape activities from the To-Do Calendar (FullCalendar widget)
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<Array>} - Array of activity objects
 */
export async function scrapeActivities(page) {
  try {
    console.log('[SCRAPING] Extracting activities from FullCalendar widget...');

    // Wait for dynamic content to fully load
    await wait(3000);

    // Verify the calendar div is present
    const calendarExists = await page.$('#calendar');
    if (!calendarExists) {
      console.error('[SCRAPING] FullCalendar widget not found!');
      return [];
    }

    console.log('[SCRAPING] FullCalendar widget found, parsing events...');

    // Extract activities from the FullCalendar widget
    const activities = await page.evaluate(() => {
      const calendar = document.querySelector('#calendar');
      if (!calendar) {
        console.error('Calendar not found in page context');
        return [];
      }

      const activityMap = new Map(); // Use Map to deduplicate activities
      
      // Find all calendar event elements
      const eventElements = calendar.querySelectorAll('a.fc-day-grid-event');
      
      console.log(`Found ${eventElements.length} event elements`);
      
      eventElements.forEach(eventEl => {
        try {
          // Extract title
          const titleEl = eventEl.querySelector('.fc-title');
          if (!titleEl) return;
          
          const title = titleEl.innerText.trim();
          const link = eventEl.href;
          
          // Parse course code from title (e.g., "CS201P: Quiz")
          const courseCodeMatch = title.match(/^([A-Z]{2,4}\d{3,4}[A-Z]?)/);
          const courseCode = courseCodeMatch ? courseCodeMatch[1] : '';
          
          // Determine activity type from title and link
          let activityType = 'Unknown';
          const lowerTitle = title.toLowerCase();
          const lowerLink = link.toLowerCase();
          
          if (lowerTitle.includes('assignment') || lowerLink.includes('assignment')) {
            activityType = 'Assignment';
          } else if (lowerTitle.includes('quiz') && lowerTitle.includes('result')) {
            activityType = 'Quiz Result';
          } else if (lowerTitle.includes('quiz') || lowerLink.includes('quiz')) {
            activityType = 'Quiz';
          } else if (lowerTitle.includes('gdb') && lowerTitle.includes('result')) {
            activityType = 'GDB Result';
          } else if (lowerTitle.includes('gdb') || lowerLink.includes('gdb')) {
            activityType = 'GDB';
          } else if (lowerTitle.includes('fee') || lowerTitle.includes('challan') || lowerLink.includes('challan')) {
            activityType = 'Pending Fee';
          }
          
          // Determine if this is a start or end point
          const isStart = eventEl.classList.contains('fc-start');
          const isEnd = eventEl.classList.contains('fc-end');
          
          // Find the parent event container to get date information
          let eventContainer = eventEl.closest('.fc-event-container');
          if (!eventContainer) return;
          
          // Find all date cells in the current week row
          let currentRow = eventContainer.closest('.fc-row');
          if (!currentRow) return;
          
          // Get all date cells in this row
          const dateCells = currentRow.querySelectorAll('td.fc-day[data-date]');
          
          // Find which date cell(s) this event spans
          let startDate = null;
          let endDate = null;
          
          // Get the container's parent TD to find its position
          const containerTd = eventContainer.closest('td');
          if (containerTd) {
            const colspan = parseInt(containerTd.getAttribute('colspan') || '1');
            
            // Find the index of this container in the row
            const allCells = Array.from(currentRow.querySelectorAll('td.fc-day[data-date], td.fc-event-container'));
            let containerIndex = allCells.indexOf(containerTd);
            
            // Find the corresponding date cells
            const dateCellsArray = Array.from(dateCells);
            
            // If it's a start event, use the first date in the span
            if (isStart && dateCellsArray.length > 0) {
              // Find the date cell that corresponds to this position
              let dateIndex = 0;
              for (let i = 0; i < allCells.length && i < containerIndex; i++) {
                if (allCells[i].classList.contains('fc-day')) {
                  dateIndex++;
                }
              }
              startDate = dateCellsArray[dateIndex]?.getAttribute('data-date') || null;
            }
            
            // If it's an end event, use the last date in the span
            if (isEnd && dateCellsArray.length > 0) {
              let dateIndex = 0;
              for (let i = 0; i < allCells.length && i <= containerIndex; i++) {
                if (allCells[i].classList.contains('fc-day')) {
                  dateIndex++;
                }
              }
              // Add colspan to get the end date
              dateIndex = Math.min(dateIndex + colspan - 1, dateCellsArray.length - 1);
              endDate = dateCellsArray[dateIndex]?.getAttribute('data-date') || null;
            }
          }
          
          // Create a unique key for this activity
          const activityKey = `${courseCode}|${title}`;
          
          // Update or create activity entry
          if (activityMap.has(activityKey)) {
            const existing = activityMap.get(activityKey);
            // Update dates if we found more specific information
            if (startDate && !existing.start_date) {
              existing.start_date = startDate;
            }
            if (endDate) {
              existing.due_date = endDate;
            }
          } else {
            activityMap.set(activityKey, {
              course_code: courseCode || 'N/A',
              activity_type: activityType,
              title: title,
              start_date: startDate || '',
              due_date: endDate || '',
              link: link
            });
          }
        } catch (err) {
          console.error('Error parsing event:', err);
        }
      });
      
      // Convert map to array
      const activityList = Array.from(activityMap.values());
      
      // Filter out Result activities if needed (optional)
      return activityList.filter(activity => 
        activity.title && activity.link
      );
    });

    console.log(`[SCRAPING] ✓ Extracted ${activities.length} unique activities`);
    
    // If no activities found, log the content for debugging
    if (activities.length === 0) {
      console.warn('[SCRAPING] No activities found. Checking calendar content...');
      try {
        const htmlContent = await page.$eval('#calendar', el => el.innerHTML);
        console.log('[SCRAPING] Calendar HTML preview:', htmlContent.substring(0, 1000));
      } catch (htmlError) {
        console.error('[SCRAPING] Could not read calendar HTML:', htmlError.message);
      }
    } else {
      // Log sample activities for debugging
      console.log('[SCRAPING] Sample activities:', JSON.stringify(activities.slice(0, 3), null, 2));
    }
    
    return activities;
  } catch (error) {
    console.error('[SCRAPING] Error scraping activities:', error.message);
    console.error('[SCRAPING] Stack trace:', error.stack);
    return [];
  }
}

/**
 * Logout from VU LMS
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<boolean>} - True if logout successful
 */
export async function logout(page) {
  try {
    console.log('[LOGOUT] Logging out...');
    
    // Wait for logout link to be present
    await page.waitForSelector('#lnkLogout', { timeout: 10000 });
    
    // Click logout and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.click('#lnkLogout')
    ]);
    
    // Wait for page to stabilize
    await wait(1000);
    
    console.log('[LOGOUT] ✓ Successfully logged out');
    return true;
  } catch (error) {
    console.error('[LOGOUT] Error during logout (non-critical):', error.message);
    // Return true anyway as logout errors are non-critical
    return true;
  }
}

/**
 * Wait utility
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
