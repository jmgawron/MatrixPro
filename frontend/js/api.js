import { Store } from './state.js';

const TOKEN_KEY = 'matrixpro_token';

/* When served via nginx (Docker), API is same-origin.
   For local dev (python -m http.server on :3000 + uvicorn on :8000),
   set API_BASE so fetch targets the backend directly. */
const API_BASE = (() => {
  const loc = window.location;
  // If served on a non-backend port, route API calls to backend on :8000
  if (loc.port !== '8000' && loc.port !== '80' && loc.port !== '') {
    return `${loc.protocol}//${loc.hostname}:8000`;
  }
  return '';
})();

let _authRedirectPending = false;

async function request(method, path, body, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const fetchOptions = { method, headers, ...options };
  if (body !== undefined) fetchOptions.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, fetchOptions);

  if (res.status === 401) {
    if (!_authRedirectPending) {
      _authRedirectPending = true;
      localStorage.removeItem(TOKEN_KEY);
      Store.set('user', null);
      window.location.hash = '#/login';
      setTimeout(() => { _authRedirectPending = false; }, 100);
    }
    throw new Error('Unauthorized');
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg ?? String(d)).join('; ')
      : (detail ?? data?.message ?? `HTTP ${res.status}`);
    throw new Error(typeof message === 'string' ? message : `HTTP ${res.status}`);
  }

  return data;
}

export { API_BASE };

export const api = {
  request,
  get: (path, opts) => request('GET', path, undefined, opts),
  post: (path, body, opts) => request('POST', path, body, opts),
  put: (path, body, opts) => request('PUT', path, body, opts),
  del: (path, opts) => request('DELETE', path, undefined, opts),
};
