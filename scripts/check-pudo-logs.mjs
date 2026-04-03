import { createClient } from '@supabase/supabase-js'

// DB1: Brickshare_logistics (Cloud Supabase) - Production
const CLOUD_URL = 'https://qumjzvhtotcvnzpjgjkl.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDY2MzAsImV4cCI6MjA4OTUyMjYzMH0.j3Lr55c8-L1SuGqFtl9_zpODGhrKT-BGe7IlF2hKyNQ'

const supabase = createClient(CLOUD_URL, ANON_KEY)

console.log('⚠️  NOTA: La tabla pudo_scan_logs fue eliminada en migration 022')
console.log('   Los logs ahora se registran en package_events\n')

try {
  const { data, error, count } = await supabase
    .from('package_events')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10)

  console.log('✓ Query successful')
  console.log(`Total package events: ${count}`)
  
  if (data && data.length > 0) {
    console.log('\nLast 10 package events:')
    data.forEach((record, i) => {
      console.log(`\n[${i + 1}] ID: ${record.id}`)
      console.log(`    Package: ${record.package_id}`)
      console.log(`    Event: ${record.event_type}`)
      console.log(`    Status: ${record.old_status || 'N/A'} → ${record.new_status}`)
      console.log(`    Performed by: ${record.performed_by || 'N/A'}`)
      console.log(`    Location: ${record.location_id || 'N/A'}`)
      console.log(`    Created: ${record.created_at}`)
      if (record.metadata) {
        console.log(`    Metadata:`, JSON.stringify(record.metadata, null, 2))
      }
    })
  } else {
    console.log('\n❌ No records found in package_events')
  }

  if (error) {
    console.error('\n❌ Query error:', error)
  }
} catch (err) {
  console.error('❌ Connection error:', err.message)
}