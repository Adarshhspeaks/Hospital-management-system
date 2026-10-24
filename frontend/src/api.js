// One small wrapper so every page talks to the API the same way.
const TOKEN_KEY = 'hms_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

function getApiBase() {
  const envUrl = import.meta.env.VITE_API_URL;
  let trimmed = (envUrl || '').trim().replace(/\/$/, '');
  if (!trimmed) {
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('.onrender.com')) {
      return 'https://hms-backend-3i51.onrender.com';
    }
    return '';
  }
  // If Render passed an internal service name without domain (e.g. "hms-backend-3i51"), append ".onrender.com"
  if (!trimmed.includes('.') && !trimmed.startsWith('localhost')) {
    trimmed = `${trimmed}.onrender.com`;
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const API_BASE = getApiBase();

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check that the backend is running.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function downloadFile(path, filename) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to download file.');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

