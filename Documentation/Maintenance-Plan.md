# Maintenance Plan

## Purpose

This document describes how LearnBeam should be maintained and improved over time.

## Ongoing Maintenance Areas

### 1. Dependency Updates
- Keep React, Vite, Supabase, and file-processing libraries up to date
- Rebuild after dependency changes to catch breakage early

### 2. AI Provider Monitoring
- Watch provider limits, failures, and model deprecations
- Revalidate routing behavior when models or quotas change

### 3. Database and Storage
- Maintain Supabase schema consistency
- Keep migration files updated for new persistence requirements
- Monitor storage bucket policies and access rules

### 4. Frontend Stability
- Re-test authentication, routing, mobile layouts, and Spark UI after significant changes

### 5. Documentation
- Keep README, CONTRIBUTIONS, and testing docs aligned with the actual project

## Recommended Next Improvements

- Add stronger automated testing
- Improve retrieval with embeddings/vector search
- Expand OCR and scanned-document support
- Improve analytics and learning insights
- Strengthen CI/CD and deployment validation
