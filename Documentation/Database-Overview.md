# Database Overview

LearnBeam uses Supabase Postgres as its main database.

## Core Tables

### `courses`
- Stores each course created by a user
- Includes course code, name, color, and ownership

### `assignments`
- Stores assignment label, type, due date, weight, grade, and status
- Linked to both the course and the authenticated user

### `documents`
- Stores uploaded document metadata
- Includes file name, type, size, storage path, and extracted text content

### `reminders`
- Stores reminder text, due date, and completion state

### `course_insights`
- Stores syllabus analysis results
- Includes course summary, instructor, term, meeting schedule, location, grading policy, and warnings

### `fact_check_reports`
- Stores generated fact-check summaries and claim-level results for documents

### `user_profiles`
- Stores shared user profile information such as custom avatar URL

## Storage

- `documents` bucket: private course files
- `avatars` bucket: public avatar images

## Security

- Row Level Security (RLS) is enabled on the main user data tables
- Policies restrict each user to their own records

## Persistence Value

The database is important not only for CRUD features, but also for reducing repeated AI work. Syllabus insights, extracted document text, and fact-check reports are stored so the system can reuse them rather than regenerate them every time.
