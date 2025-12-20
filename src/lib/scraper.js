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
 * Parse date from Due Date column (handles formats like "Dec 26, 2025 11:59 PM" or "Jan 05, 2026")
 * @param {string} dateText - Date text from table cell (may include "X days left" text)
 * @returns {Date|null} - Parsed date or null if invalid
 */
function parseDueDate(dateText) {
  if (!dateText) return null;
  
  try {
    // Extract just the date part (before any <br> or newline)
    const datePart = dateText.split('<br>')[0].split('\n')[0].trim();
    
    // Parse the date - handles formats like "Dec 26, 2025 11:59 PM" or "Jan 05, 2026"
    const parsed = new Date(datePart);
    
    // Check if valid
    if (isNaN(parsed.getTime())) {
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('Error parsing date:', dateText, error);
    return null;
  }
}

/**
 * Check if a date is within the next 7 days
 * @param {Date} dueDate - Due date to check
 * @param {Date} today - Current date
 * @returns {boolean} - True if within next 7 days
 */
function isWithinNext7Days(dueDate, today) {
  if (!dueDate || !(dueDate instanceof Date)) return false;
  
  // Set time to start of day for accurate comparison
  const dueDateStart = new Date(dueDate);
  dueDateStart.setHours(0, 0, 0, 0);
  
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  
  // Calculate 7 days from today
  const sevenDaysLater = new Date(todayStart);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  
  // Check if due date is between today and 7 days from now (inclusive)
  return dueDateStart >= todayStart && dueDateStart <= sevenDaysLater;
}

/**
 * Scrape activities from the tabCClassic section (tables view)
 * Extracts from Assignments, Quizzes, GDB, and Practicals tables
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<Array>} - Array of activity objects (filtered for next 7 days only)
 */
export async function scrapeActivities(page) {
  try {
    console.log('[SCRAPING] Extracting activities from tabCClassic tables...');

    // Wait for dynamic content to fully load
    await wait(3000);

    // Verify the tabCClassic section is present
    const tabExists = await page.$('#tabCClassic');
    if (!tabExists) {
      console.error('[SCRAPING] tabCClassic section not found!');
      return [];
    }

    console.log('[SCRAPING] tabCClassic section found, parsing tables...');

    // Extract activities from all tables in tabCClassic
    const activities = await page.evaluate(() => {
      const allActivities = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Helper function to parse date from table cell
      function parseDueDateInBrowser(dateText) {
        if (!dateText) return null;
        
        try {
          // Clean up the text - remove extra whitespace and newlines
          const cleanText = dateText.replace(/\s+/g, ' ').trim();
          
          // Extract just the date part (before "X days left" or before <br>)
          let datePart = cleanText;
          
          // Remove the "X days left" part if present
          const daysLeftIndex = cleanText.toLowerCase().indexOf('days left');
          if (daysLeftIndex > 0) {
            datePart = cleanText.substring(0, daysLeftIndex).trim();
          }
          
          // Remove trailing period if present
          if (datePart.endsWith('.')) {
            datePart = datePart.slice(0, -1);
          }
          
          // Parse the date
          const parsed = new Date(datePart);
          
          // Check if valid
          if (isNaN(parsed.getTime())) {
            return null;
          }
          
          return parsed;
        } catch (error) {
          console.error('Error parsing date:', dateText, error);
          return null;
        }
      }
      
      // Helper function to check if date is within next 7 days
      function isWithinNext7DaysInBrowser(dueDate, todayDate) {
        if (!dueDate || !(dueDate instanceof Date)) return false;
        
        const dueDateStart = new Date(dueDate);
        dueDateStart.setHours(0, 0, 0, 0);
        
        const todayStart = new Date(todayDate);
        todayStart.setHours(0, 0, 0, 0);
        
        const sevenDaysLater = new Date(todayStart);
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
        
        return dueDateStart >= todayStart && dueDateStart <= sevenDaysLater;
      }
      
      // Helper function to format date as YYYY-MM-DD
      function formatDate(date) {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      // 1. Extract Assignments from MainContent_gvAssignmentsToDo
      try {
        const assignmentTable = document.querySelector('#MainContent_gvAssignmentsToDo');
        if (assignmentTable) {
          const rows = assignmentTable.querySelectorAll('tbody tr');
          console.log(`Found ${rows.length} rows in Assignments table`);
          
          rows.forEach((row, index) => {
            // Skip header row
            if (index === 0 || row.querySelector('th')) return;
            
            try {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 5) {
                const courseCode = cells[0].textContent.trim();
                const title = cells[1].textContent.trim();
                const openDate = cells[2].textContent.trim();
                const dueDateText = cells[3].textContent.trim();
                const actionCell = cells[4];
                
                // Parse due date
                const dueDate = parseDueDateInBrowser(dueDateText);
                
                // Only include if within next 7 days
                if (dueDate && isWithinNext7DaysInBrowser(dueDate, today)) {
                  // Extract link from action cell
                  const linkElement = actionCell.querySelector('a');
                  let link = '';
                  if (linkElement) {
                    // Extract the actual URL from href or onclick
                    const href = linkElement.getAttribute('href');
                    if (href && href.includes('OpenActivitySection.aspx')) {
                      const urlMatch = href.match(/OpenActivitySection\.aspx\?[^"']+/);
                      if (urlMatch) {
                        link = urlMatch[0];
                      }
                    }
                  }
                  
                  allActivities.push({
                    course_code: courseCode,
                    activity_type: 'Assignment',
                    title: title,
                    start_date: openDate,
                    due_date: formatDate(dueDate),
                    due_date_raw: dueDateText,
                    link: link || '#'
                  });
                }
              }
            } catch (err) {
              console.error('Error parsing assignment row:', err);
            }
          });
        } else {
          console.log('Assignments table not found');
        }
      } catch (err) {
        console.error('Error extracting assignments:', err);
      }
      
      // 2. Extract Quizzes from MainContent_gvQuizzesToDo
      try {
        const quizTable = document.querySelector('#MainContent_gvQuizzesToDo');
        if (quizTable) {
          const rows = quizTable.querySelectorAll('tbody tr');
          console.log(`Found ${rows.length} rows in Quizzes table`);
          
          rows.forEach((row, index) => {
            // Skip header row
            if (index === 0 || row.querySelector('th')) return;
            
            try {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 5) {
                const courseCode = cells[0].textContent.trim();
                const title = cells[1].textContent.trim();
                const openDate = cells[2].textContent.trim();
                const dueDateText = cells[3].textContent.trim();
                
                // Parse due date
                const dueDate = parseDueDateInBrowser(dueDateText);
                
                // Only include if within next 7 days
                if (dueDate && isWithinNext7DaysInBrowser(dueDate, today)) {
                  allActivities.push({
                    course_code: courseCode,
                    activity_type: 'Quiz',
                    title: title,
                    start_date: openDate,
                    due_date: formatDate(dueDate),
                    due_date_raw: dueDateText,
                    link: '#'
                  });
                }
              }
            } catch (err) {
              console.error('Error parsing quiz row:', err);
            }
          });
        } else {
          console.log('Quizzes table not found');
        }
      } catch (err) {
        console.error('Error extracting quizzes:', err);
      }
      
      // 3. Extract GDB from MainContent_gvGDBsToDo
      try {
        const gdbTable = document.querySelector('#MainContent_gvGDBsToDo');
        if (gdbTable) {
          // Check if it's the "no pending" message
          const noPendingText = gdbTable.textContent.toLowerCase();
          if (!noPendingText.includes('no gdb is pending')) {
            const rows = gdbTable.querySelectorAll('tbody tr');
            console.log(`Found ${rows.length} rows in GDB table`);
            
            rows.forEach((row, index) => {
              // Skip header row
              if (index === 0 || row.querySelector('th')) return;
              
              try {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 5) {
                  const courseCode = cells[0].textContent.trim();
                  const title = cells[1].textContent.trim();
                  const openDate = cells[2].textContent.trim();
                  const dueDateText = cells[3].textContent.trim();
                  
                  // Parse due date
                  const dueDate = parseDueDateInBrowser(dueDateText);
                  
                  // Only include if within next 7 days
                  if (dueDate && isWithinNext7DaysInBrowser(dueDate, today)) {
                    allActivities.push({
                      course_code: courseCode,
                      activity_type: 'GDB',
                      title: title,
                      start_date: openDate,
                      due_date: formatDate(dueDate),
                      due_date_raw: dueDateText,
                      link: '#'
                    });
                  }
                }
              } catch (err) {
                console.error('Error parsing GDB row:', err);
              }
            });
          }
        }
      } catch (err) {
        console.error('Error extracting GDB:', err);
      }
      
      // 4. Extract Practicals from MainContent_gvPracticalsToDo
      try {
        const practicalTable = document.querySelector('#MainContent_gvPracticalsToDo');
        if (practicalTable) {
          // Check if it's the "no pending" message
          const noPendingText = practicalTable.textContent.toLowerCase();
          if (!noPendingText.includes('no practical is pending')) {
            const rows = practicalTable.querySelectorAll('tbody tr');
            console.log(`Found ${rows.length} rows in Practicals table`);
            
            rows.forEach((row, index) => {
              // Skip header row
              if (index === 0 || row.querySelector('th')) return;
              
              try {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 5) {
                  const courseCode = cells[0].textContent.trim();
                  const title = cells[1].textContent.trim();
                  const openDate = cells[2].textContent.trim();
                  const dueDateText = cells[3].textContent.trim();
                  
                  // Parse due date
                  const dueDate = parseDueDateInBrowser(dueDateText);
                  
                  // Only include if within next 7 days
                  if (dueDate && isWithinNext7DaysInBrowser(dueDate, today)) {
                    allActivities.push({
                      course_code: courseCode,
                      activity_type: 'Practical',
                      title: title,
                      start_date: openDate,
                      due_date: formatDate(dueDate),
                      due_date_raw: dueDateText,
                      link: '#'
                    });
                  }
                }
              } catch (err) {
                console.error('Error parsing practical row:', err);
              }
            });
          }
        }
      } catch (err) {
        console.error('Error extracting practicals:', err);
      }
      
      console.log(`Extracted ${allActivities.length} activities within next 7 days`);
      return allActivities;
    });

    console.log(`[SCRAPING] ✓ Extracted ${activities.length} activities due within next 7 days`);
    
    // If no activities found, log for debugging
    if (activities.length === 0) {
      console.warn('[SCRAPING] No activities found within next 7 days.');
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
