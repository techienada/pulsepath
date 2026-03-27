create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  name text not null,
  age integer not null check (age >= 10 and age <= 99),
  role text not null default 'Student',
  device text not null default 'Smartphone',
  wellbeing_score integer not null check (wellbeing_score >= 0 and wellbeing_score <= 100),
  risk_level text not null check (risk_level in ('Low', 'Moderate', 'High')),
  screen_time_hours numeric(4,1) not null default 0,
  focus_hours numeric(4,1) not null default 0,
  sleep_hours numeric(4,1) not null default 0,
  unlocks integer not null default 0,
  scrolling_hours numeric(4,1) not null default 0,
  typing_speed integer not null default 0,
  heart_rate integer not null default 0,
  hydration integer not null default 0,
  main_issue text not null,
  tags jsonb not null default '[]'::jsonb,
  goals jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  weekly_trend jsonb not null default '[]'::jsonb,
  app_usage jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  user_id uuid references public.users(id) on delete cascade,
  user_name text not null,
  type text not null,
  tone text not null,
  title text not null,
  detail text not null,
  impact text not null,
  source text not null default 'system',
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer,
  status text not null default 'active' check (status in ('active', 'ended'))
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  report_type text not null default 'user',
  payload jsonb not null default '{}'::jsonb,
  exported_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.behavior_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  behavior_score integer not null check (behavior_score >= 0 and behavior_score <= 100),
  behavior_profile text not null,
  strongest_signal text not null,
  trend_label text not null,
  trend_delta integer not null default 0,
  why_it_matters text not null,
  next_action text,
  weekly_target text,
  snapshot_at timestamptz not null default now()
);

create index if not exists idx_users_risk_level on public.users(risk_level);
create index if not exists idx_activity_events_user_id on public.activity_events(user_id);
create index if not exists idx_activity_events_created_at on public.activity_events(created_at desc);
create index if not exists idx_sessions_started_at on public.sessions(started_at desc);
create index if not exists idx_reports_user_id on public.reports(user_id);
create index if not exists idx_behavior_snapshots_user_id on public.behavior_snapshots(user_id);
create index if not exists idx_behavior_snapshots_snapshot_at on public.behavior_snapshots(snapshot_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.activity_events enable row level security;
alter table public.sessions enable row level security;
alter table public.reports enable row level security;
alter table public.behavior_snapshots enable row level security;

drop policy if exists "Allow all authenticated users to read users" on public.users;
create policy "Allow all authenticated users to read users"
on public.users
for select
using (auth.role() = 'authenticated');

drop policy if exists "Allow all authenticated users to write users" on public.users;
create policy "Allow all authenticated users to write users"
on public.users
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Allow all authenticated users to read activity" on public.activity_events;
create policy "Allow all authenticated users to read activity"
on public.activity_events
for select
using (auth.role() = 'authenticated');

drop policy if exists "Allow all authenticated users to write activity" on public.activity_events;
create policy "Allow all authenticated users to write activity"
on public.activity_events
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Allow all authenticated users to read sessions" on public.sessions;
create policy "Allow all authenticated users to read sessions"
on public.sessions
for select
using (auth.role() = 'authenticated');

drop policy if exists "Allow all authenticated users to write sessions" on public.sessions;
create policy "Allow all authenticated users to write sessions"
on public.sessions
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Allow all authenticated users to read reports" on public.reports;
create policy "Allow all authenticated users to read reports"
on public.reports
for select
using (auth.role() = 'authenticated');

drop policy if exists "Allow all authenticated users to write reports" on public.reports;
create policy "Allow all authenticated users to write reports"
on public.reports
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Allow all authenticated users to read behavior snapshots" on public.behavior_snapshots;
create policy "Allow all authenticated users to read behavior snapshots"
on public.behavior_snapshots
for select
using (auth.role() = 'authenticated');

drop policy if exists "Allow all authenticated users to write behavior snapshots" on public.behavior_snapshots;
create policy "Allow all authenticated users to write behavior snapshots"
on public.behavior_snapshots
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
