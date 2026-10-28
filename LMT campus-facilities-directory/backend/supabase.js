
const { createClient } = require('@supabase/supabase-js');

function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.'
    );
  }

  if (!/^https:\/\/.+/.test(url)) {
    throw new Error(
      'SUPABASE_URL must be a valid HTTPS Supabase project URL.'
    );
  }

  // This key bypasses Row Level Security.
  // Keep it exclusively on the backend.
  // Never place it in frontend JavaScript or expose it in API responses.
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'X-Client-Info': 'campus-facilities-directory/1.0.0'
      }
    }
  });
}

module.exports = {
  createSupabaseClient
};