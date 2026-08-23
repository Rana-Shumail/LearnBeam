# LearnBeam

LearnBeam is an AI-powered academic workspace built for students. It combines course management, document upload, syllabus analysis, reminders, grades, quizzes, and Spark AI into one web application.

## Team Information

- **Senior Design Team:** Team 10 – AI Student Learning Assistant Senior Design Team
- **Project/Product Name:** LearnBeam
- **Team Lead:** Karan Kumar Sah
- **Team Members:**
  - Abhishek Acharya
  - Karan Kumar Sah
  - Nischal Karki
  - Rana Ahmad Shumail
  - Pujan Ghimire

## Project Purpose

Students often manage courses across too many disconnected tools such as learning platforms, reminders, notes, calendars, and general AI chat apps. LearnBeam reduces that fragmentation by giving students one place to:

- create and manage courses
- upload syllabi and study documents
- track assignments, reminders, and grades
- generate quizzes and study suggestions
- use Spark AI for course-grounded and general academic help

## Core Features

- User authentication with email/password and Google OAuth
- Course dashboard and per-course workspace
- Assignment, reminder, and grade tracking
- Document upload with text extraction for PDF, DOCX, TXT, and presentation/spreadsheet formats
- Syllabus analysis that fills in course details, assignments, reminders, and grading context
- Spark AI chat with:
  - **Course Sources** mode for document-grounded answers
  - **Spark Open** mode for broader help
- Fact-check reports for uploaded non-syllabus documents
- Quiz generation from uploaded course materials
- Persistent course insights, fact-check reports, and profile data

## Technologies Used

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS + custom theme styles
- Lucide React

### Backend / Platform

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Edge Functions

### AI

- Gemini
- Cerebras
- Groq

### File Processing

- pdfjs-dist
- mammoth
- jszip

## Repository Structure

```text
LearnBeam
├── src/                      # Frontend application
│   ├── app/                  # Routes, pages, components
│   ├── lib/                  # AI, database, import, persistence helpers
│   └── styles/               # Global and theme styles
├── supabase/                 # Backend configuration, functions, migrations
│   ├── functions/            # spark-ai Edge Function and shared helpers
│   └── migrations/           # Database migration files
├── Documentation/           # Architecture, database, user guide, maintenance docs
├── Testing/                 # Test plan and test results
├── CONTRIBUTIONS.md         # Team member contribution summary
├── SUPABASE_SCHEMA.sql      # Database schema setup SQL
├── package.json             # Project dependencies and scripts
└── README.md                # Project overview and setup guide
```

## Documentation

- [Team Contributions](./CONTRIBUTIONS.md)
- [System Architecture](./Documentation/System-Architecture.md)
- [Database Overview](./Documentation/Database-Overview.md)
- [User Guide](./Documentation/User-Guide.md)
- [Maintenance Plan](./Documentation/Maintenance-Plan.md)
- [Test Plan](./Testing/Test-Plan.md)
- [Test Results](./Testing/Test-Results.md)
- [Capstone II Submission Info](./CapstoneII_Submission.md)

## Installation

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Copy environment values into a local env file:

```bash
cp .env.example .env.local
```

4. Fill `.env.local` with your frontend environment values.

## How to Run the Application

Start the local development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Backend and Database Setup

- Configure Supabase Auth, Storage, and Edge Functions
- Apply the migration in `supabase/migrations/20260420000000_persistence.sql`
- Use `SUPABASE_SCHEMA.sql` for full schema reference and setup
- Deploy the `spark-ai` Edge Function to Supabase

## Testing

This project was tested primarily through:

- build validation with `npm run build`
- repeated manual integration testing
- authentication flow testing
- document upload and syllabus import testing
- AI response testing for Spark Open, Course Sources, fact-checking, and quizzes
- persistence testing across sessions and devices

See the [Testing](./Testing) folder for details.

## Deployment

- **Frontend:** Vercel
- **Backend AI + Data:** Supabase

## Notes

- Local-only archive materials are stored in `more stuff/` and are intentionally excluded from Git.
- Local environment secrets are not committed.
- Spark routes AI tasks across Gemini, Cerebras, and Groq depending on task type and reliability needs.
