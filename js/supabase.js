/**
 * COMMISSIONED CITY CHURCH — SUPABASE AUTH & DATABASE HELPERS
 * ============================================================
 * Client-side wrapper for Supabase authentication and member portal access.
 *
 * SETUP:
 *   1. Create Supabase project at supabase.com
 *   2. Set environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_KEY
 *   3. Import this module: import { getCurrentUser, requireAuth } from '/js/supabase.js'
 *   4. Initialize on page load: await initSupabase()
 *
 * ROLE HIERARCHY:
 *   - 'admin'     → Full access to all tables, approves members
 *   - 'team'      → Can lead teams/communities, see rosters
 *   - 'member'    → Default role, restricted to own profile + public content
 *
 * STATUS FLOW:
 *   - 'pending'   → Newly signed up, awaiting admin approval
 *   - 'approved'  → Admin approved, full portal access
 *   - 'inactive'  → Temporarily or permanently deactivated
 */

// ──────────────────────────────────────────────────────────────────────────
// SUPABASE CLIENT INITIALIZATION
// ──────────────────────────────────────────────────────────────────────────

let supabaseClient = null;

async function initSupabase() {
  if (typeof window.supabase === 'undefined') {
    throw new Error('Supabase library not loaded. Add: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"></script>');
  }

  const { createClient } = window.supabase;
  const url = window.SUPABASE_URL || 'https://your-project.supabase.co';
  const key = window.SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    throw new Error('Supabase URL or Key missing. Check window.SUPABASE_URL and window.SUPABASE_ANON_KEY');
  }

  supabaseClient = createClient(url, key);
  return supabaseClient;
}

function getSupabase() {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized. Call initSupabase() first.');
  }
  return supabaseClient;
}


// ──────────────────────────────────────────────────────────────────────────
// AUTHENTICATION HELPERS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Get current authenticated user.
 * @returns {Promise<Object|null>} User object with id, email, or null if not signed in
 */
async function getCurrentUser() {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

/**
 * Get current user's profile from database.
 * @returns {Promise<Object|null>} Profile object with full_name, role, status, etc.
 */
async function getProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error.message);
    return null;
  }

  return data;
}

/**
 * Sign up with email and password. Creates profile with role='member', status='pending'.
 * @param {string} email
 * @param {string} password
 * @param {string} fullName
 * @returns {Promise<Object>} { user, session, error }
 */
async function signUp(email, password, fullName) {
  const sb = getSupabase();

  const { data: authData, error: authError } = await sb.auth.signUp({
    email,
    password,
    options: {
      // full_name is stored in raw_user_meta_data and picked up by the
      // handle_new_user trigger in supabase/schema.sql, which creates the
      // profiles row automatically as SECURITY DEFINER (bypasses RLS).
      data: { full_name: fullName },
      // After email confirmation the user lands back on the login page.
      emailRedirectTo: window.location.origin + '/members/',
    },
  });

  if (authError) {
    return { user: null, session: null, error: authError };
  }

  return {
    user: authData.user,
    session: authData.session,
    error: null,
  };
}

/**
 * Sign in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} { user, session, error }
 */
async function signIn(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  return {
    user: data?.user || null,
    session: data?.session || null,
    error,
  };
}

/**
 * Sign out current user.
 * @returns {Promise<Object>} { error }
 */
async function signOut() {
  const sb = getSupabase();
  const { error } = await sb.auth.signOut();
  return { error };
}

/**
 * Check if user is authenticated.
 * @returns {Promise<boolean>}
 */
async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}

/**
 * Require authentication; redirect to members login if not signed in.
 * @param {string} redirectPath - Path to redirect to if not authenticated (default: '/members/')
 * @returns {Promise<Object>} Authenticated user profile
 */
async function requireAuth(redirectPath = '/members/') {
  const profile = await getProfile();

  if (!profile) {
    window.location.href = redirectPath;
    return null;
  }

  // Check if approved
  if (profile.status !== 'approved') {
    console.warn(`User status is "${profile.status}", not approved yet.`);
  }

  return profile;
}

/**
 * Require admin role; redirect if user is not admin.
 * @param {string} redirectPath - Path to redirect to if not admin
 * @returns {Promise<Object>} Authenticated admin profile
 */
async function requireAdmin(redirectPath = '/members/') {
  const profile = await getProfile();

  if (!profile || profile.role !== 'admin') {
    console.warn('Admin access required.');
    window.location.href = redirectPath;
    return null;
  }

  return profile;
}


// ──────────────────────────────────────────────────────────────────────────
// PROFILE MANAGEMENT
// ──────────────────────────────────────────────────────────────────────────

/**
 * Update user's profile.
 * @param {Object} updates - Fields to update (full_name, phone, bio, avatar_url, preferred_community)
 * @returns {Promise<Object>} { data, error }
 */
async function updateProfile(updates) {
  const user = await getCurrentUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };

  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  return { data, error };
}

/**
 * Upload avatar image to Supabase Storage.
 * @param {File} file - Image file from <input type="file">
 * @returns {Promise<Object>} { url, error }
 */
