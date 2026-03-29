// ============================================================
// process-pudo-scan — Supabase Edge Function (Deno)
//
// Procesa el escaneo de un código de barras o QR en un punto PUDO.
// Flujo completo:
//   1. Autentica al operador PUDO
//   2. Toma la referencia escaneada (tracking code / barcode)
//   3. Consulta la API remota de Brickshare para obtener info del shipment
//   4. Crea el package en la BD local con toda la info
//   5. Registra el scan en pudo_scan_logs
//   6. Actualiza el shipping_status remoto a "delivered_pudo"
//   7. Retorna confirmación con todos los datos
//
// POST /functions/v1/process-pudo-scan
// Headers: Authorization: Bearer <OWNER_JWT>
// Body: {
//   "scanned_code": "BS-DEL-7A2D335C-8FA",
//   "scan_mode": "dropoff" | "pickup",
//   "gps_latitude": 40.4168,
//   "gps_longitude": -3.7038,
//   "gps_accuracy": 10.5
// }
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const REMOTE_DB_URL = Deno.env.get('REMOTE_DB_URL')!
const REMOTE_DB_KEY = Deno.env.get('REMOTE_DB_SERVICE_KEY')!

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
    // ─────────────────────────────────────────────────
    // 1. AUTENTICACIÓN DEL OPERADOR PUDO
    // ─────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse(401, 'Missing Authorization header')

    const supabaseLocal = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: ownerUser }, error: authErr } = await supabaseLocal.auth.getUser()
    if (authErr || !ownerUser) return errorResponse(401, 'Invalid or expired session')

    // Verificar rol owner
    const { data: ownerProfile } = await supabaseLocal
      .from('users')
      .select('role, first_name, last_name')
      .eq('id', ownerUser.id)
      .single()

    if (!ownerProfile || !['owner', 'admin'].includes(ownerProfile.role)) {
      return errorResponse(403, 'Only PUDO operators (owner/admin) can process scans')
    }

    // Obtener location del owner
    const { data: ownerLocation, error: locErr } = await supabaseLocal
      .from('locations')
      .select('id, name, pudo_id, address, latitude, longitude, gps_validation_radius_meters')
      .eq('owner_id', ownerUser.id)
      .single()

    if (locErr || !ownerLocation) {
      return errorResponse(404, 'PUDO location not found for this user')
    }

    // ─────────────────────────────────────────────────
    // 2. LEER DATOS DEL BODY
    // ─────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const {
      scanned_code,
      scan_mode = 'dropoff',
      gps_latitude,
      gps_longitude,
      gps_accuracy,
    } = body

    if (!scanned_code) {
      return errorResponse(400, 'scanned_code is required')
    }

    console.log(`[process-pudo-scan] Mode: ${scan_mode}, Code: ${scanned_code}, Location: ${ownerLocation.pudo_id}`)

    // ─────────────────────────────────────────────────
    // 3. VALIDAR GPS (si está configurado)
    // ─────────────────────────────────────────────────
    let gpsValidationPassed = true
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
        // No bloqueamos en dropoff, solo advertimos
        console.warn(`[process-pudo-scan] ${gpsValidationMessage}`)
      } else {
        gpsValidationMessage = `GPS validation passed: distance ${distance.toFixed(0)}m within radius ${allowedRadius}m`
      }
    }

    // ─────────────────────────────────────────────────
    // 4. CONSULTAR BD REMOTA PARA OBTENER INFO DEL SHIPMENT
    // ─────────────────────────────────────────────────
    const supabaseRemote = createClient(REMOTE_DB_URL, REMOTE_DB_KEY)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

    // Buscar shipment por tracking_number en BD remota (brickshare)
    // La tabla es `shipments` con columna `tracking_number` y `shipment_status`
    let shipment: any = null
    let remoteConnectionError: string | null = null

    try {
      // Intentar buscar por tracking_number primero
      const { data: shipmentByTracking, error: errByTracking } = await supabaseRemote
        .from('shipments')
        .select('*')
        .eq('tracking_number', scanned_code)
        .maybeSingle()

      if (shipmentByTracking) {
        shipment = shipmentByTracking
      } else {
        // Intentar buscar por brickshare_package_id
        const { data: shipmentByPkgId, error: errByPkgId } = await supabaseRemote
          .from('shipments')
          .select('*')
          .eq('brickshare_package_id', scanned_code)
          .maybeSingle()

        if (shipmentByPkgId) {
          shipment = shipmentByPkgId
        } else {
          // Último intento: buscar por ID directo (UUID)
          const { data: shipmentById, error: errById } = await supabaseRemote
            .from('shipments')
            .select('*')
            .eq('id', scanned_code)
            .maybeSingle()

          if (shipmentById) {
            shipment = shipmentById
          }
        }
      }
    } catch (err: any) {
      remoteConnectionError = `[process-pudo-scan] Remote DB connection error: ${err.message}`
      console.error(remoteConnectionError)
    }

    // Si no se encontró en remoto, aún así creamos el package local con la info disponible
    const shipmentFound = !!shipment
    let remoteShipmentId = shipment?.id || null
    let previousStatus = shipment?.shipment_status || 'unknown'

    console.log(`[process-pudo-scan] Remote shipment found: ${shipmentFound}, ID: ${remoteShipmentId}, Status: ${previousStatus}, ConnectionError: ${remoteConnectionError ? 'YES' : 'NO'}`)

    // ─────────────────────────────────────────────────
    // 5. VERIFICAR QUE NO EXISTE YA EN LOCAL
    // ─────────────────────────────────────────────────
    const { data: existingPackage } = await supabaseAdmin
      .from('packages')
      .select('id, status, tracking_code')
      .eq('tracking_code', scanned_code)
      .maybeSingle()

    if (existingPackage) {
      if (existingPackage.status === 'in_location') {
        return errorResponse(409, `Este paquete ya está registrado en el local (tracking: ${scanned_code})`)
      }
      // Si existe con otro estado, informar
      return errorResponse(409, `Paquete existente con estado: ${existingPackage.status} (tracking: ${scanned_code})`)
    }

    // ─────────────────────────────────────────────────
    // 6. CREAR PACKAGE EN BD LOCAL CON TODA LA INFO
    // ─────────────────────────────────────────────────
    const now = new Date().toISOString()
    const packageData: Record<string, any> = {
      tracking_code: scanned_code,
      type: 'delivery',
      status: 'in_location',
      location_id: ownerLocation.id,
      source_system: 'brickshare',
      external_shipment_id: remoteShipmentId || scanned_code,
      received_at: now,
      remote_shipping_status: previousStatus,
    }

    // Rellenar con datos del shipment remoto si están disponibles
    // Columnas de brickshare: shipping_address, shipping_city, shipping_zip_code, estimated_delivery_date
    if (shipment) {
      packageData.remote_customer_name = shipment.user_id || null

      packageData.remote_delivery_address = shipment.shipping_address
        || null

      packageData.remote_estimated_delivery = shipment.estimated_delivery_date
        || null

      // Guardar todos los datos del shipment remoto como JSON
      packageData.remote_shipment_data = shipment
    }

    const { data: newPackage, error: insertError } = await supabaseAdmin
      .from('packages')
      .insert(packageData)
      .select()
      .single()

    if (insertError) {
      console.error('[process-pudo-scan] Error inserting package:', insertError)
      console.error('[process-pudo-scan] Full error object:', JSON.stringify(insertError))
      return errorResponse(500, `Error creating package: ${insertError.message}`)
    }

    console.log(`[process-pudo-scan] Package created successfully: ${newPackage.id}`)

    // ─────────────────────────────────────────────────
    // 7. REGISTRAR EN pudo_scan_logs
    // ─────────────────────────────────────────────────
    const newStatus = 'delivered_pudo'
    const actionType = 'delivery_confirmation'
    let apiRequestSuccessful = false
    let apiResponseCode = 0
    let apiResponseMessage = ''

    // ─────────────────────────────────────────────────
    // 8. ACTUALIZAR ESTADO REMOTO A "delivered_pudo"
    // ─────────────────────────────────────────────────
    if (shipmentFound && remoteShipmentId) {
      try {
        // Actualizar columna shipment_status en tabla shipments de brickshare
        const { error: updateErr } = await supabaseRemote
          .from('shipments')
          .update({
            shipment_status: 'delivered_pudo',
            updated_at: now,
          })
          .eq('id', remoteShipmentId)

        if (updateErr) {
          console.error('[process-pudo-scan] Error updating shipments.shipment_status:', updateErr)
          apiResponseCode = 500
          apiResponseMessage = `Failed to update remote status: ${updateErr.message}`
        } else {
          apiRequestSuccessful = true
          apiResponseCode = 200
          apiResponseMessage = 'Shipment shipment_status updated to delivered_pudo'
        }
      } catch (err: any) {
        console.error('[process-pudo-scan] Exception updating remote status:', err)
        apiResponseCode = 500
        apiResponseMessage = `Exception: ${err.message}`
      }
    } else {
      apiResponseCode = 404
      apiResponseMessage = 'Shipment not found in remote database - local package created without remote sync'
    }

    // ─────────────────────────────────────────────────
    // 9. REGISTRAR LOG EN pudo_scan_logs
    // ─────────────────────────────────────────────────
    const duration = Date.now() - startTime

    try {
      await supabaseAdmin.from('pudo_scan_logs').insert({
        pudo_location_id: ownerLocation.id,
        remote_shipment_id: remoteShipmentId || scanned_code,
        previous_status: previousStatus,
        new_status: newStatus,
        scanned_by_user_id: ownerUser.id,
        action_type: actionType,
        scan_latitude: gps_latitude || null,
        scan_longitude: gps_longitude || null,
        gps_accuracy_meters: gps_accuracy || null,
        gps_validation_passed: gpsValidationPassed,
        api_request_successful: apiRequestSuccessful,
        api_response_code: apiResponseCode,
        api_response_message: apiResponseMessage || remoteConnectionError || 'Remote DB connection failed',
        api_request_duration_ms: duration,
        device_info: 'Mobile App',
        app_version: '1.0.0',
        metadata: {
          scanned_code: scanned_code,
          scan_mode: scan_mode,
          shipment_found_in_remote: shipmentFound,
          remote_connection_error: remoteConnectionError,
          package_id: newPackage.id,
        },
      })
      console.log('[process-pudo-scan] Scan log created successfully')
    } catch (logErr: any) {
      console.error('[process-pudo-scan] Error logging scan:', logErr)
      console.error('[process-pudo-scan] Full log error:', JSON.stringify(logErr))
    }

    // ─────────────────────────────────────────────────
    // 10. REGISTRAR EVENTO DE AUDITORÍA
    // ─────────────────────────────────────────────────
    try {
      await supabaseAdmin.from('package_events').insert({
        package_id: newPackage.id,
        event_type: 'package_created',
        new_status: 'in_location',
        performed_by: ownerUser.id,
        location_id: ownerLocation.id,
        metadata: {
          scanned_code: scanned_code,
          remote_shipment_id: remoteShipmentId,
          remote_status_updated: apiRequestSuccessful,
          source: 'pudo_scan',
        },
      })
    } catch (evtErr: any) {
      console.error('[process-pudo-scan] Error logging event:', evtErr)
    }

    // ─────────────────────────────────────────────────
    // 11. RETORNAR RESPUESTA COMPLETA
    // ─────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        package: {
          id: newPackage.id,
          tracking_code: scanned_code,
          status: 'in_location',
          type: 'delivery',
          location: {
            id: ownerLocation.id,
            name: ownerLocation.name,
            pudo_id: ownerLocation.pudo_id,
            address: ownerLocation.address,
          },
          received_at: now,
        },
        remote_sync: {
          shipment_found: shipmentFound,
          shipment_id: remoteShipmentId,
          previous_status: previousStatus,
          new_status: apiRequestSuccessful ? 'delivered_pudo' : previousStatus,
          api_updated: apiRequestSuccessful,
          message: apiResponseMessage,
        },
        shipment_data: shipment ? {
          customer_name: packageData.remote_customer_name,
          delivery_address: packageData.remote_delivery_address,
          estimated_delivery: packageData.remote_estimated_delivery,
        } : null,
        gps_validation: {
          passed: gpsValidationPassed,
          message: gpsValidationMessage,
        },
        operator: {
          id: ownerUser.id,
          name: `${ownerProfile.first_name} ${ownerProfile.last_name}`,
        },
        timestamp: now,
        duration_ms: duration,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: any) {
    console.error('[process-pudo-scan] Unexpected error:', err)
    return errorResponse(500, `Internal server error: ${err.message}`)
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
  const R = 6371000
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