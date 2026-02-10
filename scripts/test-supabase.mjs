#!/usr/bin/env node

/**
 * Diagnostic script to test Supabase connection
 * Run with: node scripts/test-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually
const envPath = resolve(process.cwd(), '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
} catch (err) {
  console.log('❌ Could not read .env.local file');
  console.log(`   Looked at: ${envPath}`);
  process.exit(1);
}

console.log('🔍 Testing Supabase Connection...\n');

// 1. Check environment variables
console.log('1️⃣ Checking environment variables:');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const practiceId = process.env.DEFAULT_PRACTICE_ID;

console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? '✅ Set (' + serviceRoleKey.substring(0, 20) + '...)' : '❌ Missing'}`);
console.log(`   DEFAULT_PRACTICE_ID: ${practiceId ? '✅ ' + practiceId : '❌ Missing'}`);

if (!supabaseUrl || !serviceRoleKey || !practiceId) {
  console.log('\n❌ Missing required environment variables. Check your .env.local file.');
  process.exit(1);
}

// 2. Test connection
console.log('\n2️⃣ Testing Supabase connection...');
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

try {
  // Simple query to test connection
  const { data, error } = await supabase.from('orgs').select('id, name').limit(1);

  if (error) {
    console.log(`   ❌ Connection failed: ${error.message}`);
    console.log(`   Error code: ${error.code}`);
    console.log(`   Hint: ${error.hint || 'none'}`);
    process.exit(1);
  }

  console.log('   ✅ Connection successful!');
  console.log(`   Found ${data.length} org(s) in database`);
} catch (err) {
  console.log(`   ❌ Connection error: ${err.message}`);
  process.exit(1);
}

// 3. Check if practice org exists
console.log('\n3️⃣ Checking if practice org exists...');
try {
  const { data, error } = await supabase
    .from('orgs')
    .select('id, name')
    .eq('id', practiceId)
    .maybeSingle();

  if (error) {
    console.log(`   ❌ Query failed: ${error.message}`);
    process.exit(1);
  }

  if (!data) {
    console.log(`   ❌ Org not found with id: ${practiceId}`);
    console.log('\n   To create it, run this SQL in Supabase SQL Editor:');
    console.log(`   INSERT INTO public.orgs (id, name) VALUES ('${practiceId}'::uuid, 'Dev Practice');`);
    process.exit(1);
  }

  console.log(`   ✅ Org found: "${data.name}" (${data.id})`);
} catch (err) {
  console.log(`   ❌ Error: ${err.message}`);
  process.exit(1);
}

// 4. Test notes table access
console.log('\n4️⃣ Testing notes table access...');
try {
  const { data, error } = await supabase
    .from('notes')
    .select('id')
    .eq('org_id', practiceId)
    .limit(1);

  if (error) {
    console.log(`   ❌ Query failed: ${error.message}`);
    console.log(`   Error code: ${error.code}`);
    process.exit(1);
  }

  console.log(`   ✅ Notes table accessible! Found ${data.length} note(s) for this org.`);
} catch (err) {
  console.log(`   ❌ Error: ${err.message}`);
  process.exit(1);
}

console.log('\n✅ All checks passed! Supabase is configured correctly.\n');
