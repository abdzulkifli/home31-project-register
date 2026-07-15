-- HOME31 Role-Based Initiative Register
-- Version 3: Normal User + Super Admin dashboards
-- Safe to rerun. Existing project records are retained.
-- Supabase: SQL Editor > New query > Run.

create extension if not exists pgcrypto;

-- Public user directory used by the application.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  department text,
  role text not null default 'normal_user'
    check (role in ('normal_user', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists role text not null default 'normal_user';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Create a profile whenever a Supabase Auth user is registered.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, department, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'department', ''),
    'normal_user'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
      department = coalesce(nullif(excluded.department, ''), public.profiles.department),
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for users created before this role-based version.
insert into public.profiles (id, email, full_name, department, role)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', ''),
  coalesce(raw_user_meta_data ->> 'department', ''),
  'normal_user'
from auth.users
on conflict (id) do update
set email = excluded.email;

-- Helper used by RLS policies. Normal browser users cannot change its result.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'super_admin'
  );
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

-- Comprehensive project record.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  initiative_name text not null check (char_length(initiative_name) between 1 and 150),
  department text not null,
  strategic_pillar text not null,
  executive_sponsor text,
  accountable_owner text not null,
  delivery_lead text,
  current_phase text not null default 'Idea / Intake',
  problem_opportunity text not null,
  enterprise_outcome text not null,
  value_target text,
  next_action text,
  status text not null default 'Planning'
    check (status in ('Planning', 'In Progress', 'At Risk', 'On Hold', 'Completed')),
  progress integer not null default 0 check (progress between 0 and 100),
  target_date date,
  risk_level text not null default 'Medium'
    check (risk_level in ('Low', 'Medium', 'High', 'Extreme')),

  strategic_alignment_confirmed boolean not null default false,
  ownership_confirmed boolean not null default false,
  scope_dependencies_defined boolean not null default false,
  value_case_prepared boolean not null default false,
  kpi_defined boolean not null default false,
  funding_view_available boolean not null default false,
  risk_compliance_reviewed boolean not null default false,
  data_cyber_architecture_reviewed boolean not null default false,
  impact_reviewed boolean not null default false,
  procurement_vendor_reviewed boolean not null default false,
  delivery_plan_ready boolean not null default false,
  operational_readiness_reviewed boolean not null default false,
  change_stakeholder_plan boolean not null default false,

  hr_collaboration_status text not null default 'Not required',
  hr_engagement_stage text,
  hr_representative text,
  hr_impact_summary text,
  hr_collaboration_areas text[] not null default '{}'::text[],
  hr_engaged_early boolean not null default false,
  hr_people_impact_assessed boolean not null default false,
  hr_workforce_plan boolean not null default false,
  hr_skills_training_plan boolean not null default false,
  hr_change_comms_plan boolean not null default false,

  assessment_note text,
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  readiness_recommendation text,
  readiness_gaps text[] not null default '{}'::text[],
  readiness_category_scores jsonb not null default '{}'::jsonb,

  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade older project tables without deleting records.
alter table public.projects add column if not exists current_phase text not null default 'Idea / Intake';
alter table public.projects add column if not exists strategic_alignment_confirmed boolean not null default false;
alter table public.projects add column if not exists scope_dependencies_defined boolean not null default false;
alter table public.projects add column if not exists value_case_prepared boolean not null default false;
alter table public.projects add column if not exists risk_compliance_reviewed boolean not null default false;
alter table public.projects add column if not exists data_cyber_architecture_reviewed boolean not null default false;
alter table public.projects add column if not exists procurement_vendor_reviewed boolean not null default false;
alter table public.projects add column if not exists delivery_plan_ready boolean not null default false;
alter table public.projects add column if not exists operational_readiness_reviewed boolean not null default false;
alter table public.projects add column if not exists change_stakeholder_plan boolean not null default false;
alter table public.projects add column if not exists hr_collaboration_status text not null default 'Not required';
alter table public.projects add column if not exists hr_engagement_stage text;
alter table public.projects add column if not exists hr_representative text;
alter table public.projects add column if not exists hr_impact_summary text;
alter table public.projects add column if not exists hr_collaboration_areas text[] not null default '{}'::text[];
alter table public.projects add column if not exists hr_engaged_early boolean not null default false;
alter table public.projects add column if not exists hr_people_impact_assessed boolean not null default false;
alter table public.projects add column if not exists hr_workforce_plan boolean not null default false;
alter table public.projects add column if not exists hr_skills_training_plan boolean not null default false;
alter table public.projects add column if not exists hr_change_comms_plan boolean not null default false;
alter table public.projects add column if not exists assessment_note text;
alter table public.projects add column if not exists readiness_recommendation text;
alter table public.projects add column if not exists readiness_gaps text[] not null default '{}'::text[];
alter table public.projects add column if not exists readiness_category_scores jsonb not null default '{}'::jsonb;

-- Updated-at trigger shared by profiles and projects.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- Enable Row Level Security.
alter table public.profiles enable row level security;
alter table public.projects enable row level security;

-- Replace older policies.
drop policy if exists "Users view own profile or admins view all" on public.profiles;
drop policy if exists "Super admins update profiles" on public.profiles;
create policy "Users view own profile or admins view all"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select public.is_super_admin()));
create policy "Super admins update profiles"
on public.profiles for update to authenticated
using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));

drop policy if exists "Users view own projects" on public.projects;
drop policy if exists "Users create own projects" on public.projects;
drop policy if exists "Users update own projects" on public.projects;
drop policy if exists "Users delete own projects" on public.projects;
drop policy if exists "Users or admins view projects" on public.projects;
drop policy if exists "Users create own project records" on public.projects;
drop policy if exists "Users or admins update projects" on public.projects;
drop policy if exists "Users or admins delete projects" on public.projects;

create policy "Users or admins view projects"
on public.projects for select to authenticated
using ((select auth.uid()) = created_by or (select public.is_super_admin()));

create policy "Users create own project records"
on public.projects for insert to authenticated
with check (
  (select auth.uid()) = created_by
  or (select public.is_super_admin())
);

create policy "Users or admins update projects"
on public.projects for update to authenticated
using ((select auth.uid()) = created_by or (select public.is_super_admin()))
with check ((select auth.uid()) = created_by or (select public.is_super_admin()));

create policy "Users or admins delete projects"
on public.projects for delete to authenticated
using ((select auth.uid()) = created_by or (select public.is_super_admin()));

-- Browser-role privileges. RLS remains the actual data boundary.
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;

-- FIRST SUPER ADMIN
-- After registering your own account, run this separately and replace the email if needed:
-- update public.profiles
-- set role = 'super_admin'
-- where email = 'abdzulkifli@gmail.com';
