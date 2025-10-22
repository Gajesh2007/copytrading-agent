/**
 * Simple structured logger with level-based filtering.
 *
 * Log level can be controlled via the `LOG_LEVEL` environment variable.
 * Defaults to "info" if not set.
 *
 * Levels (in order of verbosity):
 * - debug: Detailed diagnostic information
 * - info: General informational messages
 * - warn: Warning messages for recoverable issues
 * - error: Error messages for failures
 */

/** Available log levels */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Numeric weights for log levels (higher = more severe).
 * Used for filtering based on minimum level.
 */
const levelWeights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Load minimum log level from environment (default: "info")
const envLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";
const minWeight = levelWeights[envLevel] ?? levelWeights.info;

/**
 * Core logging function that filters by level and writes to console.
 *
 * @param level - Log level
 * @param message - Log message
 * @param meta - Optional structured metadata to include in log
 */
function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  // Filter out logs below the minimum level
  if (levelWeights[level] < minWeight) {
    return;
  }

  const time = new Date().toISOString();
  const payload = meta && Object.keys(meta).length > 0 ? { message, ...meta } : { message };

  // Use console.log for debug, otherwise use level-specific console method
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](`[${time}] [${level.toUpperCase()}]`, payload);
}

/**
 * Singleton logger instance with level-specific methods.
 */
export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};

/** Type alias for the logger interface (useful for dependency injection) */
export type Logger = typeof logger;
