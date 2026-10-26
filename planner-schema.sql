-- Run once in the SQL Editor of your own Supabase project.
-- Private couple workspace. All application writes use revision-checked RPCs.
create table if not exists public.wedding_workspaces (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(payload) = 'object' and payload->>'version' = '2'),
  check (octet_length(payload::text) <= 5000000)
);
create table if not exists public.wedding_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wedding_id uuid not null references public.wedding_workspaces(id) on delete cascade
);
create table if not exists public.wedding_invites (
  wedding_id uuid primary key references public.wedding_workspaces(id) on delete cascade,
  token uuid unique not null default gen_random_uuid(),
  expires_at timestamptz not null default now() + interval '7 days'
);
alter table public.wedding_workspaces enable row level security;
alter table public.wedding_members enable row level security;
alter table public.wedding_invites enable row level security;
revoke all on public.wedding_workspaces, public.wedding_members, public.wedding_invites from anon, authenticated;
grant select on public.wedding_workspaces, public.wedding_members to authenticated;
drop policy if exists own_membership on public.wedding_members;
create policy own_membership on public.wedding_members for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists member_read on public.wedding_workspaces;
create policy member_read on public.wedding_workspaces for select to authenticated using (id in (select wedding_id from public.wedding_members where user_id = (select auth.uid())));

create or replace function public.create_wedding(p_payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare wid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists(select 1 from public.wedding_members where user_id = auth.uid()) then raise exception 'You already have a wedding workspace'; end if;
  insert into public.wedding_workspaces(payload) values(p_payload) returning id into wid;
  insert into public.wedding_members values(auth.uid(), wid);
  return wid;
end $$;
create or replace function public.save_wedding(p_id uuid, p_revision bigint, p_payload jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare rev bigint;
begin
  if not exists(select 1 from public.wedding_members where user_id = auth.uid() and wedding_id = p_id) then raise exception 'Access denied'; end if;
  update public.wedding_workspaces set payload = p_payload, revision = revision + 1, updated_at = now() where id = p_id and revision = p_revision returning revision into rev;
  if rev is null then raise exception 'CONFLICT: Your partner saved changes. Reload before editing.'; end if;
  return rev;
end $$;
create or replace function public.invite_wedding_partner(p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare code uuid;
begin
  if not exists(select 1 from public.wedding_members where user_id = auth.uid() and wedding_id = p_id) then raise exception 'Access denied'; end if;
  perform 1 from public.wedding_workspaces where id = p_id for update;
  if (select count(*) from public.wedding_members where wedding_id = p_id) >= 2 then raise exception 'Both partner accounts are already connected'; end if;
  insert into public.wedding_invites(wedding_id) values(p_id) on conflict(wedding_id) do update set token = gen_random_uuid(), expires_at = now() + interval '7 days' returning token into code;
  return code;
end $$;
create or replace function public.join_wedding(p_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare wid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists(select 1 from public.wedding_members where user_id = auth.uid()) then raise exception 'You already have a wedding workspace'; end if;
  select wedding_id into wid from public.wedding_invites where token = p_token and expires_at > now();
  if wid is null then raise exception 'Invitation is invalid or expired'; end if;
  perform 1 from public.wedding_workspaces where id = wid for update;
  if not exists(select 1 from public.wedding_invites where token = p_token and expires_at > now()) then raise exception 'Invitation is no longer valid'; end if;
  if (select count(*) from public.wedding_members where wedding_id = wid) >= 2 then raise exception 'This wedding already has two partners'; end if;
  insert into public.wedding_members values(auth.uid(), wid);
  delete from public.wedding_invites where wedding_id = wid;
  return wid;
end $$;
revoke all on function public.create_wedding(jsonb), public.save_wedding(uuid,bigint,jsonb), public.invite_wedding_partner(uuid), public.join_wedding(uuid) from public, anon;
grant execute on function public.create_wedding(jsonb), public.save_wedding(uuid,bigint,jsonb), public.invite_wedding_partner(uuid), public.join_wedding(uuid) to authenticated;
