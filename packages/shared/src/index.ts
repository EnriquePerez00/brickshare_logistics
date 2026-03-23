// ============================================================
// Tipos de Base de Datos (espejo del schema de Supabase)
// ============================================================

export type UserRole = 'admin' | 'owner' | 'customer'

export type PackageStatus =
  | 'pending_dropoff'
  | 'in_location'
  | 'picked_up'
  | 'returned'

export interface User {
  id: string
  role: UserRole
  first_name: string
  last_name: string
  email: string
  phone: string
  created_at: string
}

export interface Location {
  id: string
  owner_id: string
  name: string
  location_name?: string
  address: string
  postal_code?: string
  city?: string
  commission_rate: number // EUR por paquete, ej: 0.35
  is_active: boolean
  created_at: string
}

export interface Package {
  id: string
  tracking_code: string
  status: PackageStatus
  location_id: string
  customer_id: string | null
  dynamic_qr_hash: string | null
  qr_expires_at: string | null // ISO timestamp
  created_at: string
  updated_at: string
}

// ============================================================
// Tipos de Respuesta de Edge Functions
// ============================================================

export interface GenerateQrResponse {
  qr_hash: string
  expires_at: string
  package_id: string
}

export interface VerifyQrResponse {
  success: boolean
  package_id: string
  tracking_code: string
  picked_up_at: string
}

// ============================================================
// Tipos para el Dashboard de Rentabilidad
// ============================================================

export interface MonthlyStats {
  month: string // ej: "2025-03"
  dropoffs: number
  pickups: number
  profitability: number // EUR
  location_id: string
  location_name: string
}

// ============================================================
// Re-exports
// ============================================================
export * from './supabase'
