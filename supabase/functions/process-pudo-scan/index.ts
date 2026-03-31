// ============================================================
// process-pudo-scan — Supabase Edge Function (Deno)
//
// ARQUITECTURA DUAL DATABASE:
// - BD LOCAL (Brickshare via ngrok): Validación de shipments
// - BD CLOUD (Logistics): Registro de logs y eventos
//
// Flujo:
//   1. Autenticar operador PUDO (Cloud)
//   2. Validar QR en shipments.delivery_qr_code (Local via ngrok)
//   3. Verificar shipment_status = 'in_transit_pudo' (Local)
//   4. Actualizar shipment_status = 'delivered_pudo' (Local)
//   5. Registrar en packages, package_events, pudo_scan_logs (Cloud)
//
// POST /functions/v1/process-pudo-scan
// Headers: Authorization: Bearer <OWNER_JWT>
// Body: {
//   "scanned_code": "BS-DEL-714C3F3D-FFD",
//   "scan_mode": "dropoff",
//   "gps_latitude": 40.4168,
//   "gps_longitude": -3.7038,
//   "gps_accuracy": 10.5
// }
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─────────────────────────────────────────────────
// CONFIGURACIÓN DE BASES DE DATOS
// ─────────────────────────────────────────────────
// BD CLOUD (Logistics) - Para auth y logs
const CLOUD_SUPABASE_URL = Deno.env.get('SUPABASE_bricklogistics_URL')!
const CLOUD_SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_bricklogistics_ANON_KEY')!
const CLOUD_SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_bricklogistics_SERVICE_ROLE_KEY')!

// BD LOCAL (Brickshare via ngrok) - Para validar y actualizar shipments
const LOCAL_DB_URL = Deno.env.get('SUPABASE_brickshare_API_URL') || ''
const LOCAL_DB_KEY = Deno.env.get('SUPABASE_brickshare_SERVICE_ROLE_KEY') || ''

