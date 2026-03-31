#!/usr/bin/env node

/**
 * Verify user credentials and reset if needed
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qumjzvhtotcvnzpjgjkl.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk0NjYzMCwiZXhwIjoyMDg5NTIyNjMwfQ.qFhuNtT7jw5TrvJSzg28GiYVPQGLMSJ9JYeWhMDb_4o';

const USER_EMAIL = 'user@brickshare.eu';

console.log('🔍 Verifying user credentials\n');
console.log('='.repeat(60));

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // List all users
    console.log('\n👥 Checking auth.users...');
    console.log('-'.repeat(60));
    
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      return;
    }
    
    console.log(`Found ${users.length} total users`);
    
    const targetUser = users.find(u => u.email === USER_EMAIL);
    
    if (!targetUser) {
      console.log(`\n❌ User ${USER_EMAIL} NOT FOUND in auth.users`);
      console.log('\n💡 Creating user...');
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: USER_EMAIL,
        password: 'Test123456!',
        email_confirm: true,
        user_metadata: {
          first_name: 'Test',
          last_name: 'User',
          role: 'user'
        }
      });
      
      if (createError) {
        console.error('❌ Error creating user:', createError.message);
        return;
      }
      
      console.log('✅ User created successfully');
      console.log(`   User ID: ${newUser.user.id}`);
      console.log(`   Email: ${newUser.user.email}`);
      
    } else {
      console.log(`\n✅ User ${USER_EMAIL} found`);
      console.log(`   User ID: ${targetUser.id}`);
      console.log(`   Email confirmed: ${targetUser.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log(`   Created: ${targetUser.created_at}`);
      
      // Reset password to ensure it's correct
      console.log('\n🔐 Resetting password to Test123456!...');
      
      const { error: resetError } = await supabase.auth.admin.updateUserById(
        targetUser.id,
        { password: 'Test123456!' }
      );
      
      if (resetError) {
        console.error('❌ Error resetting password:', resetError.message);
      } else {
        console.log('✅ Password reset successfully');
      }
    }
    
    // Verify in public.users
    console.log('\n📋 Checking public.users...');
    console.log('-'.repeat(60));
    
    const userId = targetUser?.id || (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === USER_EMAIL)?.id;
    
    if (!userId) {
      console.error('❌ Could not find user ID');
      return;
    }
    
    const { data: publicUser, error: publicError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (publicError) {
      if (publicError.code === 'PGRST116') {
        console.log('⚠️  User not in public.users, creating...');
        
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: userId,
            email: USER_EMAIL,
            first_name: 'Test',
            last_name: 'User',
            role: 'user'
          });
        
        if (insertError) {
          console.error('❌ Error inserting to public.users:', insertError.message);
        } else {
          console.log('✅ User created in public.users');
        }
      } else {
        console.error('❌ Error:', publicError.message);
      }
    } else {
      console.log('✅ User exists in public.users');
      console.log(`   Role: ${publicUser.role}`);
      console.log(`   Name: ${publicUser.first_name} ${publicUser.last_name}`);
    }
    
    // Check user_locations
    console.log('\n📍 Checking user_locations...');
    console.log('-'.repeat(60));
    
    const { data: userLocs, error: locError } = await supabase
      .from('user_locations')
      .select('location_id, locations(name)')
      .eq('user_id', userId);
    
    if (locError) {
      console.error('❌ Error:', locError.message);
    } else if (!userLocs || userLocs.length === 0) {
      console.log('⚠️  No locations assigned');
      console.log('   Run: node scripts/fix-401-automated.mjs to assign a location');
    } else {
      console.log(`✅ ${userLocs.length} location(s) assigned`);
      userLocs.forEach(loc => {
        console.log(`   - ${loc.location_id}: ${loc.locations?.name || 'N/A'}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ VERIFICATION COMPLETE\n');
    console.log('📝 Credentials:');
    console.log(`   Email:    ${USER_EMAIL}`);
    console.log(`   Password: Test123456!`);
    console.log(`   User ID:  ${userId}\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();