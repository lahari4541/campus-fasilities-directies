
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const { createSupabaseClient } = require('./supabase');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

const allowedOrigins = (process.env.FRONTEND_ORIGIN || `http://localhost:${PORT}`)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow requests without an Origin header, such as local health checks.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS.'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-admin-key']
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.static(FRONTEND_DIR));

let supabase = null;
let supabaseInitError = null;

try {
  supabase = createSupabaseClient();
} catch (error) {
  supabaseInitError = error.message;
  console.warn(`[configuration] ${error.message}`);
}

const TABLE = 'facilities';

const allowedFields = [
  'name',
  'category',
  'building',
  'location',
  'description',
  'opening_hours',
  'contact',
  'accessibility',
  'status'
];

const requiredFields = [
  'name',
  'category',
  'building',
  'location',
  'description'
];

function apiError(res, status, message, details) {
  return res.status(status).json({
    success: false,
    error: message,
    ...(details ? { details } : {})
  });
}

function dbOr503(res) {
  if (!supabase) {
    apiError(
      res,
      503,
      'Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.'
    );
    return false;
  }

  return true;
}

function cleanFacility(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const input = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      if (typeof body[field] !== 'string') {
        return { error: `${field} must be text.` };
      }

      input[field] = body[field].trim();
    }
  }

  const unknown = Object.keys(body).filter(
    key => !allowedFields.includes(key)
  );

  if (unknown.length) {
    return {
      error: `Unexpected field(s): ${unknown.join(', ')}.`
    };
  }

  if (!partial) {
    for (const field of requiredFields) {
      if (!input[field]) {
        return {
          error: `${field.replace('_', ' ')} is required.`
        };
      }
    }

    input.opening_hours = input.opening_hours || 'Not specified';
    input.contact = input.contact || 'Not specified';
    input.accessibility = input.accessibility || 'Not specified';
    input.status = input.status || 'Open';
  }

  for (const [field, value] of Object.entries(input)) {
    const maxLength = field === 'description' ? 1200 : 160;

    if (value.length > maxLength) {
      return {
        error: `${field} must be ${maxLength} characters or fewer.`
      };
    }
  }

  if (
    input.status &&
    !['Open', 'Closed', 'Limited'].includes(input.status)
  ) {
    return {
      error: 'status must be Open, Closed, or Limited.'
    };
  }

  return { data: input };
}

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;

  if (!expected) {
    return apiError(
      res,
      503,
      'Write access is disabled until ADMIN_API_KEY is configured in backend/.env.'
    );
  }

  const provided = req.get('x-admin-key');

  if (!provided || provided !== expected) {
    return apiError(
      res,
      401,
      'Admin key missing or incorrect. Enter the write key in the admin panel.'
    );
  }

  next();
}

function databaseFailure(res, error) {
  console.error('[Supabase]', error);

  // Avoid exposing internal database error details to public clients.
  return apiError(
    res,
    502,
    'The database request failed. Check your Supabase configuration, table schema, and server logs.'
  );
}

// API health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    api: 'ok',
    databaseConfigured: Boolean(supabase),
    ...(supabaseInitError
      ? { configurationMessage: supabaseInitError }
      : {})
  });
});

// Get all facilities, with optional filters and search.
app.get('/api/facilities', async (req, res) => {
  if (!dbOr503(res)) return;

  try {
    let query = supabase
      .from(TABLE)
      .select('*')
      .order('name', { ascending: true });

    if (req.query.category && req.query.category !== 'All') {
      query = query.eq('category', String(req.query.category));
    }

    if (req.query.status && req.query.status !== 'All') {
      query = query.eq('status', String(req.query.status));
    }

    if (req.query.q) {
      const searchTerm = String(req.query.q)
        .trim()
        .replace(/[,%()]/g, ' ');

      if (searchTerm) {
        query = query.or(
          `name.ilike.%${searchTerm}%,` +
          `building.ilike.%${searchTerm}%,` +
          `location.ilike.%${searchTerm}%,` +
          `description.ilike.%${searchTerm}%`
        );
      }
    }

    const { data, error } = await query;

    if (error) {
      return databaseFailure(res, error);
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return databaseFailure(res, error);
  }
});

// Get one facility by ID.
app.get('/api/facilities/:id', async (req, res) => {
  if (!dbOr503(res)) return;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) {
      return databaseFailure(res, error);
    }

    if (!data) {
      return apiError(res, 404, 'Facility not found.');
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return databaseFailure(res, error);
  }
});

// Create a facility.
app.post('/api/facilities', requireAdmin, async (req, res) => {
  if (!dbOr503(res)) return;

  const parsed = cleanFacility(req.body);

  if (parsed.error) {
    return apiError(res, 400, parsed.error);
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(parsed.data)
      .select('*')
      .single();

    if (error) {
      return databaseFailure(res, error);
    }

    return res.status(201).json({
      success: true,
      data,
      message: 'Facility created.'
    });
  } catch (error) {
    return databaseFailure(res, error);
  }
});

// Update a facility.
app.patch('/api/facilities/:id', requireAdmin, async (req, res) => {
  if (!dbOr503(res)) return;

  const parsed = cleanFacility(req.body, true);

  if (parsed.error) {
    return apiError(res, 400, parsed.error);
  }

  if (!Object.keys(parsed.data).length) {
    return apiError(
      res,
      400,
      'Provide at least one field to update.'
    );
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update(parsed.data)
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) {
      return databaseFailure(res, error);
    }

    if (!data) {
      return apiError(res, 404, 'Facility not found.');
    }

    return res.json({
      success: true,
      data,
      message: 'Facility updated.'
    });
  } catch (error) {
    return databaseFailure(res, error);
  }
});

// Delete a facility.
app.delete('/api/facilities/:id', requireAdmin, async (req, res) => {
  if (!dbOr503(res)) return;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle();

    if (error) {
      return databaseFailure(res, error);
    }

    if (!data) {
      return apiError(res, 404, 'Facility not found.');
    }

    return res.json({
      success: true,
      message: 'Facility deleted.'
    });
  } catch (error) {
    return databaseFailure(res, error);
  }
});

// Handle unknown API routes.
app.use('/api', (req, res) => {
  return apiError(res, 404, 'API route not found.');
});

// Serve the frontend application.
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Handle unexpected errors.
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return apiError(res, 400, 'Invalid JSON request body.');
  }

  if (error.message === 'Origin not allowed by CORS.') {
    return apiError(res, 403, 'Request origin is not allowed.');
  }

  console.error('[server]', error);

  return apiError(res, 500, 'Unexpected server error.');
});

app.listen(PORT, () => {
  console.log(
    `Campus Facilities Directory running at http://localhost:${PORT}`
  );
});