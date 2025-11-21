# Product Requirements Document: Job Search Activity Tracker

## 1. Product Overview

A web-based job search tracking application that helps job seekers log, monitor, and analyze their job search activities. The app provides insights into application trends, tracks weekly progress goals, and offers AI-powered analytics to improve job search strategies.

## 2. Core Features

### 2.1 Activity Management
- **Manual Entry**: Users can log job search activities with details:
  - Date of activity
  - Company name
  - Job title
  - Activity type (application, interview, networking, job fair, resume submission, phone call, email inquiry, recruiter contact, other)
  - Job description URL (optional)
  - Contact person (optional)
  - Contact method (optional)
  - Notes (optional)
  - Application status (application, assessment, hr_screen, hiring_manager, final_round, offer, rejected)

- **Gmail Integration**: Import job applications automatically by:
  - Connecting Gmail account via OAuth 2.0 (read-only access)
  - AI-powered email parsing to extract application details
  - Batch import of recent emails matching job application patterns

- **Activity Operations**:
  - View all activities in paginated table
  - Delete activities
  - Filter and search (future enhancement)

### 2.2 Analytics & Insights

- **Weekly Summary Dashboard**:
  - Track activities per week
  - Weekly goal tracking (configurable by user)
  - Visual indicator of goal compliance
  - Breakdown by activity type

- **Visualization**:
  - Category distribution chart (pie/bar chart)
  - Job title frequency chart
  - Weekly trend analysis

- **AI-Powered Insights**:
  - Analyze job search patterns
  - Provide 4-6 actionable recommendations
  - Identify trends and opportunities
  - Suggest improvements to job search strategy

### 2.3 Data Export
- Export activities to CSV
- Export activities to PDF with formatting
- Filtered exports by date range or activity type

### 2.4 User Settings
- Configurable weekly activity goal
- Account management
- Preferences storage

## 3. Technical Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with shadcn/ui components
- **Routing**: React Router v6
- **State Management**: React hooks (useState, useEffect)
- **Charts**: Recharts library
- **PDF Generation**: jsPDF with jsPDF-autotable
- **Icons**: Lucide React

### Backend (Lovable Cloud/Supabase)
- **Database**: PostgreSQL
- **Authentication**: Supabase Auth (email/password + Google Sign-In)
- **Edge Functions**: Deno-based serverless functions
- **File Storage**: Supabase Storage (if needed)
- **Real-time**: Supabase Realtime (optional)

### Third-Party Integrations
- **Gmail API**: OAuth 2.0 with gmail.readonly scope (for email imports only)
- **Google Sign-In**: OAuth 2.0 for user authentication
- **AI Service**: Lovable AI API for email parsing and insights

## 4. Database Schema

### Tables

#### `profiles`
```sql
- id: UUID (primary key, references auth.users)
- email: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `user_preferences`
```sql
- id: UUID (primary key)
- user_id: UUID (references auth.users)
- weekly_goal: INTEGER (default: 5)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `job_search_activities`
```sql
- id: UUID (primary key)
- user_id: UUID (references auth.users)
- date: DATE
- company_name: TEXT
- job_title: TEXT
- activity_type: TEXT
- job_description_url: TEXT (nullable)
- contact_person: TEXT (nullable)
- contact_method: TEXT (nullable)
- notes: TEXT (nullable)
- status: TEXT (nullable)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `gmail_tokens`
```sql
- id: UUID (primary key)
- user_id: UUID (references auth.users)
- access_token: TEXT (encrypted)
- refresh_token: TEXT (nullable, encrypted)
- expires_at: TIMESTAMP
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### RLS Policies
All tables have Row Level Security enabled with policies ensuring users can only access their own data:
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

## 5. User Flows

### 5.1 Authentication Flow

#### Email/Password Authentication
1. User lands on auth page
2. Can sign up with email/password or sign in
3. Email auto-confirm enabled (no verification email)
4. Form validation with password strength requirements
5. Redirect to dashboard after authentication

