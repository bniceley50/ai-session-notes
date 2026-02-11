-- Create test data for development
-- Run this in Supabase SQL Editor

-- 1. Create a test user (if it doesn't exist)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role,
  confirmation_token,
  recovery_token
)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'dev@example.com',
  '$2a$10$AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', -- fake hash
  NOW(),
  NOW(),
  NOW(),
  'authenticated',
  'authenticated',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create a test session
INSERT INTO public.sessions (
  id,
  org_id,
  label,
  status,
  created_by
)
VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Test Session',
  'active',
  '11111111-1111-1111-1111-111111111111'::uuid
)
ON CONFLICT (id) DO NOTHING;

-- Show the result
SELECT * FROM public.sessions WHERE id = '22222222-2222-2222-2222-222222222222';
