import { pudoService, PudoScanResult, PickupResult } from './pudoService';
import { supabase, supabaseLocal } from '@brickshare/shared';
import { logger } from '../utils/logger';

// Mock the modules
jest.mock('@brickshare/shared');
jest.mock('../utils/logger');

describe('pudoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('processDropoff', () => {
    const mockTrackingCode = 'BS-DEL-7A2D335C';
    const mockGpsData = {
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 5,
    };

    it('should successfully process a dropoff with valid tracking code and GPS', async () => {
      // Setup mocks
      const mockSession = { access_token: 'mock-jwt-token' };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      const mockResponse = {
        package: { tracking_code: mockTrackingCode, status: 'received' },
        remote_sync: { api_updated: true, previous_status: 'in_transit' },
        gps_validation: { passed: true, message: 'GPS valid' },
      };

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      // Execute
      const result = await pudoService.processDropoff(mockTrackingCode, mockGpsData);

      // Assertions
      expect(result).toHaveProperty('duration_ms');
      expect(result.package).toBeDefined();
      expect(result.remote_sync).toBeDefined();
      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(supabaseLocal.functions.invoke).toHaveBeenCalledWith(
        'process-pudo-scan',
        expect.objectContaining({
          body: {
            scanned_code: mockTrackingCode,
            scan_mode: 'dropoff',
            gps_latitude: mockGpsData.latitude,
            gps_longitude: mockGpsData.longitude,
            gps_accuracy: mockGpsData.accuracy,
          },
        })
      );
      expect(logger.success).toHaveBeenCalled();
    });

    it('should throw error if no active session from DB2', async () => {
      // Setup mocks
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      // Execute & Assert
      await expect(pudoService.processDropoff(mockTrackingCode, mockGpsData)).rejects.toThrow(
        'No hay sesión activa'
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle Edge Function errors gracefully', async () => {
      // Setup mocks
      const mockSession = { access_token: 'mock-jwt-token' };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      const mockError = {
        message: 'Edge Function error',
        context: {
          json: jest.fn().mockResolvedValue({
            error: 'Package not found',
            status: 'NOT_FOUND',
          }),
          clone: jest.fn().mockReturnThis(),
        },
      };

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      // Execute & Assert
      await expect(pudoService.processDropoff(mockTrackingCode, mockGpsData)).rejects.toThrow(
        'Error procesando escaneo'
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('should process dropoff without GPS data', async () => {
      // Setup mocks
      const mockSession = { access_token: 'mock-jwt-token' };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      const mockResponse = {
        package: { tracking_code: mockTrackingCode, status: 'received' },
        gps_validation: { passed: false, message: 'GPS not available' },
      };

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      // Execute
      const result = await pudoService.processDropoff(mockTrackingCode, null);

      // Assertions
      expect(result).toBeDefined();
      expect(supabaseLocal.functions.invoke).toHaveBeenCalledWith(
        'process-pudo-scan',
        expect.objectContaining({
          body: {
            scanned_code: mockTrackingCode,
            scan_mode: 'dropoff',
            gps_latitude: undefined,
            gps_longitude: undefined,
            gps_accuracy: undefined,
          },
        })
      );
    });

    it('should measure operation duration correctly', async () => {
      // Setup mocks
      const mockSession = { access_token: 'mock-jwt-token' };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      (supabaseLocal.functions.invoke as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  data: { package: {}, gps_validation: { passed: true, message: 'OK' } },
                  error: null,
                }),
              100
            );
          })
      );

      // Execute
      const result = await pudoService.processDropoff(mockTrackingCode, mockGpsData);

      // Assertions
      expect(result.duration_ms).toBeGreaterThanOrEqual(100);
    });
  });

  describe('processPickup', () => {
    const mockQrHash = 'eyJzaGlwbWVudF9pZCI6IjEyMyJ9';
    const mockShipmentId = '123';
    const mockGpsData = {
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 5,
    };

    it('should successfully process a pickup with valid QR and GPS', async () => {
      // Setup mocks
      const mockSession = { access_token: 'mock-jwt-token' };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      const mockResponse: PickupResult = {
        success: true,
        action_type: 'delivery_confirmation',
        previous_status: 'ready_for_pickup',
        new_status: 'delivered',
        pudo_location: { name: 'Store ABC' },
        gps_validation: { passed: true, message: 'GPS valid' },
      };

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      // Execute
      const result = await pudoService.processPickup(mockQrHash, mockShipmentId, mockGpsData);

      // Assertions
      expect(result.success).toBe(true);
      expect(result.new_status).toBe('delivered');
      expect(supabaseLocal.functions.invoke).toHaveBeenCalledWith(
        'update-remote-shipment-status',
        expect.objectContaining({
          body: {
            shipment_id: mockShipmentId,
            qr_data: mockQrHash,
            gps_latitude: mockGpsData.latitude,
            gps_longitude: mockGpsData.longitude,
            gps_accuracy: mockGpsData.accuracy,
          },
        })
      );
      expect(logger.success).toHaveBeenCalled();
    });

    it('should throw error if no active session', async () => {
      // Setup mocks
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      // Execute & Assert
      await expect(
        pudoService.processPickup(mockQrHash, mockShipmentId, mockGpsData)
      ).rejects.toThrow('No hay sesión activa');
    });

    it('should handle pickup Edge Function errors', async () => {
      // Setup mocks
      const mockSession = { access_token: 'mock-jwt-token' };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      const mockError = {
        message: 'Invalid QR',
        context: {
          json: jest.fn().mockResolvedValue({ error: 'QR validation failed' }),
          clone: jest.fn().mockReturnThis(),
        },
      };

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      // Execute & Assert
      await expect(
        pudoService.processPickup(mockQrHash, mockShipmentId, mockGpsData)
      ).rejects.toThrow('Error en entrega');
    });

    it('should process pickup without GPS data', async () => {
      // Setup mocks
      const mockSession = { access_token: 'mock-jwt-token' };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      const mockResponse: PickupResult = {
        success: true,
        action_type: 'delivery_confirmation',
        previous_status: 'ready_for_pickup',
        new_status: 'delivered',
        pudo_location: { name: 'Store ABC' },
        gps_validation: { passed: false, message: 'GPS unavailable' },
      };

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      // Execute
      const result = await pudoService.processPickup(mockQrHash, mockShipmentId, null);

      // Assertions
      expect(result.success).toBe(true);
      expect(supabaseLocal.functions.invoke).toHaveBeenCalledWith(
        'update-remote-shipment-status',
        expect.objectContaining({
          body: {
            shipment_id: mockShipmentId,
            qr_data: mockQrHash,
            gps_latitude: undefined,
            gps_longitude: undefined,
            gps_accuracy: undefined,
          },
        })
      );
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle empty response from Edge Function', async () => {
      const mockSession = { access_token: 'mock-jwt-token' };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        pudoService.processDropoff('BS-TEST', { latitude: 0, longitude: 0, accuracy: 0 })
      ).rejects.toThrow('Respuesta vacía del servidor');
    });

    it('should handle error response in data field', async () => {
      const mockSession = { access_token: 'mock-jwt-token' };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: { error: 'Custom error message' },
        error: null,
      });

      await expect(
        pudoService.processDropoff('BS-TEST', { latitude: 0, longitude: 0, accuracy: 0 })
      ).rejects.toThrow('Custom error message');
    });

    it('should log JWT decode info for monitoring', async () => {
      const mockSession = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3N1cGFiYXNlLmlvIiwic3ViIjoiMTIzIn0.test',
      };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: { package: {}, gps_validation: { passed: true, message: 'OK' } },
        error: null,
      });

      await pudoService.processDropoff('BS-TEST', { latitude: 0, longitude: 0, accuracy: 0 });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('JWT decoded'),
        expect.any(Object),
        'pudoService'
      );
    });
  });
});