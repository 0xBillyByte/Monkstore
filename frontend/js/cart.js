// Cart functionality for Monkey Marketplace

import { getCart, removeFromCart } from './api.js';

// Initialize cart page
export async function initializeCart() {
  await loadCartItems();
  setupEventListeners();
}

// Load and display cart items
async function loadCartItems() {
  const cartContent = document.getElementById('cartContent');
  const cartSummary = document.getElementById('cartSummary');
  
  try {
    // Show loading state
    cartContent.innerHTML = '<div class="loading">Loading cart...</div>';
    
    // Fetch cart items
    const cartItems = await getCart();
    
    if (cartItems.length === 0) {
      // Show empty cart
      cartContent.innerHTML = `
        <div class="cart__empty">
          <p>Your cart is empty</p>
          <a href="shop.html" class="btn btn--primary">Browse Collection</a>
        </div>
      `;
      cartSummary.style.display = 'none';
    } else {
      // Display cart items
      displayCartItems(cartItems);
      updateCartSummary(cartItems);
      cartSummary.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading cart:', error);
    cartContent.innerHTML = `
      <div class="cart__error">
        <p>Error loading cart. Please try again.</p>
        <button class="btn btn--primary" onclick="location.reload()">Reload</button>
      </div>
    `;
  }
}

// Display cart items
function displayCartItems(items) {
  const cartContent = document.getElementById('cartContent');
  
  const itemsHTML = items.map(item => `
    <div class="cart-item" data-item-id="${item.id}">
      <div class="cart-item__image">
        <img src="${item.image}" alt="${item.name}" loading="lazy">
      </div>
      <div class="cart-item__details">
        <h3 class="cart-item__name">${item.name}</h3>
        <p class="cart-item__info">Monkey NFT #${item.id.replace('monk-', '')}</p>
      </div>
      <div class="cart-item__quantity">
        <label class="cart-item__quantity-label">Quantity:</label>
        <div class="cart-item__quantity-controls">
          <button class="quantity-btn quantity-btn--decrease" data-id="${item.id}" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
          <span class="quantity-value">${item.quantity}</span>
          <button class="quantity-btn quantity-btn--increase" data-id="${item.id}">+</button>
        </div>
      </div>
      <div class="cart-item__price">
        <p class="cart-item__unit-price">$${item.price.toLocaleString()}</p>
        <p class="cart-item__total-price">Total: $${(item.price * item.quantity).toLocaleString()}</p>
      </div>
      <button class="cart-item__remove" data-id="${item.id}" aria-label="Remove from cart">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `).join('');
  
  cartContent.innerHTML = `
    <div class="cart-items">
      ${itemsHTML}
    </div>
  `;
  
  // Add event listeners to quantity buttons and remove buttons
  setupItemEventListeners();
}

// Update cart summary
function updateCartSummary(items) {
  const cartTotal = document.getElementById('cartTotal');
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  cartTotal.textContent = `$${total.toLocaleString()}`;
}

// Setup event listeners
function setupEventListeners() {
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', handleCheckout);
  }
}

// Setup item-specific event listeners
function setupItemEventListeners() {
  // Remove buttons
  document.querySelectorAll('.cart-item__remove').forEach(btn => {
    btn.addEventListener('click', handleRemoveItem);
  });
  
  // Quantity buttons
  document.querySelectorAll('.quantity-btn--decrease').forEach(btn => {
    btn.addEventListener('click', handleDecreaseQuantity);
  });
  
  document.querySelectorAll('.quantity-btn--increase').forEach(btn => {
    btn.addEventListener('click', handleIncreaseQuantity);
  });
}

// Handle remove item
async function handleRemoveItem(e) {
  const itemId = e.currentTarget.dataset.id;
  const cartItem = e.currentTarget.closest('.cart-item');
  
  // Add removing state
  cartItem.classList.add('cart-item--removing');
  
  try {
    await removeFromCart(itemId);
    
    // Update cart badge
    const cartBadge = document.getElementById('cartBadge');
    if (cartBadge) {
      const currentCount = parseInt(cartBadge.textContent) || 0;
      cartBadge.textContent = Math.max(0, currentCount - 1);
    }
    
    // Reload cart items
    await loadCartItems();
  } catch (error) {
    console.error('Error removing item:', error);
    cartItem.classList.remove('cart-item--removing');
    alert('Failed to remove item. Please try again.');
  }
}

// Handle decrease quantity
async function handleDecreaseQuantity(e) {
  const itemId = e.currentTarget.dataset.id;
  const cartItem = e.currentTarget.closest('.cart-item');
  const quantitySpan = cartItem.querySelector('.quantity-value');
  const currentQuantity = parseInt(quantitySpan.textContent);
  
  if (currentQuantity <= 1) return;
  
  // For now, we'll remove the item if quantity goes to 0
  // In a real implementation, you'd update the quantity on the server
  if (currentQuantity === 2) {
    await handleRemoveItem({ currentTarget: cartItem.querySelector('.cart-item__remove') });
  }
}

// Handle increase quantity
async function handleIncreaseQuantity(e) {
  const itemId = e.currentTarget.dataset.id;
  
  try {
    // Add the same item again (this will increment quantity on backend)
    const response = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: itemId })
    });
    
    if (response.ok) {
      // Don't update cart badge here since we're just increasing quantity
      // Reload cart items
      await loadCartItems();
    } else {
      const error = await response.json();
      console.error('Cart error:', error);
      throw new Error('Failed to update quantity');
    }
  } catch (error) {
    console.error('Error updating quantity:', error);
    alert('Failed to update quantity. Please try again.');
  }
}

// Handle checkout
async function handleCheckout() {
  const checkoutBtn = document.getElementById('checkoutBtn');
  
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = 'Processing...';
  
  try {
    // Get current cart items
    const cartItems = await getCart();
    
    if (cartItems.length === 0) {
      alert('Your cart is empty!');
      return;
    }
    
    // Calculate total
    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Show confirmation
    const confirmed = confirm(`Total: $${total.toLocaleString()}\n\nProceed with checkout?`);
    
    if (confirmed) {
      // In a real implementation, this would process payment
      alert('🎉 Order placed successfully!\n\nThank you for your purchase!');
      
      // Clear the cart (in a real app, this would be done after successful payment)
      for (const item of cartItems) {
        await removeFromCart(item.id);
      }
      
      // Redirect to shop
      window.location.href = 'shop.html';
    }
  } catch (error) {
    console.error('Error during checkout:', error);
    alert('Checkout failed. Please try again.');
  } finally {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = 'Proceed to Checkout';
  }
}

// Export for use in main.js
window.initializeCart = initializeCart;