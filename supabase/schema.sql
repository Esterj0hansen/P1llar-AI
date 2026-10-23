-- P1llar AI initial multi-tenant schema.
-- Review and apply in a fresh Supabase project. Never disable RLS in production.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_id uuid not null references auth.users(id) on delete restrict,
  support_greeting text not null default 'Hi! How can we help you today?',
  brand_color text not null default '#356df3' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  source_type text not null check (source_type in ('manual','faq','website','file')),
  title text not null check (char_length(trim(title)) between 1 and 240),
  content text not null default '',
  source_url text,
  processing_status text not null default 'ready' check (processing_status in ('pending','processing','ready','failed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  visitor_id uuid,
  status text not null default 'open' check (status in ('open','resolved','needs_human')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('visitor','assistant','staff')),
  content text not null check (char_length(content) <= 12000),
  grounded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists businesses_owner_id_idx on public.businesses(owner_id);
create index if not exists business_members_user_id_idx on public.business_members(user_id);
create index if not exists knowledge_sources_business_id_idx on public.knowledge_sources(business_id);
create index if not exists support_conversations_business_created_idx on public.support_conversations(business_id, created_at desc);
create index if not exists support_messages_conversation_created_idx on public.support_messages(conversation_id, created_at);

-- Create the owner's membership automatically when a business is created.
create or replace function public.add_business_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_members (business_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (business_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists business_owner_membership_after_insert on public.businesses;
create trigger business_owner_membership_after_insert
after insert on public.businesses
for each row execute function public.add_business_owner_membership();

 drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at before update on public.businesses
for each row execute function public.set_updated_at();
drop trigger if exists knowledge_sources_set_updated_at on public.knowledge_sources;
create trigger knowledge_sources_set_updated_at before update on public.knowledge_sources
for each row execute function public.set_updated_at();
drop trigger if exists support_conversations_set_updated_at on public.support_conversations;
create trigger support_conversations_set_updated_at before update on public.support_conversations
for each row execute function public.set_updated_at();

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

-- Business members can only read businesses they belong to.
drop policy if exists "members can read their businesses" on public.businesses;
create policy "members can read their businesses" on public.businesses
for select to authenticated
using (exists (
  select 1 from public.business_members bm
  where bm.business_id = id and bm.user_id = (select auth.uid())
));

drop policy if exists "authenticated users can create their own business" on public.businesses;
create policy "authenticated users can create their own business" on public.businesses
for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "owners and admins can update business profile" on public.businesses;
create policy "owners and admins can update business profile" on public.businesses
for update to authenticated
using (exists (
  select 1 from public.business_members bm
  where bm.business_id = id and bm.user_id = (select auth.uid()) and bm.role in ('owner','admin')
))
with check (exists (
  select 1 from public.business_members bm
  where bm.business_id = id and bm.user_id = (select auth.uid()) and bm.role in ('owner','admin')
));

-- Members can read only their own membership record. Membership management is server-side for now.
drop policy if exists "users can read their own memberships" on public.business_members;
create policy "users can read their own memberships" on public.business_members
for select to authenticated
using (user_id = (select auth.uid()));

-- Knowledge is private to authenticated members of the corresponding business.
drop policy if exists "members can manage business knowledge" on public.knowledge_sources;
create policy "members can manage business knowledge" on public.knowledge_sources
for all to authenticated
using (exists (
  select 1 from public.business_members bm
  where bm.business_id = knowledge_sources.business_id and bm.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.business_members bm
  where bm.business_id = business_id and bm.user_id = (select auth.uid())
));

-- Conversations and messages are not exposed to anonymous visitors directly.
-- A future public chat API must validate the business slug and use a server-side route.
drop policy if exists "members can manage business conversations" on public.support_conversations;
create policy "members can manage business conversations" on public.support_conversations
for all to authenticated
using (exists (
  select 1 from public.business_members bm
  where bm.business_id = support_conversations.business_id and bm.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.business_members bm
  where bm.business_id = support_conversations.business_id and bm.user_id = (select auth.uid())
));

drop policy if exists "members can manage messages for their business conversations" on public.support_messages;
create policy "members can manage messages for their business conversations" on public.support_messages
for all to authenticated
using (exists (
  select 1 from public.support_conversations sc
  join public.business_members bm on bm.business_id = sc.business_id
  where sc.id = conversation_id and bm.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.support_conversations sc
  join public.business_members bm on bm.business_id = sc.business_id
  where sc.id = conversation_id and bm.user_id = (select auth.uid())
));