console.log('[STARTUP] ===== DUAL DATABASE CONFIGURATION =====')
console.log('[STARTUP] CLOUD DB (Logistics):', CLOUD_SUPABASE_URL)
console.log('[STARTUP] LOCAL DB (Brickshare):', LOCAL_DB_URL || 'NOT SET')
console.log('[STARTUP] DEV_MODE:', Deno.env.get('DEV_MODE') || 'false')
console.log('[STARTUP] ============================================')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function validateEnv() {
  const missing = []
  
  if (!CLOUD_SUPABASE_URL) missing.push('SUPABASE_bricklogistics_URL')
  if (!CLOUD_SUPABASE_SERVICE_ROLE) missing.push('SUPABASE_bricklogistics_SERVICE_ROLE_KEY')
  if (!LOCAL_DB_URL) missing.push('SUPABASE_brickshare_API_URL')
  if (!LOCAL_DB_KEY) missing.push('SUPABASE_brickshare_SERVICE_ROLE_KEY')
  
  if (missing.length > 0) {
    return { valid: false, message: `Missing configuration: ${missing.join(', ')}` }
  }
  
  return { valid: true }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  const envCheck = validateEnv()
  if (!envCheck.valid) {
    return errorResponse(500, envCheck.message!)
  }

  try {
    // ─────────────────────────────────────────────────
    // 1. AUTENTICACIÓN DEL OPERADOR PUDO (Cloud)
    // ─────────────────────────────────────────────────
    let authHeader = req.headers.get('X-Auth-Token') || req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse(401, 'ERR_AUTH_MISSING: Missing Authorization header')
    }

    const bearerToken = authHeader.replace('Bearer ', '')
    const devMode = Deno.env.get('DEV_MODE') === 'true'
    
    let ownerUser: any = null

    if (devMode) {
      console.log('[AUTH] ⚠️ DEV MODE: Bypassing JWT validation')
      ownerUser = {
        id: 'dev-user-id',
        email: 'dev@example.com',
      }
    } else {
      // Decodificar JWT
      try {
        const jwtParts = bearerToken.split('.')
        if (jwtParts.length !== 3) {
          return errorResponse(401, 'ERR_AUTH_INVALID_JWT: Invalid JWT format')
        }
        
        const payload = JSON.parse(atob(jwtParts[1]))
        if (!payload.sub) {
          return errorResponse(401, 'ERR_AUTH_MISSING_SUB: JWT missing sub claim')
        }

        ownerUser = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        }
        console.log('[AUTH] ✓ User authenticated:', ownerUser.email)
      } catch (err: any) {
        return errorResponse(401, `ERR_AUTH_JWT_DECODE: ${err.message}`)
      }
    }

    // Inicializar clientes
    const cloudSupabase = createClient(CLOUD_SUPABASE_URL, CLOUD_SUPABASE_SERVICE_ROLE)
    const localSupabase = createClient(LOCAL_DB_URL, LOCAL_DB_KEY)

    // ─────────────────────────────────────────────────
    // 2. OBTENER UBICACIÓN DEL OPERADOR (Cloud)
    // 
    // NOTA: La validación se basa ÚNICAMENTE en user_locations.
    // El rol del usuario NO importa para procesar escaneos PUDO.
    // Solo se requiere que el usuario tenga una ubicación asignada en user_locations.
    // ─────────────────────────────────────────────────
    let ownerLocation: any

    if (devMode) {
      console.log('[LOCATION] ⚠️ DEV MODE: Loading any available location from Cloud')
      const { data: locations, error: locErr } = await cloudSupabase
        .from('locations')
        .select('id, name, pudo_id, address')
        .limit(1)
      
      if (locErr || !locations || locations.length === 0) {
        return errorResponse(500, 'No locations available in Cloud database')
      }
      
      ownerLocation = locations[0]
      console.log('[LOCATION] ✓ Dev location loaded:', ownerLocation.name)
    } else {
      // Usar nueva arquitectura user_locations (many-to-many)
      const { data: userLocationData, error: locErr } = await cloudSupabase
        .from('user_locations')
        .select(`
          location_id,
          locations (
            id,
            name,
            pudo_id,
            address
          )
        `)
        .eq('user_id', ownerUser.id)
        .limit(1)
        .single()

      if (locErr || !userLocationData || !userLocationData.locations) {
        console.error('[LOCATION] ❌ No location assigned to user:', ownerUser.id)
        return errorResponse(404, 'No location assigned to this user. Please contact administrator.')
      }

      // Extraer location del JOIN
      ownerLocation = Array.isArray(userLocationData.locations) 
        ? userLocationData.locations[0] 
        : userLocationData.locations
        
      console.log('[LOCATION] ✓ Location found:', ownerLocation.name)
    }

    // ─────────────────────────────────────────────────
    // 3. LEER DATOS DEL BODY
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

    console.log(`[SCAN] Mode: ${scan_mode}, Code: ${scanned_code}, Location: ${ownerLocation.pudo_id}`)

    // ─────────────────────────────────────────────────
    // 4. VALIDAR QR EN BD LOCAL (Brickshare)
    // ─────────────────────────────────────────────────
    console.log('[VALIDATE] Checking delivery_qr_code in Local DB...')
    
    const { data: shipment, error: shipmentErr } = await localSupabase
      .from('shipments')
      .select('id, delivery_qr_code, shipment_status, tracking_number, user_id, shipping_address, shipping_city')
      .eq('delivery_qr_code', scanned_code)
      .single()

    if (shipmentErr || !shipment) {
      console.error('[VALIDATE] ❌ QR not found in shipments table:', shipmentErr?.message)
      
      // Registrar intento fallido en Cloud
      await cloudSupabase.from('pudo_scan_logs').insert({
        pudo_location_id: ownerLocation.id,
        remote_shipment_id: scanned_code,
        previous_status: 'unknown',
        new_status: 'validation_failed',
        scanned_by_user_id: ownerUser.id,
        action_type: 'delivery_validation',
        api_request_successful: false,
        api_response_code: 404,
        api_response_message: 'QR code not found or wrong destination',
        api_request_duration_ms: Date.now() - startTime,
        metadata: {
          scanned_code,
          error: 'qr_not_found',
          validation_failed: true,
        },
      })

      return errorResponse(404, 'QR no válido o destino equivocado')
    }

    console.log('[VALIDATE] ✓ Shipment found:', {
      id: shipment.id,
      status: shipment.shipment_status,
      tracking: shipment.tracking_number,
    })

    // ─────────────────────────────────────────────────
    // 5. VALIDAR ESTADO = 'in_transit_pudo'
    // ─────────────────────────────────────────────────
    if (shipment.shipment_status !== 'in_transit_pudo') {
      console.error('[VALIDATE] ❌ Invalid status:', shipment.shipment_status)
      
      // Registrar intento fallido
      await cloudSupabase.from('pudo_scan_logs').insert({
        pudo_location_id: ownerLocation.id,
        remote_shipment_id: shipment.id,
        previous_status: shipment.shipment_status,
        new_status: 'validation_failed',
        scanned_by_user_id: ownerUser.id,
        action_type: 'delivery_validation',
        api_request_successful: false,
        api_response_code: 400,
        api_response_message: `Invalid status: expected 'in_transit_pudo', got '${shipment.shipment_status}'`,
        api_request_duration_ms: Date.now() - startTime,
        metadata: {
          scanned_code,
          error: 'invalid_status',
          expected: 'in_transit_pudo',
          actual: shipment.shipment_status,
        },
      })

      return errorResponse(400, `Estado inválido: se esperaba 'in_transit_pudo', pero el paquete está en '${shipment.shipment_status}'`)
    }

    console.log('[VALIDATE] ✓ Status is correct: in_transit_pudo')

    // ─────────────────────────────────────────────────
    // 6. ACTUALIZAR SHIPMENT EN BD LOCAL
    // ─────────────────────────────────────────────────
    const now = new Date().toISOString()
    
    console.log('[UPDATE] Updating shipment in Local DB...')
    console.log('[UPDATE] Target:', {
      shipment_id: shipment.id,
      current_status: shipment.shipment_status,
      new_status: 'delivered_pudo',
      db_url: LOCAL_DB_URL
    })
    
    const { error: updateErr } = await localSupabase
      .from('shipments')
      .update({
        shipment_status: 'delivered_pudo',
        delivery_validated_at: now,
        updated_at: now,
      })
      .eq('id', shipment.id)

    if (updateErr) {
      console.error('[UPDATE] ❌ Failed to update shipment:', updateErr.message)
      console.error('[UPDATE] ❌ Error details:', updateErr)
      
      // Registrar error
      await cloudSupabase.from('pudo_scan_logs').insert({
        pudo_location_id: ownerLocation.id,
        remote_shipment_id: shipment.id,
        previous_status: 'in_transit_pudo',
        new_status: 'update_failed',
        scanned_by_user_id: ownerUser.id,
        action_type: 'delivery_confirmation',
        api_request_successful: false,
        api_response_code: 500,
        api_response_message: `Failed to update shipment: ${updateErr.message}`,
        api_request_duration_ms: Date.now() - startTime,
        metadata: {
          scanned_code,
          shipment_id: shipment.id,
          error: 'update_failed',
          error_details: updateErr,
        },
      })

      return errorResponse(500, `Error al actualizar shipment: ${updateErr.message}`)
    }

    // Verificar que el UPDATE realmente se aplicó
    console.log('[UPDATE] Verifying update...')
    const { data: verifiedShipment, error: verifyErr } = await localSupabase
      .from('shipments')
      .select('shipment_status, delivery_validated_at')
      .eq('id', shipment.id)
      .single()

    if (verifyErr) {
      console.error('[UPDATE] ❌ Failed to verify update:', verifyErr.message)
      return errorResponse(500, 'Error al verificar actualización del shipment')
    }

    console.log('[UPDATE] ✓ Verification result:', verifiedShipment)

    if (verifiedShipment.shipment_status !== 'delivered_pudo') {
      console.error('[UPDATE] ❌ Update verification failed!')
      console.error('[UPDATE] ❌ Expected: delivered_pudo, Got:', verifiedShipment.shipment_status)
      
      // Registrar fallo de verificación
      await cloudSupabase.from('pudo_scan_logs').insert({
        pudo_location_id: ownerLocation.id,
        remote_shipment_id: shipment.id,
        previous_status: 'in_transit_pudo',
        new_status: 'verification_failed',
        scanned_by_user_id: ownerUser.id,
        action_type: 'delivery_confirmation',
        api_request_successful: false,
        api_response_code: 500,
        api_response_message: `Update verification failed: status is ${verifiedShipment.shipment_status}`,
        api_request_duration_ms: Date.now() - startTime,
        metadata: {
          scanned_code,
          shipment_id: shipment.id,
          error: 'verification_failed',
          expected_status: 'delivered_pudo',
          actual_status: verifiedShipment.shipment_status,
        },
      })

      return errorResponse(500, 'La actualización del shipment no se pudo verificar')
    }

    console.log('[UPDATE] ✓ Shipment successfully updated and verified to delivered_pudo')

    // ─────────────────────────────────────────────────
    // 7. REGISTRAR EN BD CLOUD - packages
    // ─────────────────────────────────────────────────
    console.log('[CLOUD] Creating package record...')
    const { data: newPackage, error: packageErr } = await cloudSupabase
      .from('packages')
      .insert({
        tracking_code: scanned_code,
        type: 'delivery',
        status: 'in_location',
        location_id: ownerLocation.id,
        source_system: 'brickshare',
        external_shipment_id: shipment.id,
        received_at: now,
        remote_shipment_data: shipment,
      })
      .select()
      .single()

    if (packageErr) {
      console.error('[CLOUD] ❌ Failed to create package:', packageErr.message)
      // Continuamos, el shipment YA está actualizado en Local
    } else {
      console.log('[CLOUD] ✓ Package created:', newPackage.id)
    }

    // ─────────────────────────────────────────────────
    // 8. REGISTRAR EN BD CLOUD - package_events
    // ─────────────────────────────────────────────────
    if (newPackage) {
      try {
        await cloudSupabase.from('package_events').insert({
          package_id: newPackage.id,
          event_type: 'dropoff',
          old_status: null,
          new_status: 'in_location',
          performed_by: ownerUser.id,
          location_id: ownerLocation.id,
          metadata: {
            scanned_code,
            shipment_id: shipment.id,
            tracking_number: shipment.tracking_number,
            source: 'pudo_scan',
          },
        })
        console.log('[CLOUD] ✓ Package event created')
      } catch (eventErr: any) {
        console.error('[CLOUD] ⚠️ Failed to create event:', eventErr.message)
      }
    }

    // ─────────────────────────────────────────────────
    // 9. REGISTRAR EN BD CLOUD - pudo_scan_logs
    // ─────────────────────────────────────────────────
    const duration = Date.now() - startTime
    
    try {
      await cloudSupabase.from('pudo_scan_logs').insert({
        pudo_location_id: ownerLocation.id,
        remote_shipment_id: shipment.id,
        previous_status: 'in_transit_pudo',
        new_status: 'delivered_pudo',
        scanned_by_user_id: ownerUser.id,
        action_type: 'delivery_confirmation',
        scan_latitude: gps_latitude || null,
        scan_longitude: gps_longitude || null,
        gps_accuracy_meters: gps_accuracy || null,
        gps_validation_passed: true,
        api_request_successful: true,
        api_response_code: 200,
        api_response_message: 'Shipment successfully delivered to PUDO',
        api_request_duration_ms: duration,
        metadata: {
          scanned_code,
          shipment_id: shipment.id,
          tracking_number: shipment.tracking_number,
          package_id: newPackage?.id,
          local_db_updated: true,
          cloud_db_updated: !!newPackage,
          device_info: 'Mobile App',
          app_version: '1.0.0',
        },
      })
      console.log('[CLOUD] ✓ Scan log created')
    } catch (logErr: any) {
      console.error('[CLOUD] ⚠️ Failed to create scan log:', logErr.message)
    }

    // ─────────────────────────────────────────────────
    // 10. RETORNAR RESPUESTA EXITOSA
    // ─────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Paquete recepcionado exitosamente en PUDO',
        package: {
          id: newPackage?.id,
          tracking_code: scanned_code,
          tracking_number: shipment.tracking_number,
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
        shipment: {
          id: shipment.id,
          previous_status: 'in_transit_pudo',
          new_status: 'delivered_pudo',
          updated_at: now,
          customer_id: shipment.user_id,
          delivery_address: shipment.shipping_address,
        },
        operator: {
          id: ownerUser.id,
          email: ownerUser.email,
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
    console.error('[ERROR] Unexpected error:', err)
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