# Test Plan

## Testing Approach

LearnBeam was tested using a practical integration-focused strategy because the application combines frontend UI, Supabase services, file processing, and multiple AI providers.

## Test Areas

### Authentication
- Sign in with email/password
- Sign in with Google OAuth
- Route protection for dashboard, course pages, and profile

### Course Management
- Create course
- Open course
- View and update course-related data

### Assignments / Reminders / Grades
- Add and edit assignments
- Add and edit reminders
- Verify grades-related displays and context

### Documents
- Upload supported files
- Extract readable text
- Persist metadata and text

### Syllabus Import
- Analyze syllabus
- Save course insights
- Create assignments and reminders from syllabus content

### Spark AI
- Course Sources mode
- Spark Open mode
- Fact-check flow
- Quiz generation
- Suggestion generation

### Persistence
- Verify saved course data across reloads
- Verify saved profile/avatar behavior
- Verify fact-check and syllabus persistence

### Deployment
- Build with `npm run build`
- Validate Vercel frontend behavior
- Validate Supabase-backed production behavior

## Validation Strategy

- Manual integration testing during development
- Repeated regression-style testing after major feature changes
- Production build verification
