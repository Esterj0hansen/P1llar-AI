-- P1llar AI launch features. Apply once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.api_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);
alter table public.api_rate_limits enable row level security;

create or replace function public.consume_support_rate_limit(p_rate_key text, p_limit integer default 12, p_window_seconds integer default 60)
returns boolean language plpgsql security definer set search_path = '' as $$
declare allowed boolean;
begin
  insert into public.api_rate_limits(rate_key, window_started_at, request_count)
  values (p_rate_key, now(), 1)
  on conflict (rate_key) do update set
    request_count = case when public.api_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds) then 1 else public.api_rate_limits.request_count + 1 end,
    window_started_at = case when public.api_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds) then now() else public.api_rate_limits.window_started_at end
  returning request_count <= p_limit into allowed;
  return coalesce(allowed, false);
end; $$;
revoke all on function public.consume_support_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_support_rate_limit(text, integer, integer) to service_role;

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_type text not null check (event_type in ('support_message','file_upload','website_import')),
  quantity integer not null default 1 check (quantity > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_business_created_idx on public.usage_events(business_id, created_at desc);
alter table public.usage_events enable row level security;
drop policy if exists "business members read usage" on public.usage_events;
create policy "business members read usage" on public.usage_events for select to authenticated
using (exists (select 1 from public.business_members bm where bm.business_id = usage_events.business_id and bm.user_id = (select auth.uid())));

alter table public.support_conversations add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.support_conversations add column if not exists handoff_requested_at timestamptz;
alter table public.support_conversations add column if not exists handoff_note text;

create table if not exists public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  provider text not null default 'paystack',
  provider_customer_id text,
  provider_subscription_id text unique,
  plan text not null default 'free' check (plan in ('free','starter','growth','business')),
  status text not null default 'inactive' check (status in ('inactive','trialing','active','past_due','canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.business_subscriptions enable row level security;
drop policy if exists "business members read subscription" on public.business_subscriptions;
create policy "business members read subscription" on public.business_subscriptions for select to authenticated
using (exists (select 1 from public.business_members bm where bm.business_id = business_subscriptions.business_id and bm.user_id = (select auth.uid())));

-- Private bucket for business knowledge files. Access is mediated by authenticated API routes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-knowledge', 'business-knowledge', false, 10485760,
  array['application/pdf','text/plain','text/markdown','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = 10485760;
