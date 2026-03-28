import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing environment variables')
  console.warn('[Supabase] URL:', supabaseUrl ? 'present' : 'MISSING')
  console.warn('[Supabase] Key:', supabaseAnonKey ? 'present' : 'MISSING')
}

let supabase: any = null

try {
  supabase = createClient<Database>(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key')
} catch (err) {
  console.error('[Supabase] Error creating client:', err)
  // Crear un cliente dummy para evitar que la app crashee
  supabase = {}
}

export { supabase }