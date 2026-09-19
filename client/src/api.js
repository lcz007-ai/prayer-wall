const ACCESS_KEY = 'prayer-wall-access-token';
let accessToken = localStorage.getItem(ACCESS_KEY) || '';

// 生产环境通过 VITE_API_BASE 指定后端域名（App 打包必须），留空则走同源相对路径
const API_BASE = import.meta.env.VITE_API_BASE || '';

export function setAccessToken(token) {
  accessToken = token;
  localStorage.setItem(ACCESS_KEY, token);
}

export function clearAccessToken() {
  accessToken = '';
  localStorage.removeItem(ACCESS_KEY);
}

async function request(path, options = {}) {
  const headers = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['x-access-token'] = accessToken;

  const res = await fetch(`${API_BASE}/api${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: 'include'
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore non-JSON responses
  }
  if (!res.ok) {
    const err = new Error(data?.error || `请求失败 (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  access: (password) => request('/auth/access', { method: 'POST', body: { password } }),
  sendCode: (phone) => request('/auth/send-code', { method: 'POST', body: { phone } }),
  login: (phone, code) => request('/auth/login', { method: 'POST', body: { phone, code } }),
  guestLogin: () => request('/auth/guest', { method: 'POST' }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  updateMe: (patch) => request('/me', { method: 'PATCH', body: patch }),
  posts: (scope, tag = '', query = '', before = null) => {
    const params = new URLSearchParams({ scope });
    if (tag) params.set('tag', tag);
    if (query) params.set('q', query);
    if (before) params.set('before', before);
    return request(`/posts?${params.toString()}`);
  },
  createPost: (body) => request('/posts', { method: 'POST', body }),
  deletePost: (id) => request(`/posts/${id}`, { method: 'DELETE' }),
  setAnswered: (id, status) => request(`/posts/${id}/answer`, { method: 'POST', body: { status } }),
  pray: (id) => request(`/posts/${id}/pray`, { method: 'POST' }),
  comments: (id) => request(`/posts/${id}/comments`),
  addComment: (id, content) => request(`/posts/${id}/comments`, { method: 'POST', body: { content } }),
  deleteComment: (postId, commentId) =>
    request(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),
  savePost: (id) => request(`/posts/${id}/save`, { method: 'POST' }),
  unsavePost: (id) => request(`/posts/${id}/save`, { method: 'DELETE' })
};
