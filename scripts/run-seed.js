// Script temporal para ejecutar el seed en Supabase
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://qumjzvhtotcvnzpjgjkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDY2MzAsImV4cCI6MjA4OTUyMjYzMH0.j3Lr55c8-L1SuGqFtl9_zpODGhrKT-BGe7IlF2hKyNQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSeed() {
  try {
    console.log('🔄 Reading seed file...');
    const sqlFile = join(__dirname, '..', 'supabase', 'seed_test_data.sql');
    const sql = readFileSync(sqlFile, 'utf-8');
    
    console.log('🔄 Executing seed script...');
    console.log('⚠️  Note: This uses the anon key, so it may have RLS restrictions.');
    console.log('   For best results, run this script from Supabase SQL Editor.');
    console.log('');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('❌ Error executing seed:', error);
      process.exit(1);
    }
    
    console.log('✅ Seed executed successfully!');
    console.log(data);
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

runSeed();