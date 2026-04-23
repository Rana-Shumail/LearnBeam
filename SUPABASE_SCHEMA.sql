-- ══════════════════════════════════════════════════
--  LearnBeam – Supabase Schema  (safe to re-run)
--  Paste into: Dashboard → SQL Editor → New query → Run
-- ══════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────
create extension if not exists vector;

-- ── Tables ───────────────────────────────────────
create table if not exists courses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  code       text not null,
  name       text,
  color      text default '#66B539',
  created_at timestamptz default now()
);

create table if not exists assignments (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid references courses(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  label      text not null,
  type       text default 'Assignment',
  due        text,
  weight     numeric default 1,
  grade      numeric,
  status     text default 'upcoming'
             check (status in ('upcoming','completed','overdue')),
  created_at timestamptz default now()
);

create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid references courses(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  type         text default 'other'
               check (type in ('syllabus','notes','reading','past-exam','other')),
  size         text,
  storage_path text,
  uploaded_at  timestamptz default now()
);

alter table documents
  add column if not exists text_content text;

create table if not exists reminders (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid references courses(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  text       text not null,
  due        text,
  done       boolean default false,
  created_at timestamptz default now()
);

create table if not exists course_insights (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references courses(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  course_code       text,
  course_name       text,
  instructor        text,
  term              text,
  meeting_schedule  text,
  location          text,
  summary           text,
  grading_policy    jsonb not null default '[]',
  warnings          jsonb not null default '[]',
  source_file_name  text not null default '',
  analyzed_at       timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (course_id)
);

create table if not exists fact_check_reports (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references documents(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  doc_name      text not null,
  summary       text not null default '',
  claims        jsonb not null default '[]',
  generated_at  timestamptz not null default now(),
  unique (document_id)
);

create table if not exists user_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  avatar_url   text,
  updated_at   timestamptz not null default now()
);

-- ── Enable RLS ────────────────────────────────────
alter table courses     enable row level security;
alter table assignments enable row level security;
alter table documents   enable row level security;
alter table reminders   enable row level security;
alter table course_insights enable row level security;
alter table fact_check_reports enable row level security;
alter table user_profiles enable row level security;

-- ── Drop old policies (safe on re-run) ───────────
do $$ begin
  drop policy if exists "courses: select own"  on courses;
  drop policy if exists "courses: insert own"  on courses;
  drop policy if exists "courses: update own"  on courses;
  drop policy if exists "courses: delete own"  on courses;

  drop policy if exists "assignments: select own" on assignments;
  drop policy if exists "assignments: insert own" on assignments;
  drop policy if exists "assignments: update own" on assignments;
  drop policy if exists "assignments: delete own" on assignments;

  drop policy if exists "documents: select own" on documents;
  drop policy if exists "documents: insert own" on documents;
  drop policy if exists "documents: update own" on documents;
  drop policy if exists "documents: delete own" on documents;

  drop policy if exists "reminders: select own" on reminders;
  drop policy if exists "reminders: insert own" on reminders;
  drop policy if exists "reminders: update own" on reminders;
  drop policy if exists "reminders: delete own" on reminders;

  drop policy if exists "course_insights: select own" on course_insights;
  drop policy if exists "course_insights: insert own" on course_insights;
  drop policy if exists "course_insights: update own" on course_insights;
  drop policy if exists "course_insights: delete own" on course_insights;

  drop policy if exists "fact_check_reports: select own" on fact_check_reports;
  drop policy if exists "fact_check_reports: insert own" on fact_check_reports;
  drop policy if exists "fact_check_reports: update own" on fact_check_reports;
  drop policy if exists "fact_check_reports: delete own" on fact_check_reports;

  drop policy if exists "user_profiles: select own" on user_profiles;
  drop policy if exists "user_profiles: insert own" on user_profiles;
  drop policy if exists "user_profiles: update own" on user_profiles;
  drop policy if exists "user_profiles: delete own" on user_profiles;

  drop policy if exists "storage: documents user folder access" on storage.objects;
  drop policy if exists "storage: avatars public read"          on storage.objects;
  drop policy if exists "storage: avatars user write"           on storage.objects;
  drop policy if exists "storage: avatars user update"          on storage.objects;
end $$;

-- ── Courses policies ─────────────────────────────
create policy "courses: select own" on courses for select using (auth.uid() = user_id);
create policy "courses: insert own" on courses for insert with check (auth.uid() = user_id);
create policy "courses: update own" on courses for update using (auth.uid() = user_id);
create policy "courses: delete own" on courses for delete using (auth.uid() = user_id);

-- ── Assignments policies ──────────────────────────
create policy "assignments: select own" on assignments for select using (auth.uid() = user_id);
create policy "assignments: insert own" on assignments for insert with check (auth.uid() = user_id);
create policy "assignments: update own" on assignments for update using (auth.uid() = user_id);
create policy "assignments: delete own" on assignments for delete using (auth.uid() = user_id);

-- ── Documents policies ────────────────────────────
create policy "documents: select own" on documents for select using (auth.uid() = user_id);
create policy "documents: insert own" on documents for insert with check (auth.uid() = user_id);
create policy "documents: update own" on documents for update using (auth.uid() = user_id);
create policy "documents: delete own" on documents for delete using (auth.uid() = user_id);

-- ── Reminders policies ────────────────────────────
create policy "reminders: select own" on reminders for select using (auth.uid() = user_id);
create policy "reminders: insert own" on reminders for insert with check (auth.uid() = user_id);
create policy "reminders: update own" on reminders for update using (auth.uid() = user_id);
create policy "reminders: delete own" on reminders for delete using (auth.uid() = user_id);

create policy "course_insights: select own" on course_insights for select using (auth.uid() = user_id);
create policy "course_insights: insert own" on course_insights for insert with check (auth.uid() = user_id);
create policy "course_insights: update own" on course_insights for update using (auth.uid() = user_id);
create policy "course_insights: delete own" on course_insights for delete using (auth.uid() = user_id);

create policy "fact_check_reports: select own" on fact_check_reports for select using (auth.uid() = user_id);
create policy "fact_check_reports: insert own" on fact_check_reports for insert with check (auth.uid() = user_id);
create policy "fact_check_reports: update own" on fact_check_reports for update using (auth.uid() = user_id);
create policy "fact_check_reports: delete own" on fact_check_reports for delete using (auth.uid() = user_id);

create policy "user_profiles: select own" on user_profiles for select using (auth.uid() = user_id);
create policy "user_profiles: insert own" on user_profiles for insert with check (auth.uid() = user_id);
create policy "user_profiles: update own" on user_profiles for update using (auth.uid() = user_id);
create policy "user_profiles: delete own" on user_profiles for delete using (auth.uid() = user_id);

-- ── Storage buckets ───────────────────────────────
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- ── Storage policies ──────────────────────────────
create policy "storage: documents user folder access"
  on storage.objects for all
  using  (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "storage: avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "storage: avatars user write"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "storage: avatars user update"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ── All done! ─────────────────────────────────────
-- Tables:  courses · assignments · documents · reminders · course_insights · fact_check_reports
-- Storage: documents (private) · avatars (public)
-- Auth:    email/password enabled by default
--          Google OAuth → Dashboard → Authentication → Providers → Google
