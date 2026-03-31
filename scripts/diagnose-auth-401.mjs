#!/usr/bin/env node

/**
 * Diagnostic script for 401 auth error in dashboard
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qumjzvhtotcvnzpjgjkl.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDY2MzAsImV4cCI6MjA4OTUyMjYzMH0.j3Lr55c8-L1SuGqFtl9_zpODGhrKT-BGe7IlF2hKyNQ';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk0NjYzMCwiZXhwIjoyMDg5NTIyNjMwfQ.qFhuNtT7jw5TrvJSzg28GiYVPQGLMSJ9JYeWhMDb_4o';

const USER_EMAIL = 'user@brickshare.eu';
const USER_PASSWORD = 'Test123456!';

console.log('🔍 Diagnostic: 401 Auth Error in Dashboard\n');
console.log('='.repeat(60));

async function main() {
  try {
    // 1. Test login and get session
    console.log('\n📝 Step 1: Testing user login...');
    console.log('-'.repeat(60));
    
    const supabaseClient = createClient(SUPABASE_URL, ANON_KEY);
    
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: USER_EMAIL,
      password: USER_PASSWORD
    });
    
    if (authError) {
      console.error('❌ Login failed:', authError.message);
      return;
    }
    
    console.log('✓ Login successful');
    console.log(`  User ID: ${authData.user.id}`);
    console.log(`  Email: ${authData.user.email}`);
    console.log(`  Session: ${authData.session ? 'Present' : 'Missing'}`);
    console.log(`  Access Token: ${authData.session?.access_token ? authData.session.access_token.substring(0, 20) + '...' : 'Missing'}`);
    
    const userId = authData.user.id;
    const accessToken = authData.session?.access_token;
    
    // 2. Check user_locations
    console.log('\n📍 Step 2: Checking user_locations...');
    console.log('-'.repeat(60));
    
    const { data: userLocations, error: ulError } = await supabaseClient
      .from('user_locations')
      .select('location_id, locations(id, name)')
      .eq('user_id', userId);
    
    if (ulError) {
      console.error('❌ Error fetching user_locations:', ulError.message);
    } else if (!userLocations || userLocations.length === 0) {
      console.error('❌ No locations found for user');
      console.log('   This is the ROOT CAUSE of the 401 error!');
      console.log('   The user needs a record in user_locations table.');
      return;
    } else {
      console.log('✓ User locations found:', userLocations.length);
      userLocations.forEach(ul => {
        console.log(`  - Location ID: ${ul.location_id}`);
        console.log(`    Name: ${ul.locations?.name || 'N/A'}`);
      });
    }
    
    const locationId = userLocations[0].location_id;
    
    // 3. Check packages with user's session (simulating API call)
    console.log('\n📦 Step 3: Testing packages query WITH user session...');
    console.log('-'.repeat(60));
    
    const { data: packagesWithAuth, error: packagesAuthError } = await supabaseClient
      .from('packages')
      .select('id, tracking_code, status, location_id')
      .eq('location_id', locationId)
      .eq('status', 'in_location');
    
    if (packagesAuthError) {
      console.error('❌ Error with authenticated query:', packagesAuthError.message);
      console.log('   This means RLS policies are blocking the user!');
    } else {
      console.log('✓ Packages query successful with user session');
      console.log(`  Found ${packagesWithAuth?.length || 0} packages`);
      if (packagesWithAuth && packagesWithAuth.length > 0) {
        packagesWithAuth.slice(0, 3).forEach(pkg => {
          console.log(`  - ${pkg.tracking_code} (${pkg.status})`);
        });
      }
    }
    
    // 4. Check with SERVICE_ROLE (bypass RLS)
    console.log('\n🔑 Step 4: Testing with SERVICE_ROLE_KEY (bypass RLS)...');
    console.log('-'.repeat(60));
    
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    
    const { data: packagesAdmin, error: packagesAdminError } = await supabaseAdmin
      .from('packages')
      .select('id, tracking_code, status, location_id')
      .eq('location_id', locationId)
      .eq('status', 'in_location');
    
    if (packagesAdminError) {
      console.error('❌ Error with SERVICE_ROLE:', packagesAdminError.message);
    } else {
      console.log('✓ SERVICE_ROLE query successful');
      console.log(`  Found ${packagesAdmin?.length || 0} packages`);
      if (packagesAdmin && packagesAdmin.length > 0) {
        packagesAdmin.slice(0, 3).forEach(pkg => {
          console.log(`  - ${pkg.tracking_code} (${pkg.status})`);
        });
      }
    }
    
    // 5. Check RLS policies
    console.log('\n🛡️  Step 5: Checking RLS policies...');
    console.log('-'.repeat(60));
    
    const { data: rlsPolicies, error: rlsError } = await supabaseAdmin
      .from('pg_policies')
      .select('tablename, policyname, cmd, qual')
      .eq('schemaname', 'public')
      .eq('tablename', 'packages');
    
    if (rlsError) {
      console.log('⚠️  Could not fetch RLS policies:', rlsError.message);
    } else if (rlsPolicies && rlsPolicies.length > 0) {
      console.log('✓ RLS Policies on packages table:');
      rlsPolicies.forEach(policy => {
        console.log(`  - ${policy.policyname} (${policy.cmd})`);
      });
    } else {
      console.log('⚠️  No RLS policies found on packages table');
    }
    
    // 6. Simulate the exact API route behavior
    console.log('\n🌐 Step 6: Simulating API route behavior...');
    console.log('-'.repeat(60));
    
    // Create a fresh client to simulate server-side
    const serverClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Try to set session manually (this is what happens on server with cookies)
    const { error: setSessionError } = await serverClient.auth.setSession({
      access_token: accessToken,
      refresh_token: authData.session.refresh_token
    });
    
    if (setSessionError) {
      console.error('❌ Could not set session on server client:', setSessionError.message);
    } else {
      console.log('✓ Session set on server client');
      
      const { data: { user: serverUser }, error: serverAuthError } = await serverClient.auth.getUser();
      
      if (serverAuthError || !serverUser) {
        console.error('❌ Server cannot get user from session');
        console.log('   This is likely the cause of the 401 error!');
        console.log('   The server-side Supabase client is not properly configured.');
      } else {
        console.log('✓ Server can get user from session');
        console.log(`  User ID: ${serverUser.id}`);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DIAGNOSTIC SUMMARY\n');
    
    const issues = [];
    
    if (!userLocations || userLocations.length === 0) {
      issues.push('❌ CRITICAL: User has no location assigned in user_locations table');
    }
    
    if (packagesAuthError) {
      issues.push('❌ RLS policies are blocking the user from accessing packages');
    }
    
    if (!packagesWithAuth || packagesWithAuth.length === 0) {
      if (!packagesAuthError) {
        issues.push('⚠️  No packages found (but query was successful)');
      }
    }
    
    if (issues.length === 0) {
      console.log('✅ No issues detected with database access!');
      console.log('   The problem is likely in the Next.js server-side auth setup.');
      console.log('\n💡 Recommendation:');
      console.log('   Check apps/web/lib/supabase/server.ts to ensure cookies are');
      console.log('   being read correctly by the server-side Supabase client.');
    } else {
      console.log('⚠️  Issues detected:\n');
      issues.forEach(issue => console.log(`   ${issue}`));
      console.log('\n💡 Recommendation:');
      if (issues.some(i => i.includes('user_locations'))) {
        console.log('   Run: node scripts/fix-401-automated.mjs');
      } else {
        console.log('   Check RLS policies on packages table.');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
    console.error(error);
  }
}

main();