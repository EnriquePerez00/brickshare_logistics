import { jwtDecode } from 'jwt-decode';
import { supabase, supabaseLocal } from '@brickshare/shared';
import { logger } from '../utils/logger';

/**
 * Interface unificada para resultado de escaneo QR
 * Soporta recepción (dropoff), entrega (pickup) a cliente y devolución (return)
 */
export interface ScanResult {
  success: boolean;
  operation_type: 'dropoff' | 'pickup' | 'return';
  message: string;
  package?: {
    id: string;
    tracking_code: string;
    tracking_number: string;
    status: string;
    type: 'delivery' | 'return';
    location: {
      id: string;
      name: string;
      pudo_id: string;
      address: string;
    };
    received_at?: string;
    picked_up_at?: string;
    returned_at?: string;
  };
  shipment?: {
    id: string;
    previous_status: string;
    new_status: string;
    updated_at: string;
    customer_id: string;
    delivery_address: string;
  };
  operator?: {
    id: string;
    email: string;
  };
  timestamp: string;
  duration_ms: number;
}

/**
 * Servicio PUDO unificado con patrón Dual Database
 * 
 * Arquitectura:
 * - DB2 (Brickshare): Almacena usuarios, envíos, ubicaciones
 * - DB1 (Local): Almacena logs de auditoría, paquetes locales
 * - Edge Functions (en DB1): Procesan escaneos y sincronizan con DB2
 * 
 * Flujo:
 * 1. App autentica con DB2 (obtiene JWT)
 * 2. App invoca Edge Function en DB1 con JWT y código escaneado
 * 3. Edge Function:
 *    - Detecta automáticamente si es dropoff o pickup
 *    - Valida estado del shipment
 *    - Actualiza en DB2 con timestamp correspondiente
 *    - Registra auditoría (pudo_scan_logs)
 * 4. App recibe resultado con operation_type incluido
 */
export const pudoService = {
  /**
   * Procesa un escaneo QR (DROPOFF, PICKUP o RETURN)
   * 
   * Detecta automáticamente el tipo de operación basándose en:
   * - Si código está en delivery_qr_code → DROPOFF (recepción en PUDO)
   * - Si código está en pickup_qr_code → PICKUP (entrega a cliente)
   * - Si código está en return_qr_code → RETURN (devolución en PUDO)
   * 
   * La Edge Function se encarga de:
   * 1. Buscar código en los tres campos de QR
   * 2. Determinar tipo de operación automáticamente
   * 3. Validar estado actual del shipment
   * 4. Actualizar shipment con timestamp correspondiente
   * 5. Actualizar user_status a 'received' si es PICKUP
   * 6. Registrar auditoría completa
   * 
   * @param scannedCode - Código QR escaneado (delivery, pickup o return)
   * @param gpsData - Datos GPS validados (lat, lon, accuracy)
   * @returns Resultado con tipo de operación detectada
   */
  async processScan(
    scannedCode: string,
    gpsData?: { latitude: number; longitude: number; accuracy: number } | null
  ): Promise<ScanResult> {
    const startTime = Date.now();
    
    logger.info('🚀 [pudoService] SCAN: Starting process', 
      { scannedCode, gps: !!gpsData }, 'pudoService');

    try {
      // 1️⃣ Obtener sesión de DB2 (Brickshare remota)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.access_token) {
        logger.error('❌ [pudoService] No active session from DB2', {}, 'pudoService');
        throw new Error('No hay sesión activa. Por favor, inicia sesión nuevamente.');
      }

      logger.debug('📱 [pudoService] Session found', 
        { user_id: session?.user?.id, has_token: !!session.access_token }, 'pudoService');

      // Decodificar JWT para logs (CRÍTICO para verificar sub)
      try {
        const decoded: any = jwtDecode(session.access_token);
        logger.debug('🔐 [pudoService] JWT CLAIMS DECODED', 
          { 
            iss: decoded?.iss, 
            sub: decoded?.sub?.substring(0, 8) + '...',
            role: decoded?.role,
            email: decoded?.email,
            has_sub: !!decoded?.sub,
          }, 'pudoService');
        
        // VERIFY sub exists - this is critical!
        if (!decoded?.sub) {
          logger.error('❌ [pudoService] JWT MISSING SUB CLAIM!', 
            { decoded_keys: Object.keys(decoded || {}) }, 'pudoService');
          throw new Error('JWT inválido: no contiene ID de usuario (sub claim)');
        }
      } catch (e: any) {
        logger.error('❌ JWT decode FAILED', 
          { error: e?.message }, 'pudoService');
        throw e;
      }

      // 2️⃣ Invocar Edge Function en DB1 con JWT
      // IMPORTANTE: Usar X-Auth-Token en lugar de Authorization para evitar validación de Kong
      logger.debug('📡 [pudoService] Invoking Edge Function process-pudo-scan', 
        { 
          scannedCode,
          token_preview: session.access_token.substring(0, 30) + '...',
          supabaseLocal_url: (supabaseLocal as any)?.url || 'UNKNOWN',
        }, 'pudoService');

      // Detectar si estamos en modo desarrollo via variable de entorno
      const isDevMode = process.env.EXPO_PUBLIC_DEV_MODE === 'true';
      
      const headers: Record<string, string> = {
        'X-Auth-Token': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };

      // En desarrollo, bypass JWT validation
      if (isDevMode) {
        headers['X-Dev-Bypass'] = 'true';
        logger.debug('🔧 [pudoService] DEV MODE: Adding X-Dev-Bypass header', {}, 'pudoService');
      }

      const { data, error } = await supabaseLocal.functions.invoke('process-pudo-scan', {
        headers,
        body: {
          scanned_code: scannedCode,
          gps_latitude: gpsData?.latitude,
          gps_longitude: gpsData?.longitude,
          gps_accuracy: gpsData?.accuracy,
        },
      });

      // 3️⃣ Manejar errores de Edge Function
      if (error) {
        let detailedError = error.message || 'Error desconocido';
        let errorStatus = 'UNKNOWN';

        try {
          if (error.context && typeof error.context.json === 'function') {
            const errorBody = await error.context.clone().json();
            detailedError = errorBody?.error || errorBody?.message || JSON.stringify(errorBody);
            errorStatus = errorBody?.status || errorStatus;
          } else if (error.context && typeof error.context.text === 'function') {
            detailedError = await error.context.clone().text();
          }
        } catch (parseErr) {
          logger.warn('Error parsing Edge Function error response', {}, 'pudoService');
        }

        logger.error('❌ [pudoService] Edge Function error', 
          { detailedError, errorStatus, originalMessage: error.message }, 'pudoService');
        
        throw new Error(`Error procesando escaneo: ${detailedError}`);
      }

      // 4️⃣ Validar respuesta
      if (!data) {
        logger.error('❌ [pudoService] Empty response from Edge Function', {}, 'pudoService');
        throw new Error('Respuesta vacía del servidor');
      }

      if (data?.error) {
        logger.error('❌ [pudoService] Error in response data', 
          { error: data.error }, 'pudoService');
        throw new Error(data.error);
      }

      const duration = Date.now() - startTime;
      const operationType = data.operation_type || 'dropoff';
      logger.success('✅ [pudoService] SCAN completed successfully', 
        { scannedCode, operationType, duration }, 'pudoService');

      return {
        ...data,
        duration_ms: duration,
      };

    } catch (err: any) {
      const duration = Date.now() - startTime;
      logger.error('❌ [pudoService] SCAN failed', 
        { error: err?.message, duration }, 'pudoService');
      throw err;
    }
  }
};

