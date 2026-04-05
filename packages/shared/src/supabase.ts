import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// ════════════════════════════════════════════════════════════
// DB1 (Brickshare_logistics) - CLOUD SUPABASE CLIENT
// ════════════════════════════════════════════════════════════
// Propósito: Autenticación de usuarios + Registro de logs
// Usado por: LoginScreen, Edge Functions invocation
// ════════════════════════════════════════════════════════════
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing environment variables')
}

// Cliente default (Production)
let supabase: any = null
try {
  supabase = createClient<Database>(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key')
} catch (err) {
  console.error('[Supabase] Error creating production client:', err)
  supabase = {}
}

// ════════════════════════════════════════════════════════════
// DB2 (Brickshare) - LOCAL DATABASE CLIENT VÍA NGROK
// ════════════════════════════════════════════════════════════
// Propósito: Acceso directo a shipments (usado desde Edge Functions)
// Nota: La app móvil NO usa este cliente directamente, solo para logs
// El acceso real a DB2 lo hace la Edge Function desde DB1
// ════════════════════════════════════════════════════════════
const localSupabaseUrl = process.env.EXPO_PUBLIC_LOCAL_SUPABASE_URL ?? ''
const localSupabaseAnonKey = process.env.EXPO_PUBLIC_LOCAL_SUPABASE_ANON_KEY ?? ''

let supabaseLocal: any = null
if (localSupabaseUrl && localSupabaseAnonKey) {
  try {
    supabaseLocal = createClient<Database>(localSupabaseUrl, localSupabaseAnonKey)
    console.log('[Supabase] Local client initialized OK')
  } catch (err) {
    console.error('[Supabase] Error creating local client:', err)
    supabaseLocal = supabase // Fallback to main if local fails
  }
} else {
  // If no local config, use the main one
  supabaseLocal = supabase
}

export { supabase, supabaseLocal }