import { Platform } from 'react-native';

// Allow __DEV__ to be overridden in tests
declare global {
  var __DEV__: boolean | undefined;
}

let isDev = (process?.env?.NODE_ENV ?? 'production') === 'development';

if (typeof globalThis !== 'undefined' && globalThis.__DEV__ !== undefined) {
  isDev = globalThis.__DEV__;
}

const __DEV__ = isDev;

type LogLevel = 'info' | 'error' | 'success' | 'debug' | 'warn';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  context?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private addLog(level: LogLevel, message: string, data?: any, context?: string): void {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: this.formatTimestamp(),
      context
    };

    this.logs.push(entry);

    // Mantener un máximo de logs en memoria
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  private formatOutput(level: LogLevel, message: string, data?: any): string {
    const icons: Record<LogLevel, string> = {
      info: 'ℹ️',
      error: '❌',
      success: '✅',
      debug: '🔍',
      warn: '⚠️'
    };

    const timestamp = new Date().toLocaleTimeString();
    const icon = icons[level];
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';

    return `[${timestamp}] ${icon} ${message}${dataStr}`;
  }

  info(message: string, data?: any, context?: string): void {
    this.addLog('info', message, data, context);
    console.log(this.formatOutput('info', message, data));
  }

  error(message: string, error?: any, context?: string): void {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error;

    this.addLog('error', message, errorData, context);
    console.error(this.formatOutput('error', message, errorData));
  }

  success(message: string, data?: any, context?: string): void {
    this.addLog('success', message, data, context);
    console.log(this.formatOutput('success', message, data));
  }

  warn(message: string, data?: any, context?: string): void {
    this.addLog('warn', message, data, context);
    console.warn(this.formatOutput('warn', message, data));
  }

  debug(message: string, data?: any, context?: string): void {
    if (__DEV__) {
      this.addLog('debug', message, data, context);
      console.log(this.formatOutput('debug', message, data));
    }
  }

  /**
   * Obtiene todos los logs grabados
   */
  getLogs(): LogEntry[] {
    return this.logs;
  }

  /**
   * Obtiene logs filtrados por nivel
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Obtiene logs desde los últimos N minutos
   */
  getRecentLogs(minutes: number = 5): LogEntry[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.logs.filter(log => new Date(log.timestamp) > cutoff);
  }

  /**
   * Exporta los logs en formato JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Limpia todos los logs
   */
  clearLogs(): void {
    this.logs = [];
    this.info('Logger cleared');
  }

  /**
   * Registra el contexto actual (para debugging)
   */
  logContext(context: string, data?: any): void {
    this.info(`[Context: ${context}]`, data, context);
  }

  /**
   * Mide el tiempo de ejecución de una función
   */
  async measure<T>(
    label: string,
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.success(`${label} completed in ${duration}ms`, { duration }, context);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`${label} failed after ${duration}ms`, error, context);
      throw error;
    }
  }
}

// Singleton instance
export const logger = new Logger();

export default logger;