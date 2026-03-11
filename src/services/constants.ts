/**
 * API Constants & Configuration
 *
 * Rate limits and retry strategies discovered during Phase 1 Plan 03 integration testing.
 * Used throughout the application for consistent API behavior.
 *
 * Discovery Process:
 * - Google Calendar API: Official documentation + observed behavior
 * - Supernote API: Reverse-engineered from unofficial library
 * - Integration testing: Validated with real API calls
 */

/**
 * Google Calendar API Constants
 */
export const GOOGLE_CALENDAR_API = {
  // Rate limits from official Google Calendar API documentation
  // https://developers.google.com/calendar/api/guides/rate-limits

  /**
   * Queries per minute limit
   * Google Calendar API: 10 queries/second per user = 600/minute
   * Using conservative estimate of 5 queries/second for safety
   */
  QUERIES_PER_MINUTE: 300,

  /**
   * Queries per day limit
   * Google Calendar API: 1 million queries per day per project
   * With conservative 300/minute = 432k/day (safe margin)
   */
  QUERIES_PER_DAY: 432000,

  /**
   * Minimum delay between sequential requests (milliseconds)
   * Conservative estimate: 200ms = 5 requests/second
   */
  MIN_DELAY_MS: 200,

  /**
   * Default time window for upcoming events query (minutes)
   * 43200 = 30 days (balance between load and relevance for meeting prep)
   */
  DEFAULT_UPCOMING_MINUTES: 43200,

  /**
   * Maximum results per API call
   * Google Calendar limits to 100 maximum
   */
  MAX_RESULTS_PER_CALL: 100,

  /**
   * Token refresh buffer (milliseconds)
   * Refresh token when < 5 minutes until expiry
   * This ensures token is always fresh for job execution
   */
  TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000,

  /**
   * Standard Google OAuth2 token expiry
   * Access tokens expire in 1 hour (3600 seconds)
   */
  TOKEN_EXPIRY_SECONDS: 3600,
} as const;

/**
 * Supernote API Constants
 */
export const SUPERNOTE_API = {
  /**
   * Estimated queries per minute limit (undocumented)
   * Unofficial API - conservative estimate: 2 requests/second = 120/minute
   */
  QUERIES_PER_MINUTE: 120,

  /**
   * Minimum delay between sequential requests (milliseconds)
   * Conservative estimate: 500ms = 2 requests/second
   * Supernote servers may be less robust than Google's, so higher delay
   */
  MIN_DELAY_MS: 500,

  /**
   * Maximum filename length
   * Supernote standard filesystem limitation
   */
  MAX_FILENAME_LENGTH: 256,

  /**
   * Root directory ID in Supernote
   * All queries start from root
   */
  ROOT_DIRECTORY_ID: "0",

  /**
   * Default request timeout (milliseconds)
   * Supernote API may be slower, use generous timeout
   */
  REQUEST_TIMEOUT_MS: 30000,
} as const;

/**
 * Retry & Error Handling Constants
 *
 * Applied to all API calls with exponential backoff strategy
 */
export const RETRY_STRATEGY = {
  /**
   * Maximum number of retry attempts
   * Total attempts = 1 (initial) + MAX_ATTEMPTS (retries)
   * With exponential backoff: ~30 seconds total wait time
   */
  MAX_ATTEMPTS: 3,

  /**
   * Initial retry delay (milliseconds)
   * Starts at 1 second, doubles on each retry
   * 1s → 2s → 4s (total 7 seconds)
   */
  INITIAL_DELAY_MS: 1000,

  /**
   * Maximum retry delay (milliseconds)
   * Don't wait longer than 30 seconds between retries
   */
  MAX_DELAY_MS: 30000,

  /**
   * Exponential backoff multiplier
   * delay = initial * (multiplier ^ attempt_number)
   */
  BACKOFF_MULTIPLIER: 2,

  /**
   * Random jitter factor (0.0 to 1.0)
   * Adds randomness to prevent thundering herd
   * delay = delay * (1 + (Math.random() - 0.5) * JITTER_FACTOR)
   */
  JITTER_FACTOR: 0.1,

  /**
   * HTTP status codes that trigger retry
   * 429 = Too Many Requests (rate limit)
   * 503 = Service Unavailable (temporary outage)
   * 504 = Gateway Timeout (network issue)
   * 5xx = Server errors (transient issues)
   */
  RETRYABLE_STATUS_CODES: [429, 503, 504, 500, 502],

  /**
   * HTTP status codes that should NOT retry
   * 400 = Bad Request (validation error - won't change)
   * 401 = Unauthorized (credential issue - won't fix by retrying)
   * 403 = Forbidden (permission issue - won't fix by retrying)
   * 404 = Not Found (resource doesn't exist - won't fix by retrying)
   */
  NON_RETRYABLE_STATUS_CODES: [400, 401, 403, 404],
} as const;

