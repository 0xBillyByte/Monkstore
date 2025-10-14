// Main JavaScript file for Monkey Marketplace
// Handles page initialization and shared functionality
import { fetchNFTs, getCart, addToCart, removeFromCart } from './api.js';

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

// Main app initialization
function initializeApp() {
  updateCartBadge();
  
  // Initialize page-specific functionality
  const currentPage = getCurrentPage();
  
  switch (currentPage) {
    case 'shop':
      initializeShop();
      break;
    case 'cart':
      initializeCart();
      break;
    case 'profile':
      initializeProfile();
      break;
    default:
      // Home page or other pages
      break;
  }
}

// Get current page based on URL
function getCurrentPage() {
  const path = window.location.pathname;
  if (path.includes('shop.html')) return 'shop';
  if (path.includes('cart.html')) return 'cart';
  if (path.includes('profile.html')) return 'profile';
  return 'home';
}

// Update cart badge with current item count
async function updateCartBadge() {
  try {
    const cart = await getCart();
    const cartBadge = document.getElementById('cartBadge');
    if (cartBadge) {
      cartBadge.textContent = cart.length;
    }
  } catch (error) {
    console.error('Error updating cart badge:', error);
  }
}

async function initNFTDetail(nftId) {
  const res = await fetch(`/api/monkeys/${nftId}`);
  if (!res.ok) throw new Error('NFT not found');
  return res.json();
}

