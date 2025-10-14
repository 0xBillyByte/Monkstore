// profile.js - Handle profile page functionality
import { isAuthenticated, getCurrentUser, api } from './api.js';

// Initialize profile page
export async function initializeProfile() {
    if (!isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }
    
    await loadUserProfile();
    setupTabs();
}

// Load and display user profile
async function loadUserProfile() {
    try {
        // Get user data from token
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${api.baseUrl}/api/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load profile');
        }
        
        const data = await response.json();
        const user = data.user;
        
        // Update profile display
        document.querySelector('.profile__name').textContent = user.username;
        document.querySelector('.profile__email').textContent = user.email;
        
        // Update avatar with first letter of username
        const avatarPlaceholder = document.querySelector('.profile__avatar-placeholder');
        avatarPlaceholder.textContent = user.username.charAt(0).toUpperCase();
        
    } catch (error) {
        console.error('Error loading profile:', error);
        // Fallback to local storage user data
        const user = getCurrentUser();
        if (user) {
            document.querySelector('.profile__name').textContent = user.username;
            document.querySelector('.profile__email').textContent = user.email;
            document.querySelector('.profile__avatar-placeholder').textContent = user.username.charAt(0).toUpperCase();
        }
    }
}

// Setup tab functionality
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tabs__button');
    const tabPanels = document.querySelectorAll('.tabs__panel');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            // Update active states
            tabButtons.forEach(btn => btn.classList.remove('tabs__button--active'));
            button.classList.add('tabs__button--active');
            
            tabPanels.forEach(panel => {
                panel.classList.remove('tabs__panel--active');
                if (panel.id === `${targetTab}Tab`) {
                    panel.classList.add('tabs__panel--active');
                }
            });
        });
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeProfile);