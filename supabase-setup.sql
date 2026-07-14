-- HOME31 Initiative Register — Comprehensive Readiness + HR Collaboration
-- Safe to rerun. Existing projects table will be upgraded with new columns.
-- Supabase: SQL Editor > New query > Run.

create extension if not exists pgcrypto;

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

-- Upgrade an existing simplified table without deleting its records.
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

alter table public.projects enable row level security;

drop policy if exists "Users view own projects" on public.projects;
create policy "Users view own projects"
on public.projects for select to authenticated
using ((select auth.uid()) = created_by);

drop policy if exists "Users create own projects" on public.projects;
create policy "Users create own projects"
on public.projects for insert to authenticated
with check ((select auth.uid()) = created_by);

drop policy if exists "Users update own projects" on public.projects;
create policy "Users update own projects"
on public.projects for update to authenticated
using ((select auth.uid()) = created_by)
with check ((select auth.uid()) = created_by);

drop policy if exists "Users delete own projects" on public.projects;
create policy "Users delete own projects"
on public.projects for delete to authenticated
using ((select auth.uid()) = created_by);

create or replace function public.set_project_updated_at()
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

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
before update on public.projects
for each row execute function public.set_project_updated_at();

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
