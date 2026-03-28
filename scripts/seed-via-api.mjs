#!/usr/bin/env node
// Script para insertar datos de prueba usando la API de Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qumjzvhtotcvnzpjgjkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDY2MzAsImV4cCI6MjA4OTUyMjYzMH0.j3Lr55c8-L1SuGqFtl9_zpODGhrKT-BGe7IlF2hKyNQ';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('❌ ERROR: Cannot execute seed via API due to RLS restrictions.');
console.log('');
console.log('📋 INSTRUCTIONS:');
console.log('1. Open https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/sql');
console.log('2. Click on "New query"');
console.log('3. Copy the content of: supabase/seed_test_data.sql');
console.log('4. Paste it in the SQL Editor');
console.log('5. Click "RUN" button');
console.log('');
console.log('The seed script will:');
console.log('  ✓ Create 100 test packages');
console.log('  ✓ Create ~180 scan logs');
console.log('  ✓ Distribute data across last 60 days');
console.log('  ✓ Create test owner and customer users');
console.log('');
console.log('After execution, the script will display the owner UUID.');
console.log('Use it to access: http://localhost:3000/dashboard?impersonate=[UUID]');

process.exit(0);