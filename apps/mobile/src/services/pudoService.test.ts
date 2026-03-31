import { pudoService, ScanResult } from './pudoService';
import { supabase, supabaseLocal } from '@brickshare/shared';
import { jwtDecode } from 'jwt-decode';

// Mock dependencies
jest.mock('jwt-decode');
jest.mock('@brickshare/shared', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
  supabaseLocal: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('pudoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processScan - DROPOFF (delivery_qr_code)', () => {
    it('should successfully process a DROPOFF scan', async () => {
      // Mock session
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token-123',
            user: { id: 'user-123' },
          },
        },
      });

      // Mock JWT decode
      (jwtDecode as jest.Mock).mockReturnValue({
        sub: 'user-123',
        email: 'pudo@example.com',
        role: 'pudo_operator',
      });

      // Mock Edge Function response - DROPOFF
      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          operation_type: 'dropoff',
          message: 'Paquete recepcionado exitosamente en PUDO',
          package: {
            id: 'pkg-001',
            tracking_code: 'BS-DEL-7A2D335C-8FA',
            tracking_number: 'TRK-001',
            status: 'in_location',
            type: 'delivery',
            location: {
              id: 'loc-001',
              name: 'PUDO Centro',
              pudo_id: 'PUDO-001',
              address: 'Calle Principal 123',
            },
            received_at: '2026-03-31T22:20:00Z',
          },
          shipment: {
            id: 'ship-001',
            previous_status: 'in_transit_pudo',
            new_status: 'delivered_pudo',
            updated_at: '2026-03-31T22:20:00Z',
            customer_id: 'cust-123',
            delivery_address: 'Cliente Address 456',
          },
          operator: {
            id: 'user-123',
            email: 'pudo@example.com',
          },
          timestamp: '2026-03-31T22:20:00Z',
          duration_ms: 234,
        },
      });

      const result = await pudoService.processScan('BS-DEL-7A2D335C-8FA', {
        latitude: 40.4168,
        longitude: -3.7038,
        accuracy: 10.5,
      });

      // Assertions
      expect(result).toBeDefined();
      expect(result.operation_type).toBe('dropoff');
      expect(result.success).toBe(true);
      expect(result.package?.status).toBe('in_location');
      expect(result.shipment?.new_status).toBe('delivered_pudo');
      expect(result.duration_ms).toBeDefined();

      // Verify Edge Function was called correctly
      expect(supabaseLocal.functions.invoke).toHaveBeenCalledWith('process-pudo-scan', {
        headers: {
          'X-Auth-Token': 'Bearer test-token-123',
          'Content-Type': 'application/json',
        },
        body: {
          scanned_code: 'BS-DEL-7A2D335C-8FA',
          gps_latitude: 40.4168,
          gps_longitude: -3.7038,
          gps_accuracy: 10.5,
        },
      });
    });

    it('should handle DROPOFF without GPS data', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token-123',
            user: { id: 'user-123' },
          },
        },
      });

      (jwtDecode as jest.Mock).mockReturnValue({
        sub: 'user-123',
        email: 'pudo@example.com',
      });

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          operation_type: 'dropoff',
          message: 'Paquete recepcionado exitosamente en PUDO',
          package: {
            id: 'pkg-001',
            tracking_code: 'BS-DEL-7A2D335C-8FA',
            tracking_number: 'TRK-001',
            status: 'in_location',
            type: 'delivery',
            location: {
              id: 'loc-001',
              name: 'PUDO Centro',
              pudo_id: 'PUDO-001',
              address: 'Calle Principal 123',
            },
          },
          shipment: {
            id: 'ship-001',
            previous_status: 'in_transit_pudo',
            new_status: 'delivered_pudo',
            updated_at: '2026-03-31T22:20:00Z',
          },
          timestamp: '2026-03-31T22:20:00Z',
          duration_ms: 150,
        },
      });

      const result = await pudoService.processScan('BS-DEL-7A2D335C-8FA', null);

      expect(result.operation_type).toBe('dropoff');
      expect(result.success).toBe(true);

      // Verify GPS data was sent as undefined
      expect(supabaseLocal.functions.invoke).toHaveBeenCalledWith(
        'process-pudo-scan',
        expect.objectContaining({
          body: {
            scanned_code: 'BS-DEL-7A2D335C-8FA',
            gps_latitude: undefined,
            gps_longitude: undefined,
            gps_accuracy: undefined,
          },
        })
      );
    });
  });

  describe('processScan - PICKUP (pickup_qr_code)', () => {
    it('should successfully process a PICKUP scan', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token-123',
            user: { id: 'user-123' },
          },
        },
      });

      (jwtDecode as jest.Mock).mockReturnValue({
        sub: 'user-123',
        email: 'pudo@example.com',
      });

      // Mock Edge Function response - PICKUP
      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          operation_type: 'pickup',
          message: 'Paquete entregado exitosamente al cliente',
          package: {
            id: 'pkg-002',
            tracking_code: 'BS-PU-ABC123DEF',
            tracking_number: 'TRK-002',
            status: 'picked_up',
            type: 'return',
            location: {
              id: 'loc-001',
              name: 'PUDO Centro',
              pudo_id: 'PUDO-001',
              address: 'Calle Principal 123',
            },
            picked_up_at: '2026-03-31T22:21:00Z',
          },
          shipment: {
            id: 'ship-002',
            previous_status: 'delivered_pudo',
            new_status: 'delivered_user',
            updated_at: '2026-03-31T22:21:00Z',
            customer_id: 'cust-124',
            delivery_address: 'Cliente Address 789',
          },
          operator: {
            id: 'user-123',
            email: 'pudo@example.com',
          },
          timestamp: '2026-03-31T22:21:00Z',
          duration_ms: 198,
        },
      });

      const result = await pudoService.processScan('BS-PU-ABC123DEF', {
        latitude: 40.4168,
        longitude: -3.7038,
        accuracy: 8.3,
      });

      // Assertions
      expect(result.operation_type).toBe('pickup');
      expect(result.success).toBe(true);
      expect(result.package?.status).toBe('picked_up');
      expect(result.shipment?.new_status).toBe('delivered_user');
      expect(result.duration_ms).toBeDefined();
    });
  });

  describe('processScan - Error Handling', () => {
    it('should throw error when no session is available', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      await expect(pudoService.processScan('BS-DEL-7A2D335C-8FA')).rejects.toThrow(
        'No hay sesión activa. Por favor, inicia sesión nuevamente.'
      );
    });

    it('should throw error when JWT decode fails', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'invalid-token',
            user: { id: 'user-123' },
          },
        },
      });

      (jwtDecode as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(pudoService.processScan('BS-DEL-7A2D335C-8FA')).rejects.toThrow(
        'Invalid token'
      );
    });

    it('should throw error when JWT missing sub claim', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token',
            user: { id: 'user-123' },
          },
        },
      });

      (jwtDecode as jest.Mock).mockReturnValue({
        email: 'pudo@example.com',
        // missing sub claim
      });

      await expect(pudoService.processScan('BS-DEL-7A2D335C-8FA')).rejects.toThrow(
        'JWT inválido: no contiene ID de usuario (sub claim)'
      );
    });

    it('should throw error when Edge Function returns error', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token-123',
            user: { id: 'user-123' },
          },
        },
      });

      (jwtDecode as jest.Mock).mockReturnValue({
        sub: 'user-123',
        email: 'pudo@example.com',
      });

      const errorContext = {
        json: jest.fn().mockResolvedValue({
          error: 'QR no válido o destino equivocado',
        }),
      };

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        error: {
          message: 'Edge Function error',
          context: errorContext,
        },
      });

      await expect(pudoService.processScan('INVALID-QR')).rejects.toThrow(
        'Error procesando escaneo: QR no válido o destino equivocado'
      );
    });

    it('should throw error when Edge Function returns empty response', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token-123',
            user: { id: 'user-123' },
          },
        },
      });

      (jwtDecode as jest.Mock).mockReturnValue({
        sub: 'user-123',
        email: 'pudo@example.com',
      });

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(pudoService.processScan('BS-DEL-7A2D335C-8FA')).rejects.toThrow(
        'Respuesta vacía del servidor'
      );
    });

    it('should throw error when response contains error field', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token-123',
            user: { id: 'user-123' },
          },
        },
      });

      (jwtDecode as jest.Mock).mockReturnValue({
        sub: 'user-123',
        email: 'pudo@example.com',
      });

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          error: 'Estado inválido del shipment',
        },
      });

      await expect(pudoService.processScan('BS-DEL-7A2D335C-8FA')).rejects.toThrow(
        'Estado inválido del shipment'
      );
    });
  });

  describe('Response Structure', () => {
    it('should include duration_ms in response', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token-123',
            user: { id: 'user-123' },
          },
        },
      });

      (jwtDecode as jest.Mock).mockReturnValue({
        sub: 'user-123',
        email: 'pudo@example.com',
      });

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          operation_type: 'dropoff',
          message: 'Test',
          timestamp: '2026-03-31T22:20:00Z',
          duration_ms: 250,
        },
      });

      const result = await pudoService.processScan('BS-DEL-7A2D335C-8FA');

      expect(result.duration_ms).toBeDefined();
      expect(typeof result.duration_ms).toBe('number');
      expect(result.duration_ms).toBeGreaterThan(0);
    });

    it('should include operation_type in response', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token-123',
            user: { id: 'user-123' },
          },
        },
      });

      (jwtDecode as jest.Mock).mockReturnValue({
        sub: 'user-123',
        email: 'pudo@example.com',
      });

      (supabaseLocal.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          operation_type: 'dropoff',
          message: 'Test',
          timestamp: '2026-03-31T22:20:00Z',
          duration_ms: 200,
        },
      });

      const result: ScanResult = await pudoService.processScan('BS-DEL-7A2D335C-8FA');

      expect(result.operation_type).toBeDefined();
      expect(['dropoff', 'pickup']).toContain(result.operation_type);
    });
  });
});