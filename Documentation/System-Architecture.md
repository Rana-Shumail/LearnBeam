# System Architecture

## Overview

LearnBeam is a full-stack student academic platform built with a React frontend and a Supabase-backed backend. The system uses Spark AI as an orchestration layer to support document-grounded answers, fact-checking, syllabus analysis, and study assistance.

## High-Level Architecture

1. **Frontend**
   - Built with React 19, TypeScript, Vite, and React Router
   - Handles UI, routing, course pages, dashboard, profile, and Spark chat

2. **Backend Platform**
   - Supabase Auth for login and protected sessions
   - Supabase Postgres for structured data persistence
   - Supabase Storage for document and avatar files
   - Supabase Edge Functions for secure AI provider routing

3. **AI Layer**
   - `spark-ai` Edge Function acts as the secure AI gateway
   - Routes requests across Gemini, Cerebras, and Groq depending on task type
   - Keeps API logic off the frontend

## AI Routing Logic

- **Cerebras** is used first for standard text-heavy tasks
- **Groq** acts as a backup/fallback provider for supported tasks
- **Gemini** is used for grounded search, fact-checking, and image/scanned syllabus tasks

## Document-Grounded Workflow

1. User uploads a course document
2. Text is extracted from the file
3. Extracted text is stored for reuse
4. Spark selects relevant excerpts when the user asks a course question
5. Spark answers from that evidence instead of relying only on general model knowledge

## Key Architectural Strengths

- Secure AI provider access through server-side routing
- Persistent document and syllabus intelligence
- Reduced hallucination risk for course-grounded responses
- Separation between general AI help and course-specific evidence-based help
