-- ============================================================
-- LearnBeam – Persistence migration
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Store extracted text content directly in the documents table
--    so re-extraction from Storage is never needed.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS text_content text;

-- ============================================================
-- 2. Course insights table
--    Stores the AI-extracted syllabus analysis so it persists
--    across devices and sessions without needing a re-scan.
-- ============================================================
CREATE TABLE IF NOT EXISTS course_insights (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         uuid        NOT NULL REFERENCES courses(id)      ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  course_code       text,
  course_name       text,
  instructor        text,
  term              text,
  meeting_schedule  text,
  location          text,
  summary           text,
  grading_policy    jsonb       NOT NULL DEFAULT '[]',
  warnings          jsonb       NOT NULL DEFAULT '[]',
  source_file_name  text        NOT NULL DEFAULT '',
  analyzed_at       timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id)
);

ALTER TABLE course_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own insights" ON course_insights;
CREATE POLICY "Users manage own insights" ON course_insights
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. Fact-check reports table
--    Stores the result of Spark's fact-checking pass on each
--    document so it is never re-generated.
-- ============================================================
CREATE TABLE IF NOT EXISTS fact_check_reports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid        NOT NULL REFERENCES documents(id)    ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  doc_name      text        NOT NULL,
  summary       text        NOT NULL DEFAULT '',
  claims        jsonb       NOT NULL DEFAULT '[]',
  generated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id)
);

ALTER TABLE fact_check_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own fact checks" ON fact_check_reports;
CREATE POLICY "Users manage own fact checks" ON fact_check_reports
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. User profiles table
--    Stores cross-device user preferences that must survive
--    OAuth metadata resets, including custom avatar URLs.
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_url   text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own profile" ON user_profiles;
CREATE POLICY "Users manage own profile" ON user_profiles
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
