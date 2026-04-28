# LearnBeam

LearnBeam is an AI-powered academic workspace for students. It combines course management, document upload, syllabus analysis, reminders, grades, quizzes, and Spark AI into one web app.

## Core stack

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS + custom theme styles
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Edge Functions
- Gemini, Cerebras, and Groq for Spark AI

## Main app structure

- `src/`: frontend UI, routes, course tabs, Spark chat, and app logic
- `src/lib/`: database helpers, AI routing calls, syllabus import, fact-checking, document extraction
- `supabase/`: Edge Function, config, and database migrations
- `SUPABASE_SCHEMA.sql`: main database setup SQL
- `vercel.json`: frontend deployment configuration

## What stays in GitHub

This repo is now cleaned to focus on the real deployable project:

- app source code
- Supabase backend files
- schema + migration files
- package configuration
- deployment configuration

## Local-only archive

Extra presentation/reference files were moved into:

- `more stuff/`

That folder is ignored by Git so it stays on your machine and does not get included in the final GitHub push.

Examples of archived items:

- presentation deck files
- architecture HTML/PDF files
- wireframe and diagram files
- temporary slide/export folders
- local build output

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deployment

- Frontend: Vercel
- Backend AI + database: Supabase

## Notes

- `node_modules/`, `dist/`, `.vercel/`, and `more stuff/` should not be pushed.
- Use the Supabase migration files and `SUPABASE_SCHEMA.sql` to set up the database.
- Spark routes work across Gemini, Cerebras, and Groq depending on task type.
