/**
 * Structured Logger Utility
 *
 * Thin wrapper around console.log for consistent log formatting.
 * Each log line outputs: [ISO-timestamp] [PREFIX] [LEVEL] message
 *
 * No external libraries — console is sufficient for a single-container
 * self-hosted app where Docker handles log collection via stdout.
 */

export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
}

/**
 * Creates a logger instance with a given prefix.
 *
 * @param prefix - Label for the component (e.g., 'Scheduler', 'Server')
 * @returns Logger object with info, warn, error, debug methods
 *
 * @example
 * const log = createLogger('Scheduler');
 * log.info('Job started');
 * // Output: [2026-03-15T10:00:00.000Z] [Scheduler] [INFO] Job started
 */
export function createLogger(prefix: string): Logger {
  const format = (level: string, message: string): string => {
    return `[${new Date().toISOString()}] [${prefix}] [${level}] ${message}`;
  };

  return {
    info: (message: string) => {
      console.log(format("INFO", message));
    },
    warn: (message: string) => {
      console.warn(format("WARN", message));
    },
    error: (message: string) => {
      console.error(format("ERROR", message));
    },
    debug: (message: string) => {
      if (process.env.LOG_LEVEL === "debug") {
        console.log(format("DEBUG", message));
      }
    },
  };
}
