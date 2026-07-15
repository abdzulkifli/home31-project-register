-- HOME31 Enterprise Management Platform V7
-- Run in Supabase SQL Editor. Designed as an upgrade-safe foundation.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  department text,
  role text not null default 'normal_user'
    check (role in (
      'super_admin',
      'department_admin',
      'hr_admin',
      'finance_admin',
      'auditor',
      'viewer',
      'normal_user'
    )),
  must_change_password boolean not null default true,
  password_changed_at timestamptz,
  account_status text not null default 'active'
    check (account_status in ('active','disabled','locked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists must_change_password boolean not null default true,
  add column if not exists password_changed_at timestamptz,
  add column if not exists account_status text not null default 'active';

create table if not exists public.initiatives (
  id uuid primary key default gen_random_uuid(),
  initiative_name text not null check (char_length(initiative_name) between 1 and 150),
  department text not null,
  strategic_pillar text not null,
  accountable_owner text not null,
  executive_sponsor text,
  delivery_lead text,
  status text not null default 'Planning'
    check (status in ('Planning','In Progress','At Risk','On Hold','Completed')),
  risk_level text not null default 'Medium'
    check (risk_level in ('Low','Medium','High','Extreme')),
  progress integer not null default 0 check (progress between 0 and 100),
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  target_date date,
  hr_collaboration_status text not null default 'Not required'
    check (hr_collaboration_status in ('Not required','Required','To be confirmed')),
  problem_opportunity text,
  expected_outcome text,
  next_action text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.initiatives
  add column if not exists hr_collaboration_status text not null default 'Not required',
  add column if not exists problem_opportunity text,
  add column if not exists expected_outcome text,
  add column if not exists next_action text;

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
      and account_status = 'active'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    department,
    role,
    must_change_password
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'department', ''),
    'normal_user',
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    department = coalesce(nullif(excluded.department, ''), public.profiles.department),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, email, full_name, department, role, must_change_password)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', email),
  coalesce(raw_user_meta_data->>'department', ''),
  'normal_user',
  true
from auth.users
on conflict (id) do nothing;

create or replace function public.admin_set_user_role(
  target_user_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super-admin access required';
  end if;

  if new_role not in (
    'super_admin',
    'department_admin',
    'hr_admin',
    'finance_admin',
    'auditor',
    'viewer',
    'normal_user'
  ) then
    raise exception 'Invalid role';
  end if;

  update public.profiles
  set role = new_role,
      updated_at = now()
  where id = target_user_id;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists initiatives_set_updated_at on public.initiatives;
create trigger initiatives_set_updated_at
before update on public.initiatives
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.initiatives enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "Users view own profile" on public.profiles;
create policy "Users view own profile"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_super_admin());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles for update to authenticated
using (id = auth.uid() or public.is_super_admin())
with check (id = auth.uid() or public.is_super_admin());

drop policy if exists "Users view initiatives" on public.initiatives;
create policy "Users view initiatives"
on public.initiatives for select to authenticated
using (created_by = auth.uid() or public.is_super_admin());

drop policy if exists "Users create initiatives" on public.initiatives;
create policy "Users create initiatives"
on public.initiatives for insert to authenticated
with check (created_by = auth.uid() or public.is_super_admin());

drop policy if exists "Users update initiatives" on public.initiatives;
create policy "Users update initiatives"
on public.initiatives for update to authenticated
using (created_by = auth.uid() or public.is_super_admin())
with check (created_by = auth.uid() or public.is_super_admin());

drop policy if exists "Users delete initiatives" on public.initiatives;
create policy "Users delete initiatives"
on public.initiatives for delete to authenticated
using (created_by = auth.uid() or public.is_super_admin());

drop policy if exists "Super admins view audit log" on public.audit_log;
create policy "Super admins view audit log"
on public.audit_log for select to authenticated
using (public.is_super_admin());

grant usage on schema public to authenticated;
grant select on public.profiles, public.initiatives, public.audit_log to authenticated;
grant insert, update, delete on public.initiatives to authenticated;
grant update (full_name, department, must_change_password, password_changed_at, updated_at)
  on public.profiles to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- After registering your own account, promote the first super admin:
-- update public.profiles
-- set role = 'super_admin', must_change_password = false
-- where email = 'abdzulkifli@gmail.com';
