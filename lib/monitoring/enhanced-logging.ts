/**
 * Enhanced Logging and Monitoring Utility
 *
 * Provides structured logging and monitoring capabilities
 * for the Talk-to-my-Lawyer application.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  category: string;
  context?: Record<string, any>;
  userId?: string;
  requestId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: "ms" | "bytes" | "count";
  timestamp: string;
  context?: Record<string, any>;
}

/**
 * Logger class with structured logging
 */
export class Logger {
  private category: string;
  private context: Record<string, any>;

  constructor(category: string, context: Record<string, any> = {}) {
    this.category = category;
    this.context = context;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    additionalContext?: Record<string, any>,
    error?: Error,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      category: this.category,
      context: { ...this.context, ...additionalContext },
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };
  }

  private log(entry: LogEntry): void {
    const isProduction = process.env.NODE_ENV === "production";
    const isDevelopment = process.env.NODE_ENV === "development";

    // In production, send to monitoring service
    if (isProduction) {
      // TODO: Send to monitoring service (e.g., DataDog, New Relic, etc.)
      // For now, just log to console with structured format
      if (entry.level === "error" || entry.level === "critical") {
        console.error("[LOG]", JSON.stringify(entry));
      } else if (entry.level === "warn") {
        console.warn("[LOG]", JSON.stringify(entry));
      } else {
        console.log("[LOG]", JSON.stringify(entry));
      }
    } else if (isDevelopment) {
      // In development, use colored console output
      const colors = {
        debug: "\x1b[36m", // cyan
        info: "\x1b[34m", // blue
        warn: "\x1b[33m", // yellow
        error: "\x1b[31m", // red
        critical: "\x1b[35m", // magenta
      };
      const reset = "\x1b[0m";

      const color = colors[entry.level];
      console.log(
        `${color}[${entry.level.toUpperCase()}]${reset} ${entry.category}: ${entry.message}`,
        entry.context && Object.keys(entry.context).length > 0
          ? entry.context
          : "",
        entry.error ? entry.error : "",
      );
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(this.createLogEntry("debug", message, context));
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(this.createLogEntry("info", message, context));
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(this.createLogEntry("warn", message, context));
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(this.createLogEntry("error", message, context, error));
  }

  critical(
    message: string,
    error?: Error,
    context?: Record<string, any>,
  ): void {
    this.log(this.createLogEntry("critical", message, context, error));
  }
}

/**
 * Performance monitoring utility
 */
export class PerformanceMonitor {
  private startTimes: Map<string, number> = new Map();

  startTimer(name: string): void {
    this.startTimes.set(name, performance.now());
  }

  endTimer(name: string, context?: Record<string, any>): number {
    const startTime = this.startTimes.get(name);
    if (!startTime) {
      console.warn(`Timer ${name} was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(name);

    this.recordMetric({
      name,
      value: duration,
      unit: "ms",
      timestamp: new Date().toISOString(),
      context,
    });

    return duration;
  }

  recordMetric(metric: PerformanceMetric): void {
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction) {
      // TODO: Send to monitoring service
      console.log("[METRIC]", JSON.stringify(metric));
    } else {
      console.log(
        `[PERF] ${metric.name}: ${metric.value}${metric.unit}`,
        metric.context || "",
      );
    }
  }

  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    context?: Record<string, any>,
  ): Promise<T> {
    this.startTimer(name);
    try {
      const result = await fn();
      this.endTimer(name, { ...context, success: true });
      return result;
    } catch (error) {
      this.endTimer(name, {
        ...context,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  measure<T>(name: string, fn: () => T, context?: Record<string, any>): T {
    this.startTimer(name);
    try {
      const result = fn();
      this.endTimer(name, { ...context, success: true });
      return result;
    } catch (error) {
      this.endTimer(name, {
        ...context,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}

/**
 * Global logger instances for common categories
 */
export const authLogger = new Logger("auth");
export const apiLogger = new Logger("api");
export const dbLogger = new Logger("database");
export const emailLogger = new Logger("email");
export const paymentLogger = new Logger("payment");
export const securityLogger = new Logger("security");
export const performanceMonitor = new PerformanceMonitor();

/**
 * Error boundary utility for catching and logging unhandled errors
 */
export function setupErrorBoundary(): void {
  if (typeof window !== "undefined") {
    window.addEventListener("error", (event) => {
      const logger = new Logger("global-error");
      logger.error("Unhandled JavaScript error", event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      const logger = new Logger("global-error");
      logger.error(
        "Unhandled promise rejection",
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason)),
      );
    });
  }

  if (typeof process !== "undefined") {
    process.on("uncaughtException", (error) => {
      const logger = new Logger("global-error");
      logger.critical("Uncaught exception", error);

      // In production, gracefully shutdown
      if (process.env.NODE_ENV === "production") {
        setTimeout(() => process.exit(1), 1000);
      }
    });

    process.on("unhandledRejection", (reason, promise) => {
      const logger = new Logger("global-error");
      logger.critical(
        "Unhandled promise rejection",
        reason instanceof Error ? reason : new Error(String(reason)),
        {
          promise: String(promise),
        },
      );
    });
  }
}

/**
 * Request logging middleware helper
 */
export function createRequestLogger(category: string) {
  return {
    logRequest: (
      method: string,
      url: string,
      userAgent?: string,
      userId?: string,
    ) => {
      const logger = new Logger(category);
      logger.info(`${method} ${url}`, {
        userAgent,
        userId,
      });
    },

    logResponse: (
      method: string,
      url: string,
      status: number,
      duration: number,
      userId?: string,
    ) => {
      const logger = new Logger(category);
      const contextData = {
        status,
        duration: `${duration}ms`,
        userId,
      };
      if (status >= 500) {
        logger.error(`${method} ${url} - ${status}`, undefined, contextData);
      } else if (status >= 400) {
        logger.warn(`${method} ${url} - ${status}`, contextData);
      } else {
        logger.info(`${method} ${url} - ${status}`, contextData);
      }
    },

    logError: (method: string, url: string, error: Error, userId?: string) => {
      const logger = new Logger(category);
      logger.error(`${method} ${url} - Error`, error, { userId });
    },
  };
}

/**
 * User activity logger
 */
export const userActivityLogger = {
  login: (userId: string, method: string, ip?: string) => {
    securityLogger.info("User login", { userId, method, ip });
  },

  logout: (userId: string, ip?: string) => {
    securityLogger.info("User logout", { userId, ip });
  },

  letterGenerated: (userId: string, letterId: string, letterType: string) => {
    apiLogger.info("Letter generated", { userId, letterId, letterType });
  },

  paymentProcessed: (
    userId: string,
    amount: number,
    currency: string,
    paymentIntentId: string,
  ) => {
    paymentLogger.info("Payment processed", {
      userId,
      amount,
      currency,
      paymentIntentId,
    });
  },

  adminAction: (adminId: string, action: string, targetId?: string) => {
    securityLogger.info("Admin action", { adminId, action, targetId });
  },
};

/**
 * Initialize monitoring
 */
export function initializeMonitoring(): void {
  setupErrorBoundary();

  const logger = new Logger("monitoring");
  logger.info("Monitoring initialized", {
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || "unknown",
  });
}
