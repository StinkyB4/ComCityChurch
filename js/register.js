/**
 * COMMISSIONED CITY CHURCH — REGISTRATION FORM HANDLER
 * Handles members/register.html
 */
document.addEventListener('DOMContentLoaded', async function () {

  /* wait for Supabase CDN */
  var t = 0;
  while (!window.supabase && t < 60) { await new Promise(r => setTimeout(r, 100)); t++; }

  var url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
  if (!url || url === '{{ SUPABASE_URL }}') return; /* not configured */
  var _sb = window.supabase.createClient(url, key);

  /* if already logged-in approved member → redirect */
  var { data: { user } } = await _sb.auth.getUser();
  if (user) {
    var { data: prof } = await _sb.from('profiles').select('status').eq('id', user.id).single();
    if (prof) {
      window.location.href = prof.status === 'approved' ? '/members/dashboard.html' : '/members/pending.html';
      return;
    }
  }

  /* load reCAPTCHA if key provided */
  var rKey = window.RECAPTCHA_SITE_KEY;
  if (rKey && rKey !== '{{ RECAPTCHA_SITE_KEY }}') {
    var sc = document.createElement('script');
    sc.src = 'https://www.google.com/recaptcha/api.js?render=' + rKey;
    document.head.appendChild(sc);
  }

  var form    = document.getElementById('register-form');
  var alertEl = document.getElementById('reg-alert');
  var submitBtn = document.getElementById('reg-submit-btn');

  function showAlert(msg, type) {
    alertEl.innerHTML = msg;
    alertEl.className = 'mp-alert mp-alert--' + (type || 'error');
    alertEl.style.display = '';
    alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideAlert() { alertEl.style.display = 'none'; }

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideAlert();

    /* honeypot check */
    if (document.getElementById('hp-field') && document.getElementById('hp-field').value) return;

    /* collect form data */
    var fd = new FormData(form);

    var firstName  = (fd.get('first_name') || '').trim();
    var lastName   = (fd.get('last_name')  || '').trim();
    var email      = (fd.get('email')      || '').trim();
    var phone1Type = fd.get('phone1_type') || 'Cell';
    var phone1     = (fd.get('phone1')     || '').trim();
    var phone2Type = fd.get('phone2_type') || 'Home';
    var phone2     = (fd.get('phone2')     || '').trim();
    var addrStreet = (fd.get('addr_street')   || '').trim();
    var addrCity   = (fd.get('addr_city')     || '').trim();
    var addrProv   = (fd.get('addr_province') || '').trim();
    var addrPostal = (fd.get('addr_postal')   || '').trim();
    var addrCountry= (fd.get('addr_country')  || '').trim();
    var birthday   = (fd.get('birthday')    || '').trim();
    var anniversary= (fd.get('anniversary') || '').trim();
    var password   = fd.get('password')  || '';
    var confirm    = fd.get('confirm')   || '';
    var gender          = fd.get('gender')             || '';
    var bio             = (fd.get('bio')               || '').trim();
    /* validation */
    var errors = [];
    if (!firstName)  errors.push('First name is required.');
    if (!lastName)   errors.push('Last name is required.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('A valid email address is required.');
    if (!phone1)     errors.push('A primary phone number is required.');
    if (phone1 && !/^\d{3}-\d{3}-\d{4}$/.test(phone1)) errors.push('Primary phone must be in 204-555-0100 format.');
    if (phone2 && !/^\d{3}-\d{3}-\d{4}$/.test(phone2)) errors.push('Secondary phone must be in 204-555-0100 format.');
    if (!addrStreet) errors.push('Street address is required.');
    if (!addrCity)   errors.push('City is required.');
    if (!addrProv)   errors.push('Province is required.');
    if (!addrPostal) errors.push('Postal code is required.');
    if (!birthday)   errors.push('Birthday is required.');
    if (birthday) {
      var bdDate = new Date(birthday + 'T12:00:00');
      var minAge = new Date(); minAge.setFullYear(minAge.getFullYear() - 18);
      if (bdDate > minAge) errors.push('You must be at least 18 years old to register.');
    }
    if (!password || password.length < 8) errors.push('Password must be at least 8 characters.');
    if (password !== confirm) errors.push('Passwords do not match.');
    if (!gender)  errors.push('Please select your gender.');

    /* photo validation */
    var photoFile = form.querySelector('#reg-photo');
    var hasPhoto  = photoFile && photoFile.files && photoFile.files[0];
    if (hasPhoto) {
      var pf = photoFile.files[0];
      if (!['image/jpeg','image/jpg','image/png','image/gif','image/webp'].includes(pf.type))
        errors.push('Profile photo must be JPG, PNG, GIF or WebP.');
      if (pf.size > 10 * 1024 * 1024)
        errors.push('Profile photo must be under 10MB.');
    }

    if (errors.length) {
      showAlert(errors.map(function (e) { return '⚠ ' + e; }).join('<br>'), 'error');
      return;
    }

    /* reCAPTCHA */
    var recaptchaToken = '';
    if (rKey && rKey !== '{{ RECAPTCHA_SITE_KEY }}' && window.grecaptcha) {
      try {
        recaptchaToken = await new Promise(function (resolve, reject) {
          window.grecaptcha.ready(function () {
            window.grecaptcha.execute(rKey, { action: 'register' }).then(resolve).catch(reject);
          });
        });
      } catch (capErr) {
        showAlert('reCAPTCHA verification failed. Please refresh and try again.', 'error'); return;
      }
    }

    submitBtn.disabled   = true;
    submitBtn.textContent = 'Creating account…';

    var address = [addrStreet, addrCity, addrProv, addrPostal, addrCountry].filter(Boolean).join(', ');

    /* call supabase.auth.signUp — trigger creates profile row via DB trigger */
    var { data: authData, error: authError } = await _sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name:     firstName + ' ' + lastName,
          first_name:    firstName,
          last_name:     lastName,
          phone1_type:   phone1Type,
          phone1:        phone1,
          phone2_type:   phone2Type,
          phone2:        phone2,
          addr_street:   addrStreet,
          addr_city:     addrCity,
          addr_province: addrProv,
          addr_postal:   addrPostal,
          addr_country:  addrCountry,
          address:       address,
          birthday:      birthday || null,
          anniversary:   anniversary || null,
          gender:        gender,
          bio:           bio
        },
        emailRedirectTo: 'https://commissionedcity.church/members/pending.html'
      }
    });

    if (authError) {
      submitBtn.disabled   = false;
      submitBtn.textContent = 'Submit Registration';
      showAlert('⚠ ' + authError.message, 'error');
      return;
    }

    var userId = authData.user ? authData.user.id : null;

    /* also update the profile row directly (in case trigger only stored basic fields) */
    if (userId) {
      await _sb.from('profiles').update({
        first_name: firstName, last_name: lastName,
        full_name: firstName + ' ' + lastName,
        phone1_type: phone1Type, phone1, phone2_type: phone2Type, phone2,
        addr_street: addrStreet, addr_city: addrCity,
        addr_province: addrProv, addr_postal: addrPostal,
        addr_country: addrCountry, address,
        birthday: birthday || null, anniversary: anniversary || null,
        gender, bio
      }).eq('id', userId);

      /* upload profile photo — prefer cropped blob, fall back to raw file */
      var cropBlob = window._avatarCropBlob;
      if (cropBlob) {
        try {
          var ppath = userId + '/' + Date.now() + '.jpg';
          var { data: upD, error: upE } = await _sb.storage.from('avatars').upload(ppath, cropBlob, { contentType: 'image/jpeg' });
          if (!upE && upD) {
            var { data: uD } = _sb.storage.from('avatars').getPublicUrl(ppath);
            if (uD) await _sb.from('profiles').update({ avatar_url: uD.publicUrl }).eq('id', userId);
          }
          window._avatarCropBlob = null;
        } catch (photoErr) { console.warn('Photo upload failed:', photoErr); }
      } else if (hasPhoto) {
        try {
          var pf2    = photoFile.files[0];
          var ext    = pf2.name.split('.').pop();
          var ppath2 = userId + '/' + Date.now() + '.' + ext;
          var { data: upD2, error: upE2 } = await _sb.storage.from('avatars').upload(ppath2, pf2);
          if (!upE2 && upD2) {
            var { data: uD2 } = _sb.storage.from('avatars').getPublicUrl(ppath2);
            if (uD2) await _sb.from('profiles').update({ avatar_url: uD2.publicUrl }).eq('id', userId);
          }
        } catch (photoErr) { console.warn('Photo upload failed:', photoErr); }
      }

      /* send admin notification + user pending emails via edge function */
      try {
        await _sb.functions.invoke('send-email', { body: {
          action: 'registration_admin',
          user_id: userId, full_name: firstName + ' ' + lastName,
          email, phone1_type: phone1Type, phone1, address, birthday
        } });
        await _sb.functions.invoke('send-email', { body: {
          action: 'account_pending',
          user_id: userId, first_name: firstName, email
        } });
      } catch (e) { console.warn('Edge function not available:', e.message); }
    }

    /* store info for pending page — needed when email confirmation is enabled
       and Supabase returns no session, so getCurrentUser() would be null */
    try {
      sessionStorage.setItem('mp_pending_name',  firstName);
      sessionStorage.setItem('mp_pending_email', email);
    } catch (e) { /* storage blocked — pending page falls back gracefully */ }

    /* redirect to pending page */
    window.location.href = '/members/pending.html';
  });
});

