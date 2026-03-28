// ============================================================
// Tipos auto-derivados del schema de Supabase
// Actualizar con: npx supabase gen types typescript --project-id qumjzvhtotcvnzpjgjkl > packages/shared/src/database.types.ts
// ============================================================

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          role: 'admin' | 'owner' | 'customer'
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          created_at: string
        }
        Insert: {
          id: string
          role?: 'admin' | 'owner' | 'customer'
          first_name?: string
          last_name?: string
          email?: string | null
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          role?: 'admin' | 'owner' | 'customer'
          first_name?: string
          last_name?: string
          email?: string | null
          phone?: string | null
          created_at?: string
        }
      }
      locations: {
        Row: {
          id: string
          owner_id: string
          name: string
          location_name: string | null
          address: string
          postal_code: string | null
          city: string | null
          commission_rate: number
          is_active: boolean
          pudo_id: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          location_name?: string | null
          address: string
          postal_code?: string | null
          city?: string | null
          commission_rate?: number
          is_active?: boolean
          pudo_id?: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          location_name?: string | null
          address?: string
          postal_code?: string | null
          city?: string | null
          commission_rate?: number
          is_active?: boolean
          pudo_id?: string
          created_at?: string
        }
      }
      packages: {
        Row: {
          id: string
          tracking_code: string
          status: 'pending_dropoff' | 'in_location' | 'picked_up' | 'returned'
          location_id: string
          customer_id: string | null
          dynamic_qr_hash: string | null
          qr_expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tracking_code: string
          status?: 'pending_dropoff' | 'in_location' | 'picked_up' | 'returned'
          location_id: string
          customer_id?: string | null
          dynamic_qr_hash?: string | null
          qr_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tracking_code?: string
          status?: 'pending_dropoff' | 'in_location' | 'picked_up' | 'returned'
          location_id?: string
          customer_id?: string | null
          dynamic_qr_hash?: string | null
          qr_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      monthly_profitability: {
        Row: {
          month: string
          location_id: string
          location_name: string
          owner_id: string
          commission_rate: number
          total_packages: number
          active_packages: number
          dropoffs: number
          pickups: number
          profitability: number
        }
      }
    }
    Functions: Record<string, never>
    Enums: {
      package_status: 'pending_dropoff' | 'in_location' | 'picked_up' | 'returned'
    }
  }
}
