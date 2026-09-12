/**
 * Format estimated reading time in seconds to human-readable format.
 * 
 * Examples:
 * - 34 seconds → "34 sec"
 * - 72 seconds → "1 min 12 sec"
 * - 125 seconds → "2 min 05 sec"
 * 
 * @param {number} seconds - Estimated reading time in seconds
 * @returns {string} Formatted time string
 */
export function formatReadTime(seconds) {
  if (!seconds || seconds < 0) {
    return "0 sec";
  }

  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (remainingSeconds === 0) {
    return `${minutes} min`;
  }

  // Pad seconds with leading zero if needed
  const secStr = remainingSeconds < 10 ? `0${remainingSeconds}` : `${remainingSeconds}`;
  return `${minutes} min ${secStr} sec`;
}
