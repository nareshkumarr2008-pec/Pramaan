const BASE = "/api";
const TOKEN_KEY = "pramaan_token";

// sessionStorage (not localStorage) is per-tab: each browser tab gets its
// own independent copy, so logging in as a different user in another tab
// no longer overwrites the session of the first tab. The trade-off is that
// a session no longer survives closing the tab (it did with localStorage) —
// each new tab starts logged out, same as before within that tab.
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* empty body */
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request("/health"),

  signup: (payload) => request("/auth/signup", { method: "POST", body: payload }),
  login: (username, password) => request("/auth/login", { method: "POST", body: { username, password } }),
  me: () => request("/auth/me", { auth: true }),

  assessSkill: (payload) => request("/workers/assess", { method: "POST", body: payload, auth: true }),
  saveWorker: (payload) => request("/workers", { method: "POST", body: payload, auth: true }),
  listWorkers: () => request("/workers"),
  getWorker: (id) => request(`/workers/${encodeURIComponent(id)}`),
  myWorkers: () => request("/workers/mine", { auth: true }),
  setAutoApply: (workerId, enabled) => request(`/workers/${workerId}/auto-apply`, { method: "PATCH", body: { enabled }, auth: true }),
  generateResume: (workerId, lang) => request(`/workers/${workerId}/resume`, { method: "POST", body: { lang }, auth: true }),

  generateCapsule: (payload) => request("/jobs/capsule", { method: "POST", body: payload, auth: true }),
  saveJob: (payload) => request("/jobs", { method: "POST", body: payload, auth: true }),
  listJobs: () => request("/jobs"),
  myJobs: () => request("/jobs/mine", { auth: true }),
  runMatch: (jobId) => request(`/jobs/${jobId}/match`, { method: "POST", auth: true }),

  apply: (jobId) => request("/applications", { method: "POST", body: { jobId }, auth: true }),
  myApplications: () => request("/applications/mine", { auth: true }),

  startTrial: (payload) => request("/trials", { method: "POST", body: payload, auth: true }),

  adminListUsers: () => request("/admin/users", { auth: true }),
  adminDeleteUser: (username) => request(`/admin/users/${encodeURIComponent(username)}`, { method: "DELETE", auth: true }),
  adminListMsme: () => request("/admin/msme", { auth: true }),
  adminDeleteMsme: (jobId) => request(`/admin/msme/${jobId}`, { method: "DELETE", auth: true }),
};
