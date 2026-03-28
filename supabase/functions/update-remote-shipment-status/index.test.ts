// ============================================================
// Tests Unitarios para update-remote-shipment-status
// ============================================================

import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'

// ============================================================
// Test 1: Cálculo de distancia GPS (Haversine)
// ============================================================

Deno.test('calculateDistance - Madrid Centro a Madrid Norte (~10km)', () => {
  // Coordenadas de Madrid Centro
  const lat1 = 40.4168
  const lon1 = -3.7038

  // Coordenadas de Madrid Norte (Chamartín)
  const lat2 = 40.4634
  const lon2 = -3.6827

  const distance = calculateDistance(lat1, lon1, lat2, lon2)

  // Distancia esperada: aproximadamente 5300 metros
  assertEquals(distance > 5000 && distance < 6000, true, 'Distance should be around 5.3km')
})

Deno.test('calculateDistance - Misma ubicación (0 metros)', () => {
  const lat = 40.4168
  const lon = -3.7038

  const distance = calculateDistance(lat, lon, lat, lon)

  assertEquals(distance, 0, 'Distance to same point should be 0')
})

Deno.test('calculateDistance - 50 metros de distancia', () => {
  // Coordenadas con ~50m de diferencia
  const lat1 = 40.4168
  const lon1 = -3.7038

  // Aproximadamente 50m al norte
  const lat2 = 40.41725
  const lon2 = -3.7038

  const distance = calculateDistance(lat1, lon1, lat2, lon2)

  // Debe estar cerca de 50m (con margen de error)
  assertEquals(distance > 40 && distance < 60, true, 'Distance should be around 50m')
})

// ============================================================
// Test 2: Validación de transiciones de estado
// ============================================================

Deno.test('validateStatusTransition - in_transit_pudo to delivered_pudo (válido)', () => {
  const isValid = validateStatusTransition('in_transit_pudo', 'delivered_pudo')
  assertEquals(isValid, true)
})

Deno.test('validateStatusTransition - in_return_pudo to in_return (válido)', () => {
  const isValid = validateStatusTransition('in_return_pudo', 'in_return')
  assertEquals(isValid, true)
})

Deno.test('validateStatusTransition - delivered to delivered_pudo (inválido)', () => {
  const isValid = validateStatusTransition('delivered', 'delivered_pudo')
  assertEquals(isValid, false)
})

Deno.test('validateStatusTransition - pending to in_return (inválido)', () => {
  const isValid = validateStatusTransition('pending', 'in_return')
  assertEquals(isValid, false)
})

// ============================================================
// Test 3: Hash de string
// ============================================================

Deno.test('hashString - genera hash consistente', () => {
  const input = 'test-qr-data-12345'
  const hash1 = hashString(input)
  const hash2 = hashString(input)

  assertEquals(hash1, hash2, 'Hash should be consistent for same input')
  assertExists(hash1, 'Hash should exist')
  assertEquals(typeof hash1, 'string', 'Hash should be a string')
})

Deno.test('hashString - diferentes inputs generan diferentes hashes', () => {
  const hash1 = hashString('input1')
  const hash2 = hashString('input2')

  assertEquals(hash1 !== hash2, true, 'Different inputs should generate different hashes')
})

// ============================================================
// Test 4: Validación de payload de request
// ============================================================

Deno.test('validateRequestBody - body válido con todos los campos', () => {
  const body = {
    shipment_id: 'abc-123',
    qr_data: 'eyJhbGc...',
    gps_latitude: 40.4168,
    gps_longitude: -3.7038,
    gps_accuracy: 10.5,
  }

  const validation = validateRequestBody(body)
  assertEquals(validation.valid, true)
  assertEquals(validation.errors.length, 0)
})

Deno.test('validateRequestBody - body sin shipment_id (inválido)', () => {
  const body = {
    qr_data: 'eyJhbGc...',
    gps_latitude: 40.4168,
    gps_longitude: -3.7038,
  }

  const validation = validateRequestBody(body)
  assertEquals(validation.valid, false)
  assertEquals(validation.errors.includes('shipment_id is required'), true)
})

Deno.test('validateRequestBody - coordenadas GPS opcionales', () => {
  const body = {
    shipment_id: 'abc-123',
    qr_data: 'eyJhbGc...',
  }

  const validation = validateRequestBody(body)
  assertEquals(validation.valid, true, 'GPS coordinates should be optional')
})

// ============================================================
// Test 5: Construcción de response exitoso
// ============================================================

Deno.test('buildSuccessResponse - estructura correcta', () => {
  const response = buildSuccessResponse({
    shipment_id: 'ship-123',
    previous_status: 'in_transit_pudo',
    new_status: 'delivered_pudo',
    action_type: 'delivery_confirmation',
    location: { id: 'loc-456', name: 'Kiosko Central' },
    gps_validated: true,
    gps_message: 'GPS validation passed: distance 15m within radius 50m',
    duration_ms: 234,
  })

  assertEquals(response.success, true)
  assertEquals(response.shipment_id, 'ship-123')
  assertEquals(response.previous_status, 'in_transit_pudo')
  assertEquals(response.new_status, 'delivered_pudo')
  assertEquals(response.action_type, 'delivery_confirmation')
  assertExists(response.timestamp)
  assertEquals(response.duration_ms, 234)
  assertEquals(response.gps_validation.passed, true)
})

// ============================================================
// Helper Functions (para testing)
// ============================================================

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

function validateStatusTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  const validTransitions: Record<string, string[]> = {
    in_transit_pudo: ['delivered_pudo'],
    in_return_pudo: ['in_return'],
  }

  return validTransitions[currentStatus]?.includes(newStatus) || false
}

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(16)
}

interface RequestBody {
  shipment_id?: string
  qr_data?: string
  gps_latitude?: number
  gps_longitude?: number
  gps_accuracy?: number
}

function validateRequestBody(body: RequestBody): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!body.shipment_id) {
    errors.push('shipment_id is required')
  }

  // GPS coordinates son opcionales
  // pero si se proporciona una, deben proporcionarse ambas
  const hasLat = body.gps_latitude !== undefined
  const hasLon = body.gps_longitude !== undefined

  if (hasLat !== hasLon) {
    errors.push('Both gps_latitude and gps_longitude must be provided together')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

interface SuccessResponseParams {
  shipment_id: string
  previous_status: string
  new_status: string
  action_type: string
  location: { id: string; name: string }
  gps_validated: boolean
  gps_message: string
  duration_ms: number
}

function buildSuccessResponse(params: SuccessResponseParams) {
  return {
    success: true,
    shipment_id: params.shipment_id,
    previous_status: params.previous_status,
    new_status: params.new_status,
    action_type: params.action_type,
    pudo_location: params.location,
    gps_validation: {
      passed: params.gps_validated,
      message: params.gps_message,
    },
    timestamp: new Date().toISOString(),
    duration_ms: params.duration_ms,
  }
}