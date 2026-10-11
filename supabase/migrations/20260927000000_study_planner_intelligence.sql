-- Smart Study Planner activity and source-grounded topic persistence.
ALTER TABLE study_plans
  ADD COLUMN IF NOT EXISTS topics jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS activity jsonb NOT NULL DEFAULT '{"focusSessions":0,"focusMinutes":0,"quizAttempts":[],"lastActivityAt":null}';
