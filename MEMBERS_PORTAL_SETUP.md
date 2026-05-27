# Members Portal Setup Guide

## Overview

The Members Portal is a private community platform for Commissioned City Church members. It includes:
- **User Authentication** via Supabase
- **Member Profiles** with avatars and contact info
- **Missional Communities** (neighborhood groups)
- **Volunteer Teams** (ministry groups)
- **Admin Dashboard** for church leaders

---

## Phase 1: Foundation Setup (Current)

### ✅ Files Created

1. **Database Schema**
   - `supabase/schema.sql` — 6 tables with Row Level Security policies
   - Tables: profiles, missional_communities, teams, team_members, admin_messages, prayer_requests

2. **Frontend Files**
   - `members/index.html` — Sign-in / Register page
   - `members/dashboard.html` — Portal home page
   - `css/members.css` — Portal styles
   - `js/supabase.js` — Auth helpers and database utilities
   - `js/members.js` — Form handling for auth pages
   - `js/dashboard.js` — Dashboard page logic

3. **Configuration**
   - Updated `staticwebapp.config.json` with /members routes

---

## Phase 1 Setup Instructions

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Select your organization
4. Choose a project name: `Commissioned City Church`
5. Set a strong database password
6. Select your region (closest to Winnipeg: **US East (N. Virginia)** or **Canada (Central)**)
7. Click **"Create new project"** and wait 2-3 minutes

### Step 2: Create the Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy the entire contents of `supabase/schema.sql`
4. Paste into the SQL editor
5. Click **"Run"** (or Ctrl+Enter)
6. Wait for all statements to complete (should show green checkmarks)

### Step 3: Create Storage Bucket for Avatars

1. Go to **Storage** in Supabase
2. Click **"New Bucket"**
3. Name it: `avatars`
4. Set to **"Public"** (so avatar URLs are accessible)
5. Click **"Create Bucket"**

### Step 4: Get Your Supabase Credentials

1. In Supabase, go to **Settings → API**
2. Copy the following and save them somewhere safe:
   - **Project URL** (e.g., `https://xxx.supabase.co`)
   - **anon public key** (e.g., `eyJhbG...`)

### Step 5: Configure Environment Variables

There are two ways to configure Supabase credentials:

#### Option A: Environment Variables (Recommended for Azure)

1. In Azure Static Web Apps, go to **Settings → Configuration**
2. Add two new application settings:
   ```
   SUPABASE_URL = https://xxx.supabase.co
   SUPABASE_ANON_KEY = eyJhbG...
   ```
3. Save and redeploy

#### Option B: Edit HTML Files (Quick Testing)

1. Open `members/index.html`
2. Find this section near the bottom:
   ```html
   <script>
     window.SUPABASE_URL = '{{ SUPABASE_URL }}';
     window.SUPABASE_ANON_KEY = '{{ SUPABASE_ANON_KEY }}';
   </script>
   ```
3. Replace with actual values:
   ```html
   <script>
     window.SUPABASE_URL = 'https://xxx.supabase.co';
     window.SUPABASE_ANON_KEY = 'eyJhbG...';
   </script>
   ```
4. Repeat for `members/dashboard.html`

**⚠️ Important:** Never commit credentials to GitHub. Use environment variables in production.

### Step 6: Test Locally

1. Open `members/index.html` in your browser
2. You should see the Sign-in / Register form
3. Try creating an account with:
   - Full Name: "John Doe"
   - Email: "test@example.com"
   - Password: "TestPassword123!"
4. Check your email for a Supabase confirmation link (in Supabase → Authentication)
5. Approve the user in Supabase:
   - Go to **Authentication → Users**
   - Click the test user
   - Set `status = 'approved'` in the profiles table
6. You should now be able to sign in

### Step 7: Deploy

1. Commit all Members Portal files to GitHub
2. Azure Static Web Apps will auto-deploy when you push to main
3. Set the SUPABASE_URL and SUPABASE_ANON_KEY in Azure (see Step 5)
4. Test at `https://your-domain.com/members/`

