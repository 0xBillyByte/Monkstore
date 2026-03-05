// api.js – Centralized API abstraction layer with detailed error handling
import logger from './logger.js';

const BASE = '/api';

// ------------------------------------------------------------------ Error maps

/**
 * Human-readable messages for common HTTP status codes.
 * Covers the full range a browser application is likely to encounter.
 */
const HTTP_ERROR_MESSAGES = {
  400: 'Bad Request – the server could not understand the request (invalid or malformed data).',
  401: 'Unauthorized – you are not logged in or your session token has expired.',
  403: 'Forbidden – you do not have permission to access this resource.',
  404: 'Not Found – the requested resource does not exist on the server.',
  405: 'Method Not Allowed – the HTTP method used is not supported for this endpoint.',
  408: 'Request Timeout – the server did not receive a complete request in time.',
  409: 'Conflict – the resource already exists or a data conflict was detected.',
  410: 'Gone – the resource has been permanently removed from the server.',
  422: 'Unprocessable Entity – the request data failed server-side validation.',
  429: 'Too Many Requests – you are being rate-limited. Please wait before retrying.',
  500: 'Internal Server Error – an unexpected error occurred on the server.',
  501: 'Not Implemented – the server does not support the requested functionality.',
  502: 'Bad Gateway – the server received an invalid response from an upstream service.',
  503: 'Service Unavailable – the server is temporarily down or under maintenance.',
  504: 'Gateway Timeout – the upstream server did not respond within the allowed time.',
};

/**
 * Human-readable messages for the structured `error` codes returned by our backend.
 */
const API_ERROR_MESSAGES = {
  invalid_json:           'The request body contained invalid JSON and could not be parsed.',
  missing_fields:         'One or more required fields are missing from the request.',
  missing_credentials:    'Both a username and password are required to log in.',
  invalid_credentials:    'Invalid username or password. Please check your credentials.',
  user_exists:            'A user with that username or email address already exists.',
  unauthorized:           'Authentication is required. Please log in to continue.',
  user_not_found:         'The requested user account could not be found in the database.',
  not_found:              'The requested item or resource was not found.',
  invalid_id:             'The ID provided is not in the expected format (e.g. monk-001).',
  missing_nftId:          'An NFT ID must be supplied for this cart operation.',
  invalid_nftId:          'The NFT ID provided is not a valid format.',
  db_error:               'A database error occurred on the server. Please try again later.',
  internal_server_error:  'An internal server error occurred. The team has been notified.',
  forbidden:              'Access to this resource is forbidden.',
};

// ------------------------------------------------------------------ Auth helpers

function getAuthHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ------------------------------------------------------------------ Core fetch wrapper

/**
 * Centralized fetch wrapper that:
 *  - Logs every outgoing request and its outcome.
 *  - Maps HTTP status codes and backend error codes to human-readable messages.
 *  - Classifies and logs network-level errors (offline, CORS, timeout).
 *
 * @param {string} endpoint  Path relative to BASE ('/monkeys') or absolute URL.
 * @param {RequestInit} options  Standard fetch options.
 * @param {string} context   Short label shown in the log panel (e.g. 'fetchNFTs').
 * @returns {Promise<Response>}
 */
export async function apiFetch(endpoint, options = {}, context = 'API') {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  logger.info(`→ ${method} ${url}`, context);

  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    const msg = _classifyNetworkError(err);
    logger.error(msg, context);
    throw err;
  }

  if (res.ok) {
    logger.success(`← ${res.status} ${url}`, context);
  } else {
    // Attempt to read a structured error body without consuming the stream
    let errorCode   = '';
    let errorDetail = '';
    try {
      const data  = await res.clone().json();
      errorCode   = data.error  || '';
      errorDetail = data.detail || '';
    } catch { /* non-JSON body – ignore */ }

    const httpMsg = HTTP_ERROR_MESSAGES[res.status] || `HTTP ${res.status} error.`;
    const apiMsg  = API_ERROR_MESSAGES[errorCode]   || (errorCode ? `Server error code: "${errorCode}".` : '');
    const detail  = errorDetail ? ` Detail: ${errorDetail}` : '';

    const logMsg  = apiMsg
      ? `${res.status} – ${apiMsg}${detail}`
      : `${res.status} – ${httpMsg}${detail}`;

    logger.error(logMsg, context);
  }

  return res;
}

/**
 * Translate a caught network-level Error into a user-friendly description.
 * Covers: offline, CORS/blocked, request abort, and generic TypeError.
 */
function _classifyNetworkError(err) {
  if (!navigator.onLine) {
    return 'No internet connection detected. Please check your network and try again.';
  }
  if (err.name === 'AbortError') {
    return 'The request was aborted (timeout). The server took too long to respond.';
  }
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
      return 'Cannot reach the server. The backend may be offline, unreachable, or blocking requests (CORS).';
    }
    if (msg.includes('load failed')) {
      return 'Network request failed to load. Check your connection and server status.';
    }
  }
  return `Network error: ${err.message}`;
}

// ------------------------------------------------------------------ Public API

export const api = { baseUrl: '' };

/**
 * Fetch the NFT catalogue with optional filters.
 * Errors: network failure, 500 DB error, 503 server down.
 */
export async function fetchNFTs(filters = {}) {
  const qs  = new URLSearchParams(filters).toString();
  const res = await apiFetch(`/monkeys?${qs}`, {}, 'fetchNFTs');
  if (!res.ok) throw new Error(`Failed to fetch NFTs: HTTP ${res.status}`);
  return res.json();
}

/**
 * Fetch the current user's cart.
 * Errors: 401 not authenticated, 500 DB error, network failure.
 */
export const getCart = async () => {
  const res = await apiFetch('/cart', { headers: getAuthHeaders() }, 'getCart');
  if (!res.ok) throw new Error(`Failed to fetch cart: HTTP ${res.status}`);
  return res.json();
};

/**
 * Add an NFT to the cart.
 * Errors: 401 (redirect to login), 400 invalid ID, 500 DB error, network failure.
 * @returns {boolean} true on success, false on 401.
 */
export const addToCart = async id => {
  const res = await apiFetch('/cart', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body:    JSON.stringify({ nftId: id }),
  }, 'addToCart');

  if (res.status === 401) {
    logger.warn('Session expired – redirecting to login page.', 'addToCart');
    window.location.href = '/login.html';
    return false;
  }
  return res.ok;
};

/**
 * Remove an NFT from the cart.
 * Errors: 401 (redirect to login), 400 invalid ID, 500 DB error, network failure.
 * @returns {Response}
 */
export const removeFromCart = async id => {
  const res = await apiFetch(`/cart/${id}`, {
    method:  'DELETE',
    headers: getAuthHeaders(),
  }, 'removeFromCart');

  if (res.status === 401) {
    logger.warn('Session expired – redirecting to login page.', 'removeFromCart');
    window.location.href = '/login.html';
  }
  return res;
};

// ------------------------------------------------------------------ Auth helpers

/** Returns true when a valid auth token is stored in localStorage. */
export const isAuthenticated = () => !!localStorage.getItem('authToken');

/**
 * Returns the cached user object from localStorage.
 * Logs a warning if the stored JSON is malformed.
 */
export const getCurrentUser = () => {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    logger.warn('Stored user data in localStorage is malformed and could not be parsed.', 'auth');
    return null;
  }
};

/** Clears the session and redirects to the login page. */
export const logout = () => {
  logger.info('User logged out – session cleared.', 'auth');
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
};

