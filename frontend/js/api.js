// api.js – nur noch echte Requests
const BASE = '/api';

// Get auth headers
function getAuthHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Export for use in other modules
export const api = {
  baseUrl: ''
};

export async function fetchNFTs(filters = {}) {
  const qs = new URLSearchParams(filters).toString();
  const res = await fetch(`${BASE}/monkeys?${qs}`);
  return res.json();
}

export const getCart = async () => {
  const res = await fetch(`${BASE}/cart`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch cart');
  return res.json();
};

export const addToCart = async id => {
  const res = await fetch(`${BASE}/cart`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ nftId: id })
  });
  if (res.status === 401) {
    window.location.href = '/login.html';
    return false;
  }
  return res.ok;
};

export const removeFromCart = async id => {
  const res = await fetch(`${BASE}/cart/${id}`, { 
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (res.status === 401) {
    window.location.href = '/login.html';
  }
  return res;
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!localStorage.getItem('authToken');
};

// Get current user
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// Logout
export const logout = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
};
