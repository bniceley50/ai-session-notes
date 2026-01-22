create extension if not exists "pgcrypto";

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  label text not null,
  status text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, org_id)
);

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  session_id uuid not null,
  content text not null,
  created_at timestamptz not null default now(),
  foreign key (session_id, org_id)
    references public.sessions(id, org_id)
    on delete cascade
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  session_id uuid not null,
  note_type text not null,
  content text not null,
  created_at timestamptz not null default now(),
  foreign key (session_id, org_id)
    references public.sessions(id, org_id)
    on delete cascade
);

create index profiles_org_id_idx on public.profiles (org_id);
create index profiles_user_id_idx on public.profiles (user_id);
create index sessions_org_id_idx on public.sessions (org_id);
create index transcripts_org_id_idx on public.transcripts (org_id);
create index transcripts_session_id_idx on public.transcripts (session_id);
create index notes_org_id_idx on public.notes (org_id);
create index notes_session_id_idx on public.notes (session_id);

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.org_id = target_org_id
      and p.user_id = auth.uid()
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;

alter table public.orgs enable row level security;
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.transcripts enable row level security;
alter table public.notes enable row level security;

create policy orgs_select on public.orgs
  for select using (public.is_org_member(id));
create policy orgs_update on public.orgs
  for update using (public.is_org_member(id));
create policy orgs_delete on public.orgs
  for delete using (public.is_org_member(id));

create policy profiles_select on public.profiles
  for select using (public.is_org_member(org_id));
create policy profiles_update on public.profiles
  for update using (public.is_org_member(org_id));
create policy profiles_delete on public.profiles
  for delete using (public.is_org_member(org_id));

create policy sessions_select on public.sessions
  for select using (public.is_org_member(org_id));
create policy sessions_insert on public.sessions
  for insert with check (public.is_org_member(org_id) and created_by = auth.uid());
create policy sessions_update on public.sessions
  for update using (public.is_org_member(org_id));
create policy sessions_delete on public.sessions
  for delete using (public.is_org_member(org_id));

create policy transcripts_select on public.transcripts
  for select using (public.is_org_member(org_id));
create policy transcripts_insert on public.transcripts
  for insert with check (public.is_org_member(org_id));
create policy transcripts_update on public.transcripts
  for update using (public.is_org_member(org_id));
create policy transcripts_delete on public.transcripts
  for delete using (public.is_org_member(org_id));

create policy notes_select on public.notes
  for select using (public.is_org_member(org_id));
create policy notes_insert on public.notes
  for insert with check (public.is_org_member(org_id));
create policy notes_update on public.notes
  for update using (public.is_org_member(org_id));
create policy notes_delete on public.notes
  for delete using (public.is_org_member(org_id));