#### Google Sign-In Authentication
1. User lands on auth page
2. Clicks "Sign in with Google" button
3. Redirected to Google OAuth consent screen
4. Grants required permissions (email, profile)
5. Returns to app with authorization code
6. Backend exchanges code for tokens and creates/updates user profile
7. Redirect to dashboard after authentication

#### Protected Routes
- All authenticated routes require valid session
- Automatic redirect to auth page if not logged in
- Session persists across browser sessions

### 5.2 Manual Activity Entry
1. Click "Add Activity" button
2. Fill out dialog form with activity details
3. Submit to save to database
4. Activity appears in table and updates analytics

### 5.3 Gmail Import Flow
1. Click "Connect Gmail" button
2. Redirect to Google OAuth consent screen (separate from auth)
3. Grant gmail.readonly permission
4. Return to app with authorization code
5. Backend exchanges code for tokens and stores securely
6. Click "Import from Gmail" button
7. Select number of days to import (1, 7, 14, 30)
8. Backend fetches emails, parses with AI, saves activities
9. Dashboard updates with imported activities

**Note**: Gmail OAuth is separate from Google Sign-In. Users authenticate with Google for their account, then separately grant Gmail access for email imports.

### 5.4 Analytics Review
1. View weekly summary cards on dashboard
2. Check compliance with weekly goals
3. Review category and job title charts
4. Click "Get AI Insights" for personalized recommendations
5. Review actionable insights based on activity patterns

## 6. Edge Functions

### `gmail-oauth-config`
- Returns Gmail OAuth client ID
- No authentication required (public endpoint)

### `gmail-auth`
- Exchanges OAuth authorization code for access/refresh tokens
- Requires JWT authentication
- Stores encrypted tokens in database

### `fetch-gmail-emails`
- Fetches emails from Gmail API
- Parameters: accessToken, daysAgo
- Parses emails and extracts job application data
- Inserts activities into database
- Returns count of imported activities

### `parse-email`
- AI-powered email content parsing
- Extracts: company name, job title, date, job URL
- Input limit: 50KB per email
- Uses Lovable AI API

### `analyze-job-search`
- AI-powered activity analysis
- Generates 4-6 actionable insights
- Input limit: 1000 activities
- Returns structured JSON with recommendations

## 7. Security Requirements

### Authentication
- **Email/Password**: 
  - Strong password validation (min 8 characters)
  - Password breach protection enabled
  - Email validation using Zod schema
  - Auto-confirm email signups (for development/testing)
  
- **Google Sign-In**:
  - OAuth 2.0 flow with proper redirect URLs
  - Scopes requested: email, profile (openid implicit)
  - User profile created/updated on successful auth
  - Session management with JWT tokens

- **Session Management**:
  - JWT-based authentication
  - Auto token refresh
  - Persistent sessions across browser restarts
  - Secure logout with token revocation

### Data Protection
- All user data protected by Row Level Security
- Gmail tokens encrypted at rest
- OAuth endpoints require JWT verification
- Input validation and size limits on all endpoints

### API Security
- CORS headers configured
- Rate limiting on AI endpoints
- API keys stored as secrets (LOVABLE_API_KEY)
- Gmail OAuth credentials as secrets (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET)
- Google Sign-In credentials managed via Lovable Cloud dashboard

## 8. UI/UX Requirements

### Design System
- Modern, clean interface with HSL color system
- Semantic tokens for theming (primary, secondary, background, foreground, etc.)
- Responsive design (mobile, tablet, desktop)
- Consistent spacing and typography
- shadcn/ui component library for UI elements

### Key Screens

#### Auth Page (`/auth`)
- Tabbed interface (Sign In / Sign Up)
- Email and password inputs with validation
- Password visibility toggle
- "Sign in with Google" button (prominent placement)
- Form validation with error messages
- Loading states for both auth methods
- Automatic redirect to dashboard if already authenticated

