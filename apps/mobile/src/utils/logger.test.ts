import { logger } from './logger';

describe('logger', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Logger Methods', () => {
    it('should have all logging methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.success).toBe('function');
    });

    it('should log info messages with context', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      logger.info('Test message', { data: 'value' }, 'TestModule');

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('Test message');
    });

    it('should log error messages', () => {
      const consoleSpy = jest.spyOn(console, 'error');
      logger.error('Error message', { error: 'details' }, 'ErrorModule');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      const consoleSpy = jest.spyOn(console, 'warn');
      logger.warn('Warning message', 'warning details', 'WarnModule');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should skip debug messages when not in development', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      logger.debug('Debug message', { debug: 'data' }, 'DebugModule');

      // Debug should not be called in non-development environments
      // or when __DEV__ flag is false
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Debug message'));
    });

    it('should log success messages', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      logger.success('Success message', { result: 'ok' }, 'SuccessModule');

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('Success message');
    });
  });

  describe('Logger Data Handling', () => {
    it('should handle object data', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const testData = { key1: 'value1', key2: 'value2' };
      logger.info('Test', testData, 'Module');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle string data', () => {
      const consoleSpy = jest.spyOn(console, 'warn');
      logger.warn('Warning', 'string data', 'Module');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle empty module name', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      logger.info('Message', {}, '');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle null/undefined data gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      logger.info('Info with null', null as any, 'Module');

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('Info with null');
    });
  });

  describe('Logger with Special Cases', () => {
    it('should log messages with special characters', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      logger.info('Message with émojis 🚀 ✅ ❌', { data: 'test' }, 'Module');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle multiple consecutive logs', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      logger.info('First', {}, 'Module');
      logger.debug('Second', {}, 'Module');
      logger.success('Third', {}, 'Module');

      // Info and success should be called, debug may not depending on __DEV__
      expect(consoleSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle long messages', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const longMessage = 'A'.repeat(1000);
      logger.info(longMessage, { data: 'test' }, 'Module');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle nested objects', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const nestedData = {
        level1: {
          level2: {
            level3: 'value',
          },
        },
      };
      logger.info('Nested', nestedData, 'Module');

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('Nested');
    });
  });

  describe('Logger with Error Objects', () => {
    it('should log Error objects', () => {
      const consoleSpy = jest.spyOn(console, 'error');
      const error = new Error('Test error');
      logger.error('Error occurred', error, 'ErrorModule');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log error with stack trace', () => {
      const consoleSpy = jest.spyOn(console, 'error');
      const error = new Error('Stack trace test');
      logger.error('Error', { message: error.message, stack: error.stack }, 'Module');

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Logger Integration Scenarios', () => {
    it('should log API call flow', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      logger.info('🚀 Starting API call', { url: '/api/test' }, 'ApiService');
      logger.debug('📡 Request sent', { method: 'POST' }, 'ApiService');
      logger.success('✅ API call successful', { status: 200 }, 'ApiService');

      // Should have at least info and success calls
      expect(consoleSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      const firstCall = consoleSpy.mock.calls[0][0];
      expect(firstCall).toContain('Starting API call');
    });

    it('should log error recovery flow', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      const consoleInfoSpy = jest.spyOn(console, 'log');

      logger.error('❌ Operation failed', { error: 'Network timeout' }, 'Module');
      logger.warn('⚠️ Retrying...', 'Attempt 1', 'Module');
      logger.success('✅ Recovered', { attempts: 2 }, 'Module');

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it('should log authentication flow', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      logger.info('🔐 Auth starting', { user: 'test@example.com' }, 'AuthService');
      logger.debug('📡 Token validation', { tokenLength: 256 }, 'AuthService');
      logger.success('✅ Authenticated', { userId: '123' }, 'AuthService');

      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});