---

## File Structure

```
ComCityChurch/
├── members/
│   ├── index.html          ← Sign in/Register page
│   └── dashboard.html      ← Portal home (after login)
├── supabase/
│   └── schema.sql          ← Database schema & RLS policies
├── js/
│   ├── supabase.js         ← Auth helpers
│   ├── members.js          ← Form handling
│   └── dashboard.js        ← Dashboard logic
├── css/
│   └── members.css         ← Portal styles
└── MEMBERS_PORTAL_SETUP.md ← This file
```

---

## How It Works

### Authentication Flow

1. **Sign Up** (`members/index.html`)
   - User fills email, password, full name
   - Calls `signUp()` → creates auth.users + profiles row
   - Profile created with `role='member'`, `status='pending'`
   - Email confirmation sent by Supabase

2. **Email Verification**
   - User clicks link in Supabase confirmation email
   - Auth account is verified

3. **Admin Approval**
   - Admin manually updates profile in Supabase: `status='approved'`
   - User receives approval email (Phase 2)

4. **Sign In** (`members/index.html`)
   - User enters email/password
   - Calls `signIn()` → Supabase auth
   - Redirects to `/members/dashboard.html` if approved

5. **Dashboard** (`members/dashboard.html`)
   - Calls `requireAuth()` — redirects if not signed in
   - Loads profile, community info, announcements
   - Shows member-specific content via Row Level Security

### Row Level Security (RLS)

All database tables have RLS enabled. Each policy controls who can see/edit what:

- **Members** see their own profile + approved team rosters
- **Teams** see all community members + their own team members
- **Admins** see all profiles + can approve new members

Example: A member cannot see another member's phone number unless they're both on the same team.

---

## Supabase Console URL

Once you create your project, you can manage it at:

```
https://supabase.com/projects
```

From there you can:
- View/edit users in **Authentication**
- Browse tables in **SQL Editor**
- Create/delete records in the **Table Editor**
- View RLS policies in **Authentication → Policies**
- Check storage in **Storage**

---

## Troubleshooting

### "Supabase not initialized"
- Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set
- Check browser console for errors
- Verify Supabase project is active

### "User status is 'pending'"
- The admin hasn't approved the account yet
- Go to Supabase → Table Editor → profiles
- Find the user and set status to 'approved'
- User will be able to sign in after

### "Email confirmation not arriving"
- Check spam/junk folder
- In Supabase, go to **Authentication → Providers**
- Enable "Confirm email" if disabled
- Resend the confirmation from Supabase UI

### "Avatar upload fails"
- Make sure the `avatars` bucket exists in Storage
- Set the bucket to "Public" (not private)
- Check browser console for CORS errors

### "Cannot sign in after register"
- User email may not be confirmed yet
- Check Supabase → Authentication → Users for confirmation status
- Admin must approve the account (set status to 'approved')

---

## Next Steps (Phase 2-6)

Future phases include:
- **Phase 2:** Member directory & prayer request pages
- **Phase 3:** Admin dashboard for approving members
- **Phase 4:** Email notifications (welcome, approval, announcements)
- **Phase 5:** Community & team management
- **Phase 6:** Advanced features (groups, events, etc.)

---

## Security Notes

- ✅ **Row Level Security (RLS)** — Database enforces per-user access
- ✅ **Supabase Auth** — Enterprise-grade authentication
- ✅ **HTTPS Only** — All connections encrypted
- ✅ **Credentials in Environment** — Never commit to GitHub
- ⚠️ **Anon Key Public** — Intentionally public for browser auth (RLS prevents abuse)
- ⚠️ **Service Role Key** — Keep this secret (for admin APIs only)

---

## Support

For issues or questions:
1. Check Supabase documentation: https://supabase.com/docs
2. Review the code comments in `js/supabase.js`
3. Contact the development team

