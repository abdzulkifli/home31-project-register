-- Run this entire script in Supabase: SQL Editor > New query > Run.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null check (char_length(project_name) between 1 and 150),
  strategic_pillar text not null,
  department text not null,
  project_owner text not null,
  status text not null default 'Planning'
    check (status in ('Planning', 'In Progress', 'At Risk', 'On Hold', 'Completed')),
  progress integer not null default 0 check (progress between 0 and 100),
  start_date date,
  target_end_date date,
  description text,
  key_deliverables text,
  risks_issues text,
  next_milestone text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

drop policy if exists "Users can view own projects" on public.projects;
create policy "Users can view own projects"
on public.projects
for select
to authenticated
using ((select auth.uid()) = created_by);

drop policy if exists "Users can create own projects" on public.projects;
create policy "Users can create own projects"
on public.projects
for insert
to authenticated
with check ((select auth.uid()) = created_by);

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects"
on public.projects
for update
to authenticated
using ((select auth.uid()) = created_by)
with check ((select auth.uid()) = created_by);

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects"
on public.projects
for delete
to authenticated
using ((select auth.uid()) = created_by);

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

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
