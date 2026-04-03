import { createClient } from '@supabase/supabase-js'

// DB1: Brickshare_logistics (Cloud Supabase) - Production
const CLOUD_URL = 'https://qumjzvhtotcvnzpjgjkl.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDY2MzAsImV4cCI6MjA4OTUyMjYzMH0.j3Lr55c8-L1SuGqFtl9_zpODGhrKT-BGe7IlF2hKyNQ'

const supabase = createClient(CLOUD_URL, ANON_KEY)

try {
  const { data, error, count } = await supabase
    .from('pudo_scan_logs')
    .select('*', { count: 'exact' })

  console.log('✓ Query successful')
  console.log(`Total records: ${count}`)
  
  if (data && data.length > 0) {
    console.log('\nLast 3 records:')
    data.slice(-3).forEach((record, i) => {
      console.log(`\n[${i + 1}] ID: ${record.id}`)
      console.log(`    Shipment: ${record.remote_shipment_id}`)
      console.log(`    Action: ${record.action_type}`)
      console.log(`    Status: ${record.previous_status} → ${record.new_status}`)
      console.log(`    API Success: ${record.api_request_successful}`)
      console.log(`    Created: ${record.created_at}`)
    })
  } else {
    console.log('\n❌ No records found in pudo_scan_logs')
  }

  if (error) {
    console.error('\n❌ Query error:', error)
  }
} catch (err) {
  console.error('❌ Connection error:', err.message)
}