// Shop page functionality
function initializeShop() {
  const searchInput = document.getElementById('searchInput');
  const rarityFilter = document.getElementById('rarityFilter');
  const priceRange = document.getElementById('priceRange');
  const priceValue = document.getElementById('priceValue');
  const sortBy = document.getElementById('sortBy');
  const nftGrid = document.getElementById('nftGrid');
  const nftCount = document.getElementById('nftCount');
  
  // Update price display
  function updatePriceDisplay() {
    const value = priceRange.value;
    priceValue.textContent = `0-${value}`;
  }
  
  // Load and display NFTs
  async function loadNFTs() {
    try {
      const filters = {
        search: searchInput.value,
        rarity: rarityFilter.value,
        maxPrice: parseInt(priceRange.value),
        sortBy: sortBy.value
      };
      
      const nfts = await fetchNFTs(filters);
      displayNFTs(nfts);
      
      if (nftCount) {
        nftCount.textContent = `${nfts.length} NFTs found`;
      }
    } catch (error) {
      console.error('Error loading NFTs:', error);
      if (nftGrid) {
        nftGrid.innerHTML = '<div class="loading">Error loading NFTs</div>';
      }
    }
  }
  
  // Display NFTs in grid
  function displayNFTs(nfts) {
    if (!nftGrid) return;
    
    if (nfts.length === 0) {
      nftGrid.innerHTML = '<div class="loading">No NFTs found matching your criteria</div>';
      return;
    }
    
    nftGrid.innerHTML = nfts.map(nft => createNFTCard(nft)).join('');
    
    // The new nft-modal.js automatically handles NFT card clicks
    // No need to add click handlers here
    
    // Add click handlers for add to cart buttons
    nftGrid.querySelectorAll('.nft-card__add-btn').forEach(btn => {
      btn.addEventListener('click', handleAddToCart);
    });
  }
  
  // Create NFT card HTML
  function createNFTCard(nft) {
    const rarityClass = nft.rarity.toLowerCase();
    const traits = Object.entries(nft.traits).map(([key, value]) => 
      `<span class="trait">${value}</span>`
    ).join('');
    
    return `
      <div class="nft-card" data-nft-id="${nft.id}">
        <div class="nft-card__image">
          <img src="${nft.image}" alt="${nft.name}" loading="lazy" width="250" height="250">
        </div>
        <div class="nft-card__content">
          <div class="nft-card__header">
            <h3 class="nft-card__name">${nft.name}</h3>
            <span class="rarity-badge rarity-badge--${rarityClass}">${nft.rarity}</span>
          </div>
          <div class="nft-card__traits">
            <div class="nft-card__traits-title">Traits:</div>
            <div class="traits-list">${traits}</div>
          </div>
          <div class="nft-card__footer">
            <span class="nft-card__price">$${nft.price.toLocaleString()}</span>
            <button class="btn btn--primary nft-card__add-btn" data-nft-id="${nft.id}">
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  // Handle add to cart
  async function handleAddToCart(event) {
    event.stopPropagation(); // Prevent opening modal
    const button = event.target;
    const nftId = button.dataset.nftId;
    
    if (!nftId) return;
    
    button.disabled = true;
    button.textContent = 'Adding...';
    
    try {
      const { existed } = await addToCart(nftId);
      if (existed) { /* Already in cart */ } else { /* Added */ }
    } catch (error) {
      console.error('Error adding to cart:', error);
      button.textContent = 'Error';
      setTimeout(() => {
        button.textContent = 'Add to Cart';
        button.disabled = false;
      }, 1500);
    }
  }
  
  // Event listeners
  if (searchInput) {
    searchInput.addEventListener('input', debounce(loadNFTs, 300));
  }
  
  if (rarityFilter) {
    rarityFilter.addEventListener('change', loadNFTs);
  }
  
  if (priceRange) {
    priceRange.addEventListener('input', () => {
      updatePriceDisplay();
      debounce(loadNFTs, 300)();
    });
    updatePriceDisplay();
  }
  
  if (sortBy) {
    sortBy.addEventListener('change', loadNFTs);
  }
  
  // Initial load
  loadNFTs();

// Öffne Modal, wenn ein Hash wie #nft-xyz vorhanden ist (z. B. Direktlink)
const hash = window.location.hash;
if (hash && hash.startsWith('#nft-')) {
  const nftId = hash.replace('#nft-', '');
  openNFTModal(nftId);
}


}

// Cart page functionality
function initializeCart() {
  const cartContent = document.getElementById('cartContent');
  const cartSummary = document.getElementById('cartSummary');
  const cartTotal = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('checkoutBtn');
  
  // Load and display cart
  async function loadCart() {
    try {
      const cart = await getCart();
      displayCart(cart);
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  }
  
  // Display cart items
  function displayCart(cart) {
    if (!cartContent) return;
    
    if (cart.length === 0) {
      cartContent.innerHTML = `
        <div class="cart__empty">
          <p>Your cart is empty</p>
          <a href="shop.html" class="btn btn--primary">Browse Collection</a>
        </div>
      `;
      if (cartSummary) cartSummary.style.display = 'none';
      return;
    }
    
    const cartHTML = cart.map(nft => `
      <div class="cart-item">
        <div class="cart-item__image">
          <img src="${nft.image}" alt="${nft.name}" width="80" height="80">
        </div>
        <div class="cart-item__info">
          <h3 class="cart-item__name">${nft.name}</h3>
          <p class="cart-item__price">$${nft.price.toLocaleString()}</p>
        </div>
        <button class="cart-item__remove" data-nft-id="${nft.id}">Remove</button>
      </div>
    `).join('');
    
    cartContent.innerHTML = cartHTML;
    
    // Add remove button handlers
    cartContent.querySelectorAll('.cart-item__remove').forEach(btn => {
      btn.addEventListener('click', handleRemoveFromCart);
    });
    
    // Update summary
    const total = cart.reduce((sum, nft) => sum + nft.price, 0);
    if (cartTotal) cartTotal.textContent = `$${total.toLocaleString()}`;
    if (cartSummary) cartSummary.style.display = 'block';
  }
  
  // Handle remove from cart
  async function handleRemoveFromCart(event) {
    const button = event.target;
    const nftId = button.dataset.nftId;
    
    if (!nftId) return;
    
    try {
      await removeFromCart(nftId);
      loadCart();
      updateCartBadge();
    } catch (error) {
      console.error('Error removing from cart:', error);
    }
  }
  
  // Handle checkout
  function handleCheckout() {
    // TODO: Implement real checkout with backend
    alert('Checkout functionality will be implemented with the backend integration!');
  }
  
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', handleCheckout);
  }
  
  // Initial load
  loadCart();
}

// Profile page functionality
function initializeProfile() {
  const tabButtons = document.querySelectorAll('.tabs__button');
  const tabPanels = document.querySelectorAll('.tabs__panel');
  const ownedNFTGrid = document.getElementById('ownedNFTGrid');
  
  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.dataset.tab;
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('tabs__button--active'));
      button.classList.add('tabs__button--active');
      
      // Update active tab panel
      tabPanels.forEach(panel => panel.classList.remove('tabs__panel--active'));
      document.getElementById(`${tabId}Tab`).classList.add('tabs__panel--active');
      
      // Load tab content
      if (tabId === 'owned') {
        loadOwnedNFTs();
      }
    });
  });
  
  // Load owned NFTs (from cart for demo purposes)
  async function loadOwnedNFTs() {
    if (!ownedNFTGrid) return;
    
    try {
      const cart = await getCart();
      
      if (cart.length === 0) {
        ownedNFTGrid.innerHTML = `
          <div class="empty-state">
            <p>No NFTs owned yet</p>
            <a href="shop.html" class="btn btn--primary">Start Collecting</a>
          </div>
        `;
        return;
      }
      
      const nftsHTML = cart.map(nft => createNFTCard(nft)).join('');
      ownedNFTGrid.innerHTML = nftsHTML;
    } catch (error) {
      console.error('Error loading owned NFTs:', error);
      ownedNFTGrid.innerHTML = '<div class="empty-state"><p>Error loading NFTs</p></div>';
    }
  }
  
  // Create NFT card for profile (without add to cart button)
  function createNFTCard(nft) {
    const rarityClass = nft.rarity.toLowerCase();
    const traits = Object.entries(nft.traits).map(([key, value]) => 
      `<span class="trait">${value}</span>`
    ).join('');
    
    return `
      <div class="nft-card">
        <div class="nft-card__image">
          <img src="${nft.image}" alt="${nft.name}" loading="lazy" width="250" height="250">
        </div>
        <div class="nft-card__content">
          <div class="nft-card__header">
            <h3 class="nft-card__name">${nft.name}</h3>
            <span class="rarity-badge rarity-badge--${rarityClass}">${nft.rarity}</span>
          </div>
          <div class="nft-card__traits">
            <div class="nft-card__traits-title">Traits:</div>
            <div class="traits-list">${traits}</div>
          </div>
          <div class="nft-card__footer">
            <span class="nft-card__price">$${nft.price.toLocaleString()}</span>
          </div>
        </div>
      </div>
    `;
  }
  
  // Initial load
  loadOwnedNFTs();
}

// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Make modal functions globally accessible
window.openNFTModal = openNFTModal;
window.closeNFTModal = closeNFTModal;
window.handleModalAddToCart = handleModalAddToCart;

window.addEventListener('hashchange', () => {
  const hash = window.location.hash;
  if (hash.startsWith('#nft-')) {
    const nftId = hash.replace('#nft-', '');
    openNFTModal(nftId);
  } else {
    // Wenn Modal offen und Hash gelöscht wurde → Modal schließen
    const modal = document.getElementById('nftModal');
    if (modal) {
      closeNFTModal();
    }
  }
});