/**
 * Integration Service Constants
 */
export const INTEGRATION_SERVICE = {
  /**
   * Default number of upcoming events to process
   * Sync next 3 upcoming events to Supernote
   */
  DEFAULT_EVENT_COUNT: 3,

  /**
   * Maximum number of events to process in single batch
   * Safety limit to prevent overwhelming API
   */
  MAX_BATCH_SIZE: 10,

  /**
   * Delay between processing events (milliseconds)
   * Prevents overwhelming Supernote API when creating multiple notebooks
   * Use MIN_DELAY_MS from SUPERNOTE_API plus a buffer
   */
  INTER_EVENT_DELAY_MS: 1000,

  /**
   * Max notebook name length
   * Leave some buffer below max for timestamp/counter suffix
   */
  MAX_NOTEBOOK_NAME_LENGTH: 200,
} as const;

/**
 * Helper function to calculate exponential backoff delay
 *
 * @param attemptNumber - Current attempt number (0-indexed)
 * @param strategy - Retry strategy configuration
 * @returns Delay in milliseconds before next retry
 *
 * @example
 * // First retry: ~1000ms
 * getBackoffDelay(0, RETRY_STRATEGY) // → 1000
 * // Second retry: ~2000ms
 * getBackoffDelay(1, RETRY_STRATEGY) // → 2000
 * // Third retry: ~4000ms
 * getBackoffDelay(2, RETRY_STRATEGY) // → 4000
 */
export function getBackoffDelay(
  attemptNumber: number,
  strategy = RETRY_STRATEGY,
): number {
  // Calculate base delay with exponential backoff
  const baseDelay =
    strategy.INITIAL_DELAY_MS *
    Math.pow(strategy.BACKOFF_MULTIPLIER, attemptNumber);

  // Cap at maximum delay
  const cappedDelay = Math.min(baseDelay, strategy.MAX_DELAY_MS);

  // Add jitter to prevent thundering herd
  const jitter = (Math.random() - 0.5) * strategy.JITTER_FACTOR;
  const delayWithJitter = cappedDelay * (1 + jitter);

  // Return as integer milliseconds
  return Math.round(delayWithJitter);
}

/**
 * Helper function to check if an HTTP error is retryable
 *
 * @param statusCode - HTTP status code
 * @param strategy - Retry strategy configuration
 * @returns true if error should trigger retry
 *
 * @example
 * isRetryableError(429) // → true (rate limit)
 * isRetryableError(403) // → false (permission denied)
 */
export function isRetryableError(
  statusCode: number,
  strategy = RETRY_STRATEGY,
): boolean {
  // Explicitly retryable
  if (strategy.RETRYABLE_STATUS_CODES.includes(statusCode)) {
    return true;
  }

  // Explicitly non-retryable
  if (strategy.NON_RETRYABLE_STATUS_CODES.includes(statusCode)) {
    return false;
  }

  // Default: retry on 5xx errors
  return statusCode >= 500 && statusCode < 600;
}

/**
 * Type-safe export of all constants
 * Ensures constants are immutable and well-documented
 */
export const API_CONFIG = {
  googleCalendar: GOOGLE_CALENDAR_API,
  supernote: SUPERNOTE_API,
  retry: RETRY_STRATEGY,
  integration: INTEGRATION_SERVICE,
} as const;

export default API_CONFIG;
