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

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body !== undefined) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, options);

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    Store.set('user', null);
    window.location.hash = '#/login';
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
    const message = data?.detail ?? data?.message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data;
}

export { API_BASE };

export const api = {
  request,
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
};
