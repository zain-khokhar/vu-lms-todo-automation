/**
 * Activity parsing and validation utilities
 */

/**
 * Validate and format activity data
 * @param {Array} activities - Raw activities array
 * @returns {Array} - Validated and formatted activities
 */
export function validateActivities(activities) {
  if (!Array.isArray(activities)) {
    return [];
  }

  return activities.filter(activity => {
    // Must have at least course_code and link
    return activity.course_code && activity.link;
  }).map(activity => ({
    course_code: activity.course_code || '',
    activity_type: activity.activity_type || 'Unknown',
    title: activity.title || 'Untitled Activity',
    due_date: activity.due_date || '',
    link: activity.link || ''
  }));
}

/**
 * Format student result as JSON
 * @param {string} username - Student username
 * @param {string} whatsapp - WhatsApp number
 * @param {Array} activities - Activities array
 * @param {string} status - Status (success/error)
 * @param {string} errorMessage - Error message if status is error
 * @returns {Object} - Formatted result object
 */
export function formatStudentResult(username, whatsapp, activities, status = 'success', errorMessage = null) {
  const result = {
    student: username,
    whatsapp: whatsapp,
    activities: validateActivities(activities),
    status: status
  };

  if (errorMessage) {
    result.error = errorMessage;
  }

  return result;
}

/**
 * Parse date string to YYYY-MM-DD format
 * @param {string} dateString - Date string in various formats
 * @returns {string} - Formatted date string
 */
export function parseDate(dateString) {
  if (!dateString) return '';

  try {
    // Handle different date formats
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    return dateString;
  }
}
