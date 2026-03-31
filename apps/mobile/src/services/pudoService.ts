import { jwtDecode } from 'jwt-decode';
import { supabase, supabaseLocal } from '@brickshare/shared';
import { logger } from '../utils/logger';

/**
 * Interface para resultado de escaneo en recepción (dropoff)
 * Datos generados por Edge Function en DB1 + Sync remoto de DB2
 */
export interface PudoScanResult {
  package?: any;
  remote_sync?: {
    api_updated: boolean;
    previous_status?: string;
    message?: string;
    shipment_found?: boolean;
  };
  shipment_data?: {
    customer_name?: string;
    delivery_address?: string;
  };
  gps_validation?: {
    passed: boolean;
    message: string;
  };
  duration_ms: number;
}

/**
 * Interface para resultado de entrega (pickup)
 * Actualización de estado remoto en DB2 vía Edge Function en DB1
 */
export interface PickupResult {
  success: boolean;
  action_type: string;
  previous_status: string;
  new_status: string;
  pudo_location: {
    name: string;
  };
  gps_validation: {
    passed: boolean;
    message: string;
  };
}

/**
 * Servicio PUDO con patrón Dual Database
 * 
 * Arquitectura:
 * - DB2 (Brickshare): Almacena usuarios, envíos, ubicaciones
 * - DB1 (Local): Almacena logs de auditoría, paquetes locales
 * - Edge Functions (en DB1): Procesan escaneos y sincronizan con DB2
 * 
 * Flujo:
 * 1. App autentica con DB2 (obtiene JWT)
 * 2. App invoca Edge Function en DB1 con JWT
 * 3. Edge Function valida JWT, procesa, sincroniza con DB2
 * 4. App recibe resultado combinado
 */
export const pudoService = {
  /**
   * Procesa la recepción de un paquete (DROPOFF)
   * 
   * Flujo:
   * 1. Valida sesión de DB2 (Brickshare)
   * 2. Invoca Edge Function en DB1
   * 3. Edge Function:
   *    - Crea registro en DB1 (paquete local)
   *    - Sincroniza con DB2 (actualiza shipment)
   *    - Registra auditoría (pudo_scan_logs)
   * 4. Retorna datos combinados
   * 
   * @param trackingCode - Código de seguimiento del paquete (ej: "BS-DEL-7A2D335C")
   * @param gpsData - Datos GPS validados (lat, lon, accuracy)
   * @returns Resultado con info de paquete + sincronización remota
   */
  async processDropoff(
    trackingCode: string,
    gpsData?: { latitude: number; longitude: number; accuracy: number } | null
  ): Promise<PudoScanResult> {
    const startTime = Date.now();
    
    logger.info('🚀 [pudoService] DROPOFF: Starting process', 
      { trackingCode, gps: !!gpsData }, 'pudoService');

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
          trackingCode,
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
          scanned_code: trackingCode,
          scan_mode: 'dropoff',
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
      logger.success('✅ [pudoService] DROPOFF completed successfully', 
        { trackingCode, duration }, 'pudoService');

      return {
        ...data,
        duration_ms: duration,
      };

    } catch (err: any) {
      const duration = Date.now() - startTime;
      logger.error('❌ [pudoService] DROPOFF failed', 
        { error: err?.message, duration }, 'pudoService');
      throw err;
    }
  },

  /**
   * Procesa la entrega de un paquete (PICKUP)
   * 
   * Flujo:
   * 1. Valida sesión de DB2
   * 2. Invoca Edge Function en DB1
   * 3. Edge Function:
   *    - Valida QR dinámico
   *    - Actualiza estado en DB2 (shipment)
   *    - Registra auditoría en DB1
   * 4. Retorna confirmación de entrega
   * 
   * @param qrHash - Hash/data del QR dinámico
   * @param shipmentId - ID del envío en DB2
   * @param gpsData - Datos GPS validados
   * @returns Resultado con confirmación de entrega
   */
  async processPickup(
    qrHash: string,
    shipmentId: string,
    gpsData?: { latitude: number; longitude: number; accuracy: number } | null
  ): Promise<PickupResult> {
    const startTime = Date.now();
    
    logger.info('🚀 [pudoService] PICKUP: Starting process', 
      { shipmentId, gps: !!gpsData }, 'pudoService');

    try {
      // 1️⃣ Obtener sesión de DB2
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.access_token) {
        logger.error('❌ [pudoService] No active session from DB2', {}, 'pudoService');
        throw new Error('No hay sesión activa. Por favor, inicia sesión nuevamente.');
      }

      // 2️⃣ Invocar Edge Function en DB1
      // IMPORTANTE: Usar X-Auth-Token en lugar de Authorization para evitar validación de Kong
      logger.debug('📡 [pudoService] Invoking Edge Function update-remote-shipment-status', 
        { shipmentId }, 'pudoService');

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

      const { data, error } = await supabaseLocal.functions.invoke('update-remote-shipment-status', {
        headers,
        body: {
          shipment_id: shipmentId,
          qr_data: qrHash,
          gps_latitude: gpsData?.latitude,
          gps_longitude: gpsData?.longitude,
          gps_accuracy: gpsData?.accuracy,
        },
      });

      // 3️⃣ Manejar errores
      if (error) {
        let detailedError = error.message || 'Error desconocido';

        try {
          if (error.context && typeof error.context.json === 'function') {
            const errorBody = await error.context.clone().json();
            detailedError = errorBody?.error || errorBody?.message || JSON.stringify(errorBody);
          } else if (error.context && typeof error.context.text === 'function') {
            detailedError = await error.context.clone().text();
          }
        } catch (parseErr) {
          logger.warn('Error parsing Edge Function error response', {}, 'pudoService');
        }

        logger.error('❌ [pudoService] Edge Function error (Pickup)', 
          { detailedError, originalMessage: error.message }, 'pudoService');
        
        throw new Error(`Error en entrega: ${detailedError}`);
      }

      // 4️⃣ Validar respuesta
      if (!data) {
        logger.error('❌ [pudoService] Empty response from Edge Function', {}, 'pudoService');
        throw new Error('Respuesta vacía del servidor');
      }

      const duration = Date.now() - startTime;
      logger.success('✅ [pudoService] PICKUP completed successfully', 
        { shipmentId, duration }, 'pudoService');

      return data;

    } catch (err: any) {
      const duration = Date.now() - startTime;
      logger.error('❌ [pudoService] PICKUP failed', 
        { error: err?.message, duration }, 'pudoService');
      throw err;
    }
  }
};

