-- ============================================================
-- LearnBeam – Smart Study Planner persistence
-- Stores deterministic study sessions generated from saved
-- assignments, reminders, and syllabus insights.
-- ============================================================

CREATE TABLE IF NOT EXISTS study_plans (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        uuid        NOT NULL REFERENCES courses(id)      ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  source_signature text        NOT NULL DEFAULT '',
  summary          text        NOT NULL DEFAULT '',
  sessions         jsonb       NOT NULL DEFAULT '[]',
  generated_at     timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id)
);

ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own study plans" ON study_plans;
CREATE POLICY "Users manage own study plans" ON study_plans
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