async function uploadAvatar(file) {
  const user = await getCurrentUser();
  if (!user) return { url: null, error: new Error('Not authenticated') };

  const sb = getSupabase();

  // Generate unique filename: userid/timestamp-filename
  const ext = file.name.split('.').pop();
  const filename = `${user.id}/${Date.now()}.${ext}`;

  // Upload to 'avatars' bucket
  const { data, error: uploadError } = await sb.storage
    .from('avatars')
    .upload(filename, file);

  if (uploadError) {
    return { url: null, error: uploadError };
  }

  // Get public URL
  const { data: urlData } = sb.storage
    .from('avatars')
    .getPublicUrl(filename);

  // Update profile with avatar URL
  const { error: updateError } = await updateProfile({
    avatar_url: urlData.publicUrl,
  });

  if (updateError) {
    return { url: urlData.publicUrl, error: updateError };
  }

  return { url: urlData.publicUrl, error: null };
}


// ──────────────────────────────────────────────────────────────────────────
// MEMBER DIRECTORY
// ──────────────────────────────────────────────────────────────────────────

/**
 * Get list of approved team members (staff/leaders).
 * @returns {Promise<Array>} Array of approved profiles with role='team'
 */
async function getTeamRoster() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, avatar_url, phone, bio')
    .eq('role', 'team')
    .eq('status', 'approved')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Error fetching team roster:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Get members of a specific team.
 * @param {string} teamId - Team UUID
 * @returns {Promise<Array>} Array of team member profiles
 */
async function getTeamMembers(teamId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('team_members')
    .select(`
      id,
      member_id,
      role,
      joined_at,
      profiles:member_id (
        id, full_name, avatar_url, email, phone
      )
    `)
    .eq('team_id', teamId)
    .order('joined_at', { ascending: false });

  if (error) {
    console.error('Error fetching team members:', error.message);
    return [];
  }

  return data || [];
}


// ──────────────────────────────────────────────────────────────────────────
// COMMUNITIES & GROUPS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Get all missional communities.
 * @returns {Promise<Array>} Array of community objects
 */
async function getCommunities() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('missional_communities')
    .select(`
      id, name, description, meeting_time, meeting_location, color,
      profiles:leader_id (id, full_name, email)
    `)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching communities:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Get all volunteer teams.
 * @returns {Promise<Array>} Array of team objects
 */
async function getTeams() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('teams')
    .select(`
      id, name, description, color,
      profiles:leader_id (id, full_name, email)
    `)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching teams:', error.message);
    return [];
  }

  return data || [];
}


// ──────────────────────────────────────────────────────────────────────────
// PRAYER REQUESTS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Get public prayer requests.
 * @param {number} limit - Max results (default 10)
 * @returns {Promise<Array>} Array of prayer request objects
 */
async function getPrayerRequests(limit = 10) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('prayer_requests')
    .select(`
      id, title, content, is_private, prayer_count, created_at,
      profiles:author_id (id, full_name, avatar_url)
    `)
    .eq('is_private', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching prayer requests:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Submit a new prayer request.
 * @param {string} title
 * @param {string} content
 * @param {boolean} isPrivate - Only requestor + admins see
 * @returns {Promise<Object>} { data, error }
 */
async function submitPrayerRequest(title, content, isPrivate = false) {
  const user = await getCurrentUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };

  const sb = getSupabase();
  const { data, error } = await sb
    .from('prayer_requests')
    .insert({
      author_id: user.id,
      title,
      content,
      is_private: isPrivate,
    })
    .select()
    .single();

  return { data, error };
}


// ──────────────────────────────────────────────────────────────────────────
// ANNOUNCEMENTS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Get announcements visible to current user.
 * @param {number} limit - Max results (default 10)
 * @returns {Promise<Array>} Array of announcements
 */
async function getAnnouncements(limit = 10) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('admin_messages')
    .select(`
      id, title, content, type, published_at,
      profiles:author_id (id, full_name, avatar_url)
    `)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching announcements:', error.message);
    return [];
  }

  return data || [];
}


// ──────────────────────────────────────────────────────────────────────────
// EXPORTS
// ──────────────────────────────────────────────────────────────────────────

// Make helpers available globally
window.CommissionedCityChurchSupabase = {
  // Initialization
  initSupabase,
  getSupabase,

  // Auth
  getCurrentUser,
  getProfile,
  signUp,
  signIn,
  signOut,
  isAuthenticated,
  requireAuth,
  requireAdmin,

  // Profile
  updateProfile,
  uploadAvatar,

  // Directory
  getTeamRoster,
  getTeamMembers,

  // Communities
  getCommunities,
  getTeams,

  // Prayer
  getPrayerRequests,
  submitPrayerRequest,

  // Announcements
  getAnnouncements,
};

// Also export for ES6 imports
export {
  initSupabase,
  getSupabase,
  getCurrentUser,
  getProfile,
  signUp,
  signIn,
  signOut,
  isAuthenticated,
  requireAuth,
  requireAdmin,
  updateProfile,
  uploadAvatar,
  getTeamRoster,
  getTeamMembers,
  getCommunities,
  getTeams,
  getPrayerRequests,
  submitPrayerRequest,
  getAnnouncements,
};
