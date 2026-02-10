#!/usr/bin/env node

/**
 * Create a test session in Supabase
 * Run with: node scripts/create-test-session.mjs
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
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const practiceId = process.env.DEFAULT_PRACTICE_ID;

if (!supabaseUrl || !serviceRoleKey || !practiceId) {
  console.log('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('Creating test session...\n');

// First, ensure test user exists in auth.users
const testUserId = '11111111-1111-1111-1111-111111111111';

// Use raw SQL to insert user if not exists (bypasses auth restrictions)
try {
  await supabase.rpc('exec_sql', {
    sql: `
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
      VALUES (
        '${testUserId}'::uuid,
        'dev@example.com',
        '',
        NOW(),
        NOW(),
        NOW(),
        'authenticated',
        'authenticated'
      )
      ON CONFLICT (id) DO NOTHING;
    `
  });
} catch (err) {
  // Function might not exist or user already exists - that's fine
  console.log('Note: Could not create user via RPC (this is usually fine)');
}

// Create a test session with a real UUID
const { data: session, error } = await supabase
  .from('sessions')
  .insert({
    org_id: practiceId,
    label: 'Test Session',
    status: 'active'
    // created_by is nullable, omit it since we can't create auth users easily
  })
  .select()
  .single();

if (error) {
  console.log(`❌ Failed to create session: ${error.message}`);
  process.exit(1);
}

console.log('✅ Test session created!');
console.log(`\nSession ID: ${session.id}`);
console.log(`\nUse this URL to test:\nhttp://localhost:3000/sessions/${session.id}`);
