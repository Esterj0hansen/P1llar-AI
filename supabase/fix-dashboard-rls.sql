-- Apply this in Supabase SQL Editor to fix the knowledge policy's ambiguous business_id reference.
-- Dashboard reads/writes still use the signed-in user's session and RLS.
drop policy if exists "members can manage business knowledge" on public.knowledge_sources;
create policy "members can manage business knowledge" on public.knowledge_sources
for all to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = knowledge_sources.business_id
      and bm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = knowledge_sources.business_id
      and bm.user_id = (select auth.uid())
  )
);

-- Recreate membership policy without recursive business_members lookups.
drop policy if exists "users can read their own memberships" on public.business_members;
create policy "users can read their own memberships" on public.business_members
for select to authenticated
using (user_id = (select auth.uid()));

-- Ensure customer conversations and messages remain private to workspace members.
drop policy if exists "members can manage business conversations" on public.support_conversations;
create policy "members can manage business conversations" on public.support_conversations
for all to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = support_conversations.business_id
      and bm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = support_conversations.business_id
      and bm.user_id = (select auth.uid())
  )
);

drop policy if exists "members can manage messages for their business conversations" on public.support_messages;
create policy "members can manage messages for their business conversations" on public.support_messages
for all to authenticated
using (
  exists (
    select 1
    from public.support_conversations sc
    join public.business_members bm on bm.business_id = sc.business_id
    where sc.id = support_messages.conversation_id
      and bm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.support_conversations sc
    join public.business_members bm on bm.business_id = sc.business_id
    where sc.id = support_messages.conversation_id
      and bm.user_id = (select auth.uid())
  )
);
