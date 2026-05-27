/**
 * COMMISSIONED CITY CHURCH — MEMBERS PORTAL JAVASCRIPT
 * ====================================================
 * Handles auth form interactions, validation, and Supabase integration.
 */

// ──────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ──────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Supabase
  if (typeof initSupabase !== 'undefined') {
    try {
      await initSupabase();
    } catch (err) {
      console.error('Failed to initialize Supabase:', err.message);
      showMessage('signin', 'error', 'Configuration error. Please contact support.');
    }
  }

  // Check if user is already authenticated
  const user = await getCurrentUser();
  if (user) {
    // User is already signed in, redirect to portal home
    window.location.href = '/members/dashboard.html';
  }

  // Bind form events
  setupFormHandlers();
  setupTabHandlers();
});

// ──────────────────────────────────────────────────────────────────────────
// TAB SWITCHING
// ──────────────────────────────────────────────────────────────────────────

function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.auth-tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Show selected tab
  const selectedTab = document.getElementById(tabName);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }

  // Update button states
  document.querySelectorAll('.auth-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    }
  });

  // Clear previous messages
  clearMessage('signin');
  clearMessage('register');
}

function setupTabHandlers() {
  document.querySelectorAll('.auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });
}

// ──────────────────────────────────────────────────────────────────────────
// FORM HANDLING
// ──────────────────────────────────────────────────────────────────────────

function setupFormHandlers() {
  // Sign In form
  const signInForm = document.getElementById('sign-in-form');
  if (signInForm) {
    signInForm.addEventListener('submit', handleSignIn);
  }

  // Register form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
}

async function handleSignIn(e) {
  e.preventDefault();
  clearMessage('signin');

  const email = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;

  // Validation
  if (!email || !password) {
    showMessage('signin', 'error', 'Please enter your email and password.');
    return;
  }

  if (!isValidEmail(email)) {
    showMessage('signin', 'error', 'Please enter a valid email address.');
    return;
  }

  // Show loading state
  const submitBtn = document.querySelector('#sign-in-form button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';

  try {
    const { user, session, error } = await signIn(email, password);

    if (error) {
      showMessage('signin', 'error', error.message || 'Sign in failed. Please check your credentials.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    if (user) {
      // Get profile to check status
      const profile = await getProfile();

      if (profile.status === 'pending') {
        showMessage('signin', 'info', 'Your account is pending approval. You'll receive an email when approved.');
        await signOut();
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
      }

      if (profile.status === 'inactive') {
        showMessage('signin', 'error', 'Your account has been deactivated. Please contact support.');
        await signOut();
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
      }

      // Approved — redirect to portal
      showMessage('signin', 'success', 'Welcome back! Redirecting...');
      setTimeout(() => {
        window.location.href = '/members/dashboard.html';
      }, 500);
    }
  } catch (err) {
    console.error('Sign in error:', err);
    showMessage('signin', 'error', 'An unexpected error occurred. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  clearMessage('register');

  const fullName = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm').value;

  // Validation
  if (!fullName || !email || !password || !confirmPassword) {
    showMessage('register', 'error', 'Please fill in all fields.');
    return;
  }

  if (!isValidEmail(email)) {
    showMessage('register', 'error', 'Please enter a valid email address.');
    return;
  }

  if (password.length < 8) {
    showMessage('register', 'error', 'Password must be at least 8 characters.');
    return;
  }

  if (password !== confirmPassword) {
    showMessage('register', 'error', 'Passwords do not match.');
    return;
  }

  // Show loading state
  const submitBtn = document.querySelector('#register-form button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';

  try {
    const { user, error } = await signUp(email, password, fullName);

    if (error) {
      showMessage('register', 'error', error.message || 'Sign up failed. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    if (user) {
      // Success — show confirmation message
      showMessage('register', 'success', 'Account created! Check your email for confirmation. An admin will review your application shortly.');

      // Clear form
      document.getElementById('register-form').reset();

      // Redirect to sign-in after delay
      setTimeout(() => {
        switchTab('sign-in');
      }, 3000);
    }
  } catch (err) {
    console.error('Sign up error:', err);
    showMessage('register', 'error', 'An unexpected error occurred. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// MESSAGE DISPLAY
// ──────────────────────────────────────────────────────────────────────────

function showMessage(formId, type, message) {
  const messageEl = document.getElementById(`${formId}-message`);
  if (!messageEl) return;

  messageEl.textContent = message;
  messageEl.className = `form-message show ${type}`;
  messageEl.setAttribute('role', 'alert');

  // Auto-hide after 6 seconds for non-persistent messages
  if (type === 'success') {
    setTimeout(() => clearMessage(formId), 6000);
  }
}

function clearMessage(formId) {
  const messageEl = document.getElementById(`${formId}-message`);
  if (messageEl) {
    messageEl.textContent = '';
    messageEl.className = 'form-message';
    messageEl.removeAttribute('role');
  }
}

// ──────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ──────────────────────────────────────────────────────────────────────────

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// ──────────────────────────────────────────────────────────────────────────
// EXPORTS
// ──────────────────────────────────────────────────────────────────────────

window.switchTab = switchTab;
