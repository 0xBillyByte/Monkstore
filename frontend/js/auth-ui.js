// auth-ui.js - Handle authentication UI updates and login/register functionality
import { isAuthenticated, getCurrentUser, logout, api, apiFetch } from './api.js';
import logger from './logger.js';

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
            
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const errorEl  = document.getElementById('loginError');

            if (!username || !password) {
                const msg = 'Username and password are required.';
                errorEl.textContent = msg;
                errorEl.style.display = 'block';
                logger.warn(msg, 'login');
                return;
            }
            
            try {
                const response = await apiFetch('/login', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ username, password }),
                }, 'login');
                
                const data = await response.json();
                
                if (response.ok) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    logger.success(`Logged in as "${data.user.username}".`, 'login');
                    window.location.href = 'shop.html';
                } else {
                    const msg = data.error === 'invalid_credentials'
                        ? 'Invalid username or password.'
                        : (data.error === 'missing_credentials'
                            ? 'Username and password are required.'
                            : 'Login failed. Please try again.');
                    errorEl.textContent = msg;
                    errorEl.style.display = 'block';
                }
            } catch (error) {
                const msg = navigator.onLine
                    ? 'Cannot reach the server. Please check your connection.'
                    : 'No internet connection. Please check your network.';
                errorEl.textContent = msg;
                errorEl.style.display = 'block';
                logger.error(`Login exception: ${error.message}`, 'login');
            }
        });
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username  = document.getElementById('registerUsername').value.trim();
            const email     = document.getElementById('registerEmail').value.trim();
            const password  = document.getElementById('registerPassword').value;
            const errorEl   = document.getElementById('registerError');
            const successEl = document.getElementById('registerSuccess');

            // Basic client-side validation before hitting the server
            if (!username || !email || !password) {
                const msg = 'All fields (username, email, password) are required.';
                errorEl.textContent = msg;
                errorEl.style.display = 'block';
                successEl.style.display = 'none';
                logger.warn(msg, 'register');
                return;
            }
            
            try {
                const response = await apiFetch('/register', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ username, email, password }),
                }, 'register');
                
                const data = await response.json();
                
                if (response.ok) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    successEl.textContent = 'Registration successful! Redirecting…';
                    successEl.style.display = 'block';
                    errorEl.style.display = 'none';
                    logger.success(`Account created for "${data.user.username}".`, 'register');
                    
                    setTimeout(() => {
                        window.location.href = 'shop.html';
                    }, 1500);
                } else {
                    const msg = data.error === 'user_exists'
                        ? 'A user with that username or email already exists.'
                        : (data.error === 'missing_fields'
                            ? 'All fields are required for registration.'
                            : 'Registration failed. Please try again.');
                    errorEl.textContent = msg;
                    errorEl.style.display = 'block';
                    successEl.style.display = 'none';
                }
            } catch (error) {
                const msg = navigator.onLine
                    ? 'Cannot reach the server. Please check your connection.'
                    : 'No internet connection. Please check your network.';
                errorEl.textContent = msg;
                errorEl.style.display = 'block';
                successEl.style.display = 'none';
                logger.error(`Registration exception: ${error.message}`, 'register');
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
