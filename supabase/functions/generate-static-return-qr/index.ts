// ============================================================
// generate-static-return-qr — Supabase Edge Function (Deno)
//
// Genera un JWT firmado estático para devoluciones.
// A diferencia del QR dinámico, este NO expira temporalmente.
// Solo se invalida cuando se escanea o se cancela la devolución.
//
// POST /functions/v1/generate-static-return-qr
// Headers: Authorization: Bearer <CUSTOMER_JWT> o <SERVICE_ROLE_KEY>
// Body:    { "package_id": "uuid" }
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { create } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const SUPABASE_URL      = Deno.env.get('SUPABASE_bricklogistics_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_bricklogistics_ANON_KEY')!
const JWT_SECRET        = Deno.env.get('QR_JWT_SECRET_bricklogistics')!  // Secret específico para QRs
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_bricklogistics_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Autenticar - puede ser customer o service role (para integración)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse(401, 'Missing Authorization header')
    }

    const isServiceRole = authHeader.includes(SERVICE_ROLE_KEY)
    
    // Crear cliente con el JWT apropiado
    const supabase = createClient(
      SUPABASE_URL, 
      isServiceRole ? SERVICE_ROLE_KEY : SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: authHeader } },
      }
    )

    let userId: string | null = null

    if (!isServiceRole) {
      // Si no es service role, obtener usuario del JWT
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return errorResponse(401, 'Invalid or expired session')
      }
      userId = user.id
    }

    // 2. Leer y validar el body
    const body = await req.json().catch(() => ({}))
    const packageId: string = body?.package_id

    if (!packageId || typeof packageId !== 'string') {
      return errorResponse(400, 'package_id is required')
    }

    // 3. Admin client para leer sin restricciones
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Verificar que el paquete existe y es de tipo 'return'
    const { data: pkg, error: pkgError } = await supabaseAdmin
      .from('packages')
      .select('id, type, status, customer_id, location_id, external_shipment_id, source_system')
      .eq('id', packageId)
      .single()

    if (pkgError || !pkg) {
      return errorResponse(404, 'Package not found')
    }

    // Validar que es un package de devolución
    if (pkg.type !== 'return') {
      return errorResponse(400, 'This function is only for return packages. Use generate-dynamic-qr for deliveries.')
    }

    // Si no es service role, validar que el paquete pertenece al usuario
    if (!isServiceRole && userId && pkg.customer_id !== userId) {
      return errorResponse(403, 'This package does not belong to you')
    }

    // Validar estado - solo pending_dropoff puede generar QR de devolución
    if (pkg.status !== 'pending_dropoff') {
      return errorResponse(409, `Cannot generate return QR. Package status: ${pkg.status}`)
    }

    // 4. Generar el JWT de QR con HMAC-SHA256
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )

    const now = Math.floor(Date.now() / 1000)

    // Para returns, no ponemos exp (expiration) ya que no expira temporalmente
    // Se invalida solo cuando se escanea
    const qrJwt = await create(
      { alg: 'HS256', typ: 'JWT' },
      {
        sub:                pkg.customer_id || 'anonymous',
        package_id:         packageId,
        location_id:        pkg.location_id,
        type:               'return',
        external_shipment_id: pkg.external_shipment_id,
        source_system:      pkg.source_system,
        iat:                now,
        // NO incluir exp - este QR no expira temporalmente
      },
      key,
    )

    // 5. Guardar el hash estático en la BD
    const { error: updateError } = await supabaseAdmin
      .from('packages')
      .update({
        static_qr_hash: qrJwt,
      })
      .eq('id', packageId)

    if (updateError) {
      console.error('DB update error:', updateError)
      return errorResponse(500, 'Failed to store static QR hash')
    }

    // 6. Responder con el QR estático
    return new Response(
      JSON.stringify({
        qr_hash:             qrJwt,
        type:                'return',
        package_id:          packageId,
        location_id:         pkg.location_id,
        external_shipment_id: pkg.external_shipment_id,
        expires:             false, // No expira temporalmente
        created_at:          new Date(now * 1000).toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return errorResponse(500, 'Internal server error')
  }
})

function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
}