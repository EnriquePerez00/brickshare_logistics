// ============================================================
// update-remote-shipment-status — Supabase Edge Function (Deno)
//
// Actualiza el estado de un shipment en la base de datos remota
// de Brickshare después de escanear QR en punto PUDO.
//
// Lógica:
//   - Si shipping_status = "in_transit_pudo" → cambiar a "delivered_pudo"
//   - Si shipping_status = "in_return_pudo" → cambiar a "in_return"
//
// POST /functions/v1/update-remote-shipment-status
// Headers: Authorization: Bearer <OWNER_JWT>
// Body: {
//   "shipment_id": "uuid",
//   "qr_data": "scanned_qr_content",
//   "gps_latitude": 40.4168,
//   "gps_longitude": -3.7038,
//   "gps_accuracy": 10.5
// }
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_bricklogistics_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_bricklogistics_ANON_KEY')!
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_bricklogistics_SERVICE_ROLE_KEY')!
const REMOTE_DB_URL = Deno.env.get('SUPABASE_brickshare_API_URL')! // URL de la BD remota de Brickshare
const REMOTE_DB_KEY = Deno.env.get('SUPABASE_brickshare_SERVICE_ROLE_KEY')! // Service key de BD remota

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // 1. Autenticar al owner del punto PUDO
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse(401, 'Missing Authorization header')

    let ownerUser: any = null;
    let authErrorMsg: string | null = null;

    // A. Intentar validar el token localmente
    const supabaseLocalAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: localAuth, error: localAuthErr } = await supabaseLocalAuth.auth.getUser();
    
    if (localAuth?.user) {
      ownerUser = localAuth.user;
    } else {
      // B. Si falla, intentar validar el token contra Producción (Dual DB)
      const supabaseRemoteAuth = createClient(REMOTE_DB_URL, REMOTE_DB_KEY, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: remoteAuth, error: remoteAuthErr } = await supabaseRemoteAuth.auth.getUser();
      
      if (remoteAuth?.user) {
        ownerUser = remoteAuth.user;
      } else {
        authErrorMsg = remoteAuthErr?.message || localAuthErr?.message || 'Unknown auth error';
      }
    }

    if (!ownerUser) {
      return errorResponse(401, `Invalid or expired session: ${authErrorMsg}`)
    }

    // Inicializar cliente Admin Remoto para leer usuarios y localizaciones de la BD en la Nube
    const supabaseRemoteAdmin = createClient(REMOTE_DB_URL, REMOTE_DB_KEY);

    // Obtener ubicación PUDO asignada al usuario usando user_locations
    const { data: userLocationData, error: locErr } = await supabaseRemoteAdmin
      .from('user_locations')
      .select(`
        location_id,
        locations (
          id,
          name,
          latitude,
          longitude,
          gps_validation_radius_meters
        )
      `)
      .eq('user_id', ownerUser.id)
      .limit(1)
      .single()

    if (locErr || !userLocationData || !userLocationData.locations) {
      return errorResponse(404, 'No PUDO location assigned to this user. Please contact administrator.')
    }

    // Extraer location del JOIN
    const ownerLocation = Array.isArray(userLocationData.locations) 
      ? userLocationData.locations[0] 
      : userLocationData.locations

    // 2. Leer datos del body
    const body = await req.json().catch(() => ({}))
    const {
      shipment_id,
      qr_data,
      gps_latitude,
      gps_longitude,
      gps_accuracy,
    } = body

    if (!shipment_id) {
      return errorResponse(400, 'shipment_id is required')
    }

    // 3. Validar GPS si está configurado
    let gpsValidationPassed = false
    let gpsValidationMessage = 'GPS validation not configured'

    if (ownerLocation.latitude && ownerLocation.longitude && gps_latitude && gps_longitude) {
      const distance = calculateDistance(
        ownerLocation.latitude,
        ownerLocation.longitude,
        gps_latitude,
        gps_longitude
      )

      const allowedRadius = ownerLocation.gps_validation_radius_meters || 50
      gpsValidationPassed = distance <= allowedRadius

      if (!gpsValidationPassed) {
        gpsValidationMessage = `GPS validation failed: distance ${distance.toFixed(0)}m exceeds allowed radius ${allowedRadius}m`
        // REMOVED: logPudoScan call (pudo_scan_logs eliminada en migration 022)
        return errorResponse(403, gpsValidationMessage)
      }

      gpsValidationMessage = `GPS validation passed: distance ${distance.toFixed(0)}m within radius ${allowedRadius}m`
    }

    // 4. Conectar a BD remota para obtener estado actual del shipment
    const supabaseRemote = createClient(REMOTE_DB_URL, REMOTE_DB_KEY)

    const { data: shipment, error: shipmentErr } = await supabaseRemote
      .from('shipments')
      .select('id, shipment_status')
      .eq('id', shipment_id)
      .single()

    if (shipmentErr || !shipment) {
      // REMOVED: logPudoScan call (pudo_scan_logs eliminada en migration 022)
      return errorResponse(404, 'Shipment not found in remote database')
    }

    const currentStatus = shipment.shipment_status

    // 5. Determinar nuevo estado según lógica de negocio
    let newStatus: string | null = null
    let actionType: 'delivery_confirmation' | 'return_confirmation' = 'delivery_confirmation'

    if (currentStatus === 'in_transit_pudo') {
      newStatus = 'delivered_pudo'
      actionType = 'delivery_confirmation'
    } else if (currentStatus === 'in_return_pudo') {
      newStatus = 'in_return'
      actionType = 'return_confirmation'
    } else {
      // Estado no válido para operación PUDO
      // REMOVED: logPudoScan call (pudo_scan_logs eliminada en migration 022)
      return errorResponse(
        409,
        `Invalid status for PUDO operation: ${currentStatus}. Expected in_transit_pudo or in_return_pudo.`
      )
    }

    // 6. Actualizar columna shipment_status en tabla shipments de brickshare
    const { error: updateErr } = await supabaseRemote
      .from('shipments')
      .update({
        shipment_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shipment_id)

    if (updateErr) {
      console.error('Remote DB update error:', updateErr)
      // REMOVED: logPudoScan call (pudo_scan_logs eliminada en migration 022)
      return errorResponse(500, 'Failed to update shipment status in remote database')
    }

    // 7. REMOVED: pudo_scan_logs registration (tabla eliminada en migration 022)
    const duration = Date.now() - startTime
    console.log('[INFO] Scan logging skipped (pudo_scan_logs removed)')

    // 8. Retornar confirmación
    return new Response(
      JSON.stringify({
        success: true,
        shipment_id: shipment_id,
        previous_status: currentStatus,
        new_status: newStatus,
        action_type: actionType,
        pudo_location: {
          id: ownerLocation.id,
          name: ownerLocation.name,
        },
        gps_validation: {
          passed: gpsValidationPassed,
          message: gpsValidationMessage,
        },
        timestamp: new Date().toISOString(),
        duration_ms: duration,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return errorResponse(500, 'Internal server error')
  }
})

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Calcula la distancia entre dos puntos GPS usando fórmula de Haversine
 * Retorna distancia en metros
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Radio de la Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Hash simple de string para logging (no para seguridad)
 */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(16)
}

/**
 * REMOVED: logPudoScan function
 * La tabla pudo_scan_logs fue eliminada en migration 022
 * Los logs ahora se registran solo en package_events
 */
