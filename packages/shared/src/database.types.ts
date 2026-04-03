// ============================================================
// Tipos auto-derivados del schema de Supabase (Manual Update)
// ============================================================

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          role: 'admin' | 'user'
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          created_at: string
        }
        Insert: { id: string; role?: 'admin' | 'user'; first_name?: string; last_name?: string; email?: string | null; phone?: string | null; created_at?: string }
        Update: { id?: string; role?: 'admin' | 'user'; first_name?: string; last_name?: string; email?: string | null; phone?: string | null; created_at?: string }
      }
      locations: {
        Row: {
          id: string
          name: string
          address: string
          postal_code: string | null
          city: string | null
          commission_rate: number
          is_active: boolean
          pudo_id: string
          latitude: number | null
          longitude: number | null
          gps_validation_radius_meters: number | null
          created_at: string
        }
        Insert: { id?: string; name: string; address: string; postal_code?: string | null; city?: string | null; commission_rate?: number; is_active?: boolean; pudo_id?: string; latitude?: number | null; longitude?: number | null; gps_validation_radius_meters?: number | null; created_at?: string }
        Update: { id?: string; name?: string; address?: string; postal_code?: string | null; city?: string | null; commission_rate?: number; is_active?: boolean; pudo_id?: string; latitude?: number | null; longitude?: number | null; gps_validation_radius_meters?: number | null; created_at?: string }
      }
      user_locations: {
        Row: { user_id: string; location_id: string; created_at: string }
        Insert: { user_id: string; location_id: string; created_at?: string }
        Update: { user_id?: string; location_id?: string; created_at?: string }
      }
      packages: {
        Row: {
          id: string
          tracking_code: string
          type: 'delivery' | 'return'
          status: 'pending_dropoff' | 'in_location' | 'picked_up' | 'returned'
          location_id: string
          customer_id: string | null
          dynamic_qr_hash: string | null
          static_qr_hash: string | null
          qr_expires_at: string | null
          external_shipment_id: string | null
          source_system: string | null
          received_at: string | null
          picked_up_at: string | null
          remote_shipment_data: any | null
          created_at: string
          updated_at: string
        }
        Insert: { id?: string; tracking_code: string; type?: 'delivery' | 'return'; status?: 'pending_dropoff' | 'in_location' | 'picked_up' | 'returned'; location_id: string; customer_id?: string | null; dynamic_qr_hash?: string | null; static_qr_hash?: string | null; qr_expires_at?: string | null; external_shipment_id?: string | null; source_system?: string | null; received_at?: string | null; picked_up_at?: string | null; remote_shipment_data?: any | null; created_at?: string; updated_at?: string }
        Update: { id?: string; tracking_code?: string; type?: 'delivery' | 'return'; status?: 'pending_dropoff' | 'in_location' | 'picked_up' | 'returned'; location_id?: string; customer_id?: string | null; dynamic_qr_hash?: string | null; static_qr_hash?: string | null; qr_expires_at?: string | null; external_shipment_id?: string | null; source_system?: string | null; received_at?: string | null; picked_up_at?: string | null; remote_shipment_data?: any | null; created_at?: string; updated_at?: string }
      }
      // REMOVED: pudo_scan_logs table (eliminada en migration 022)
      package_events: {
        Row: { id: string; package_id: string; event_type: string; old_status: string | null; new_status: string; performed_by: string | null; location_id: string | null; metadata: any | null; created_at: string }
        Insert: { id?: string; package_id: string; event_type: string; old_status?: string | null; new_status: string; performed_by?: string | null; location_id?: string | null; metadata?: any | null; created_at?: string }
        Update: { id?: string; package_id?: string; event_type?: string; old_status?: string | null; new_status?: string; performed_by?: string | null; location_id?: string | null; metadata?: any | null; created_at?: string }
      }
    }
    Views: {
      monthly_profitability: {
        Row: {
          month: string
          location_id: string
          name: string
          commission_rate: number
          total_packages: number
          active_packages: number
          dropoffs: number
          pickups: number
          profitability: number
        }
      }
      pudo_active_packages_enhanced: {
        Row: {
          id: string
          tracking_code: string
          status: string
          location_id: string
          customer_id: string | null
          created_at: string
          updated_at: string
          hours_in_location: number
          customer_name: string
          customer_first_name: string
          customer_last_name: string
          package_type: 'return' | 'delivery'
          package_number: number
        }
      }
      pudo_operations_history: {
        Row: {
          id: string
          scan_timestamp: string
          tracking_code: string
          action_type: string
          previous_status: string
          new_status: string
          result: boolean
          pudo_location_id: string
          operator_name: string
          operator_first_name: string
          operator_last_name: string
          operator_id: string
          location_name: string
          action_type_label: string
          status_transition: string
        }
      }
    }
    Functions: {
      get_pudo_operations_paginated: {
        Args: {
          p_location_id: string
          p_date_from?: string | null
          p_date_to?: string | null
          p_action_type?: string | null
          p_result_filter?: string | null
          p_tracking_search?: string | null
          p_page?: number
          p_limit?: number
        }
        Returns: {
          id: string
          scan_timestamp: string
          tracking_code: string
          action_type: 'delivery_confirmation' | 'return_confirmation'
          action_type_label: string
          previous_status: string
          new_status: string
          status_transition: string
          result: boolean
          operator_name: string
          operator_id: string
          total_count: number
        }[]
      }
      export_pudo_operations_csv: {
        Args: {
          p_location_id: string
          p_date_from?: string | null
          p_date_to?: string | null
          p_action_type?: string | null
          p_result_filter?: string | null
          p_tracking_search?: string | null
        }
        Returns: {
          scan_timestamp: string
          tracking_code: string
          action_type_label: string
          status_transition: string
          result: string
          operator_name: string
        }[]
      }
    }
    Enums: {
      package_status: 'pending_dropoff' | 'in_location' | 'picked_up' | 'returned'
      pudo_action_type: 'delivery_confirmation' | 'return_confirmation'
    }
  }
}
