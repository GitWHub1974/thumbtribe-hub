
# Thumbtribe Client Dashboard - Implementation Plan

This plan covers building the full application in 4 phases, starting with authentication and ending with Jira/Tempo integration.

---

## Phase 1: Authentication and Role-Based Routing

**What it does:** Adds login/signup pages and automatically routes users to the correct area based on their role (admin or client).

**Files to create:**
- `src/contexts/AuthContext.tsx` - Auth state provider with session management and role detection
- `src/components/ProtectedRoute.tsx` - Route guard that checks auth + role
- `src/pages/Auth.tsx` - Login and signup page with email/password forms
- `src/pages/admin/AdminDashboard.tsx` - Placeholder admin landing page
- `src/pages/dashboard/ClientDashboard.tsx` - Client dashboard (will be fleshed out in Phase 2)

**Files to modify:**
- `src/App.tsx` - Add AuthProvider, protected routes for `/admin/*`, `/dashboard/*`, and redirect logic

**Key behaviors:**
- Unauthenticated users see the login/signup page
- After login, users are redirected based on their role in `user_roles` table
- Admins go to `/admin`, clients go to `/dashboard`
- Attempting to access the wrong area redirects appropriately
- Email verification required before login (no auto-confirm)

---

## Phase 2: Client Dashboard UI

**What it does:** Builds the client-facing portal with project selector, Gantt chart, time tracking table, and metrics.

**Files to create:**
- `src/pages/dashboard/ClientDashboard.tsx` - Main dashboard with project selector and tabs
- `src/components/dashboard/ProjectSelector.tsx` - Dropdown to pick from assigned projects
- `src/components/dashboard/GanttChart.tsx` - Read-only Gantt chart (Epics/Stories/Tasks, color-coded by status: gray=To Do, blue=In Progress, green=Done)
- `src/components/dashboard/TimeTrackingTable.tsx` - Table with grouping (by epic/assignee) and CSV export
- `src/components/dashboard/ProjectMetrics.tsx` - Completion % and total hours cards
- `src/hooks/useClientProjects.ts` - Fetch assigned projects
- `src/hooks/useJiraIssues.ts` - Fetch issues from edge function
- `src/hooks/useTempoWorklogs.ts` - Fetch worklogs from edge function

**Key behaviors:**
- Client selects a project from their assigned list
- Gantt chart renders the Epic > Story > Task hierarchy with start/end dates
- Time tracking table shows logged hours with grouping and CSV download
- Metrics cards show completion percentage and total hours
- Data is cached client-side during the session via React Query

---

## Phase 3: Admin Section

**What it does:** Gives admins the ability to manage projects, assign clients, and configure Jira credentials.

**Files to create:**
- `src/pages/admin/AdminDashboard.tsx` - Admin overview with project list
- `src/pages/admin/ProjectManagement.tsx` - CRUD for projects
- `src/pages/admin/ClientManagement.tsx` - Assign/remove clients to projects, manage user roles
- `src/pages/admin/JiraSettings.tsx` - Configure Jira base URL, API email/token, Tempo token, and start date field ID per project
- `src/components/admin/AdminSidebar.tsx` - Admin navigation

**Files to modify:**
- `src/App.tsx` - Add admin routes

**Key behaviors:**
- Admins can create/edit/delete projects
- Admins can assign clients to projects via the `client_projects` table
- Admins can enter and update Jira/Tempo credentials per project (stored in `jira_credentials` table)
- Admins can configure the custom "Start Date" field ID per Jira instance

---

## Phase 4: Edge Functions (Jira and Tempo Integration)

**What it does:** Creates secure backend functions that proxy requests to Jira and Tempo APIs using stored credentials.

**Files to create:**
- `supabase/functions/fetch-jira-issues/index.ts` - Fetches epics, stories, and tasks from Jira REST API using credentials from `jira_credentials` table
- `supabase/functions/fetch-tempo-worklogs/index.ts` - Fetches time logs from Tempo API using stored token

**Files to modify:**
- `supabase/config.toml` - Add `verify_jwt = false` for both functions

**Key behaviors:**
- Functions read credentials from database (never exposed to frontend)
- Authenticated requests only (JWT validated in code)
- Client must be assigned to the project to fetch its data (verified via `is_client_for_project`)
- Jira function fetches issues with the configurable start date custom field
- Tempo function fetches worklogs for a given project and date range
- Both return structured JSON consumed by the dashboard hooks

---

## Implementation Order

1. **Phase 1** first - everything depends on auth
2. **Phase 3** next - so admins can create projects and add credentials for testing
3. **Phase 4** next - edge functions to fetch real data
4. **Phase 2** last - client dashboard consumes the edge function data

---

## Technical Details

- Auth uses `supabase.auth.onAuthStateChange` listener set up before `getSession()`
- Role check queries `user_roles` table after authentication
- Gantt chart built with pure CSS/HTML (no extra library needed) using horizontal bars
- CSV export uses native Blob/download approach
- Edge functions use `createClient` with the user's auth header forwarded
- All CORS headers included in edge functions per Lovable Cloud requirements
