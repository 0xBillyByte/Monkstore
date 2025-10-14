// auth-ui.js - Handle authentication UI updates and login/register functionality
import { isAuthenticated, getCurrentUser, logout } from './api.js';

// Update authentication UI across all pages
export function updateAuthUI() {
    const isLoggedIn = isAuthenticated();
    const user = getCurrentUser();
    
    // Update navigation links
    const profileLinks = document.querySelectorAll('.profile-link, a[href="profile.html"]');
    const loginLinks = document.querySelectorAll('.login-link, a[href="login.html"]');
    
    profileLinks.forEach(link => {
        if (isLoggedIn) {
            link.style.display = 'inline-block';
            if (link.textContent === 'Profile' && user) {
                link.textContent = user.username;
            }
        } else {
            link.style.display = 'none';
        }
    });
    
    loginLinks.forEach(link => {
        if (isLoggedIn) {
            link.textContent = 'Logout';
            link.href = '#';
            link.onclick = (e) => {
                e.preventDefault();
                logout();
            };
        } else {
            link.textContent = 'Login';
            link.href = 'login.html';
            link.onclick = null;
        }
    });
    
    // Show/hide login-required elements
    const authRequired = document.querySelectorAll('.auth-required');
    authRequired.forEach(el => {
        el.style.display = isLoggedIn ? 'block' : 'none';
    });
    
    const authHidden = document.querySelectorAll('.auth-hidden');
    authHidden.forEach(el => {
        el.style.display = isLoggedIn ? 'none' : 'block';
    });
}

// Switch between login and register tabs
function switchTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabs = document.querySelectorAll('.auth-tab');

  if (!loginForm || !registerForm) return;

  if (tab === 'login') {
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
    tabs[0].classList.add('active');
    tabs[1].classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'flex';
    tabs[0].classList.remove('active');
    tabs[1].classList.add('active');
  }

  const loginError = document.getElementById('loginError');
  const registerError = document.getElementById('registerError');
  const registerSuccess = document.getElementById('registerSuccess');

  if (loginError) loginError.style.display = 'none';
  if (registerError) registerError.style.display = 'none';
  if (registerSuccess) registerSuccess.style.display = 'none';
}

// Initialize authentication forms if on login page
function initAuthForms() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const errorEl = document.getElementById('loginError');
            
            try {
                const response = await fetch(`${api.baseUrl}/api/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = 'shop.html';
                } else {
                    errorEl.textContent = data.error === 'invalid_credentials' 
                        ? 'Invalid username or password' 
                        : 'Login failed. Please try again.';
                    errorEl.style.display = 'block';
                }
            } catch (error) {
                errorEl.textContent = 'Network error. Please try again.';
                errorEl.style.display = 'block';
            }
        });
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const errorEl = document.getElementById('registerError');
            const successEl = document.getElementById('registerSuccess');
            
            try {
                const response = await fetch(`${api.baseUrl}/api/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    successEl.textContent = 'Registration successful! Redirecting...';
                    successEl.style.display = 'block';
                    errorEl.style.display = 'none';
                    
                    setTimeout(() => {
                        window.location.href = 'shop.html';
                    }, 1500);
                } else {
                    errorEl.textContent = data.error === 'user_exists' 
                        ? 'Username or email already exists' 
                        : 'Registration failed. Please try again.';
                    errorEl.style.display = 'block';
                    successEl.style.display = 'none';
                }
            } catch (error) {
                errorEl.textContent = 'Network error. Please try again.';
                errorEl.style.display = 'block';
                successEl.style.display = 'none';
            }
        });
    }
    
    // Check if user is already logged in on login page
    if (loginForm && isAuthenticated()) {
        window.location.href = 'shop.html';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    initAuthForms();
});
window.switchTab = switchTab;