#### Dashboard (`/`)
- Header with app title, user email, action buttons
- Stats overview cards (total activities, week progress, compliant weeks)
- Weekly summary cards with progress bars
- Category and job title charts
- AI insights card
- Paginated activity table
- Logout functionality

### Component Structure
- `ActivityDialog`: Modal for adding activities
- `ActivityTable`: Paginated table with delete functionality
- `WeeklySummaryCard`: Weekly progress display
- `CategoryChart`: Pie/bar chart for activity types
- `JobTitleChart`: Bar chart for job applications
- `AnalyticsDashboard`: AI insights display
- `GmailConnectButton`: OAuth connection flow for Gmail
- `GmailImportDialog`: Email import interface
- `SettingsDialog`: User preferences management
- `ExportMenu`: CSV/PDF export options

## 9. Configuration Requirements

### Environment Variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Secrets (Backend)
- `LOVABLE_API_KEY`: For AI services
- `GMAIL_CLIENT_ID`: Google OAuth client ID for Gmail API
- `GMAIL_CLIENT_SECRET`: Google OAuth client secret for Gmail API
- Google Sign-In OAuth credentials configured via Lovable Cloud dashboard

### Google Cloud Console Setup

#### For Gmail API Integration (Email Imports)
1. Create OAuth 2.0 credentials (Web application type)
2. Configure authorized redirect URIs for Gmail auth callback
3. Enable Gmail API
4. Add `gmail.readonly` scope only
5. Store Client ID and Secret in Lovable Cloud secrets

#### For Google Sign-In (User Authentication)
1. Configure OAuth consent screen:
   - Add privacy policy and terms of service links
   - Configure branding (app name, logo)
   - Verify authorized domains
2. Create OAuth 2.0 credentials (Web application type) or use same credentials as Gmail
3. Configure authorized JavaScript origins:
   - Add production domain
   - Add preview domain
   - Add `http://localhost` for local development
4. Configure authorized redirect URIs:
   - Add Supabase callback URL (visible in Lovable Cloud dashboard)
   - Format: `https://<PROJECT_ID>.supabase.co/auth/v1/callback`
5. Configure scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
6. Configure in Lovable Cloud:
   - Navigate to Backend → Users → Auth Settings → Google Settings
   - Enter Client ID and Client Secret
   - Enable Google provider

### Site URL and Redirect URL Configuration
- Managed automatically by Lovable Cloud
- Additional domains can be added in Lovable Cloud dashboard
- Required for proper OAuth flows
- Access via: Backend → Users → Auth Settings

## 10. OAuth Flow Differences

### Google Sign-In OAuth (User Authentication)
- **Purpose**: Authenticate users to access the application
- **Scopes**: email, profile, openid
- **Redirect**: Supabase auth callback URL
- **Token Storage**: Managed by Supabase Auth
- **Configuration**: Lovable Cloud dashboard (Backend → Users → Auth Settings)

### Gmail API OAuth (Email Import)
- **Purpose**: Read user's Gmail emails to import job applications
- **Scopes**: gmail.readonly only
- **Redirect**: Custom application callback URL
- **Token Storage**: Custom `gmail_tokens` table (encrypted)
- **Configuration**: Separate OAuth credentials, stored as secrets

These are completely independent OAuth flows. Users can:
- Sign in with Google (authentication)
- Then separately connect Gmail (email access)
- Or use email/password auth and connect Gmail
- Or use Google Sign-In without connecting Gmail

## 11. Future Enhancements
- Activity filtering and advanced search
- Bulk operations (bulk delete, bulk edit)
- Password reset functionality
- Email reminders for weekly goals
- Application status pipeline visualization
- Interview preparation notes
- Company research integration
- Networking contact management
- Calendar integration for interview scheduling
- Browser extension for one-click job application tracking
