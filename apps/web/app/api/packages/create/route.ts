import { NextResponse } from 'next/server'
import { supabase } from '@brickshare/shared'

export const dynamic = 'force-dynamic'

const SHARED_SECRET = process.env.SUPABASE_INTEGRATION_SECRET || 'change-me-in-production'

/**
 * API endpoint para crear packages desde sistemas externos (Brickshare)
 * 
 * POST /api/packages/create
 * Headers:
 *   - Content-Type: application/json
 *   - X-Integration-Secret: <shared_secret>
 * Body:
 *   - tracking_code: string
 *   - type: 'delivery' | 'return'
 *   - location_id: string (UUID)
 *   - customer_id?: string (UUID, opcional)
 *   - external_shipment_id: string
 *   - source_system: string (default: 'brickshare')
 */
export async function POST(req: Request) {
  console.log('[API Packages Create] Inbound POST request')
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Integration-Secret',
  }

  try {
    // 1. Verificar autenticación
    const secret = req.headers.get('X-Integration-Secret')
    if (!secret || secret !== SHARED_SECRET) {
      console.error('[API Packages Create] Invalid or missing integration secret')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      )
    }

    // 2. Parsear body
    const body = await req.json()
    const {
      tracking_code,
      type,
      location_id,
      customer_id,
      external_shipment_id,
      source_system = 'brickshare'
    } = body

    // 3. Validar campos requeridos
    if (!tracking_code || !type || !location_id || !external_shipment_id) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['tracking_code', 'type', 'location_id', 'external_shipment_id']
        },
        { status: 400, headers: corsHeaders }
      )
    }

    // 4. Validar tipo
    if (type !== 'delivery' && type !== 'return') {
      return NextResponse.json(
        { error: 'Invalid type. Must be "delivery" or "return"' },
        { status: 400, headers: corsHeaders }
      )
    }

    // 5. Verificar que el location existe y está activo
    const { data: location, error: locationError } = await supabase
      .from('locations')
      .select('id, is_active, name')
      .eq('id', location_id)
      .single()

    if (locationError || !location) {
      console.error('[API Packages Create] Location not found:', location_id)
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    if (!location.is_active) {
      return NextResponse.json(
        { error: 'Location is inactive' },
        { status: 400, headers: corsHeaders }
      )
    }

    // 6. Crear el package
    const { data: newPackage, error: createError } = await supabase
      .from('packages')
      .insert({
        tracking_code,
        type,
        status: 'pending_dropoff',
        location_id,
        customer_id: customer_id || null,
        external_shipment_id,
        source_system
      })
      .select()
      .single()

    if (createError) {
      console.error('[API Packages Create] Database error:', createError)
      
      // Manejo de error de tracking_code duplicado
      if (createError.code === '23505') {
        return NextResponse.json(
          { error: 'Package with this tracking code already exists' },
          { status: 409, headers: corsHeaders }
        )
      }

      return NextResponse.json(
        { error: 'Failed to create package', details: createError.message },
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('[API Packages Create] Package created successfully:', newPackage.id)

    // 7. Respuesta exitosa
    return NextResponse.json(
      {
        success: true,
        package: {
          id: newPackage.id,
          tracking_code: newPackage.tracking_code,
          type: newPackage.type,
          status: newPackage.status,
          location_id: newPackage.location_id,
          name: location.name,
          external_shipment_id: newPackage.external_shipment_id,
          created_at: newPackage.created_at
        }
      },
      { status: 201, headers: corsHeaders }
    )
  } catch (error) {
    console.error('[API Packages Create] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Integration-Secret',
    }
  })
}