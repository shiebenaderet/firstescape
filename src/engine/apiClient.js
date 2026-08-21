// Thin client for the Escape Hub Worker API.
// Handles the teacher session token (kept in sessionStorage) and JSON fetches.

import { API_BASE } from '../config.js';

const TOKEN_KEY = 'escape-hub:v1:teacher-token';

export function apiEnabled() {
  return !!API_BASE;
}

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}
export function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
export function isLoggedIn() {
  return !!getToken();
}
export function logout() {
  setToken('');
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---- public ---- */
export function fetchPublishedEscapes() {
  return request('/api/escapes').then((d) => (d && d.escapes) || []);
}
export function fetchVisibility() {
  return request('/api/visibility').then((d) => (d && d.hidden) || []);
}
export function setVisibility(hidden) {
  return request('/api/admin/visibility', { method: 'PUT', body: { hidden }, auth: true });
}
export function submitResult(escapeId, record) {
  return request('/api/results', { method: 'POST', body: { escapeId, record } });
}

/* ---- auth ---- */
export async function login(password) {
  const d = await request('/api/login', { method: 'POST', body: { password } });
  setToken(d.token);
  return d.token;
}

/* ---- admin ---- */
export function fetchAllResults(escapeId) {
  const q = escapeId ? `?escapeId=${encodeURIComponent(escapeId)}` : '';
  return request(`/api/admin/results${q}`, { auth: true }).then((d) => (d && d.results) || []);
}
export function deleteResult(id) {
  return request(`/api/admin/results/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}
export function fetchAdminEscapes() {
  return request('/api/admin/escapes', { auth: true }).then((d) => (d && d.escapes) || []);
}
export function saveEscape(id, payload) {
  return request(`/api/admin/escapes/${encodeURIComponent(id)}`, { method: 'PUT', body: payload, auth: true });
}
export function deleteEscape(id) {
  return request(`/api/admin/escapes/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

/* ---- media uploads ---- */

/**
 * Upload a recorded clue to R2 and get back its public URL.
 *
 * Deliberately bypasses request(): that helper always sets Content-Type to application/json
 * and JSON.stringify()s the body, which would turn a Blob into the string "{}". Here the raw
 * blob IS the body, and its own MIME type is what the server validates.
 *
 * @param {Blob} blob   the recording (from MediaRecorder or a file input)
 * @param {'video'|'audio'} kind
 * @returns {Promise<{url: string, key: string, type: string, bytes: number}>}
 */
export async function uploadMedia(blob, kind) {
  const res = await fetch(`${API_BASE}/api/admin/media?type=${encodeURIComponent(kind)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': blob.type || (kind === 'audio' ? 'audio/webm' : 'video/webm'),
    },
    body: blob,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Upload failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
