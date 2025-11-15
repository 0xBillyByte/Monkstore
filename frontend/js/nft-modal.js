// NFT Modal Implementation - Custom from scratch

class NFTModal {
  constructor() {
    this.modalContainer = null;
    this.overlay = null;
    this.modal = null;
    this.currentNFT = null;
    this.isOpen = false;
    
    this.init();
  }
  
  init() {
    // Create modal structure on initialization
    this.createModalStructure();
    this.bindEvents();
  }
  
  createModalStructure() {
    // Create modal container
    this.modalContainer = document.createElement('div');
    this.modalContainer.className = 'monkey-modal-container';
    this.modalContainer.innerHTML = `
      <div class="monkey-modal-overlay"></div>
      <div class="monkey-modal">
        <div class="monkey-modal-header">
          <h2 class="monkey-modal-title"></h2>
          <button class="monkey-modal-close" aria-label="Close modal">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="monkey-modal-body">
          <div class="monkey-modal-image-section">
            <img class="monkey-modal-image" src="" alt="">
            <div class="monkey-modal-rarity"></div>
          </div>
          <div class="monkey-modal-info-section">
            <div class="monkey-modal-details">
              <h3>Details</h3>
              <p class="monkey-modal-description"></p>
              <div class="monkey-modal-price-info">
                <span class="monkey-modal-price-label">Price:</span>
                <span class="monkey-modal-price"></span>
              </div>
            </div>
            <div class="monkey-modal-traits">
              <div class="monkey-modal-traits-title">Traits:</div>
              <div class="monkey-modal-traits-list"></div>
            </div>
            <div class="monkey-modal-actions">
              <button class="monkey-modal-buy-btn">Buy Now</button>
              <button class="monkey-modal-favorite-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                Favorite
              </button>
              <button class="monkey-modal-share-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Get references to important elements
    this.overlay = this.modalContainer.querySelector('.monkey-modal-overlay');
    this.modal = this.modalContainer.querySelector('.monkey-modal');
    
    // Append to body
    document.body.appendChild(this.modalContainer);
  }
  
  bindEvents() {
    // Close button
    const closeBtn = this.modalContainer.querySelector('.monkey-modal-close');
    closeBtn.addEventListener('click', () => this.close());
    
    // Overlay click
    this.overlay.addEventListener('click', () => this.close());
    
    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
    
    // Action buttons
    const buyBtn = this.modalContainer.querySelector('.monkey-modal-buy-btn');
    const favoriteBtn = this.modalContainer.querySelector('.monkey-modal-favorite-btn');
    const shareBtn = this.modalContainer.querySelector('.monkey-modal-share-btn');
    
    buyBtn.addEventListener('click', () => this.handleBuy());
    favoriteBtn.addEventListener('click', () => this.handleFavorite());
    shareBtn.addEventListener('click', () => this.handleShare());
  }
  
  open(nftData) {
    if (!nftData) return;
    
    this.currentNFT = nftData;
    this.updateModalContent(nftData);
    
    // Show modal with animation
    this.modalContainer.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Force reflow for animation
    this.modalContainer.offsetHeight;
    
    requestAnimationFrame(() => {
      this.modalContainer.classList.add('monkey-modal-open');
      this.isOpen = true;
    });
  }
  
  close() {
    this.modalContainer.classList.remove('monkey-modal-open');
    
    // Wait for animation to complete
    setTimeout(() => {
      this.modalContainer.style.display = 'none';
      document.body.style.overflow = '';
      this.isOpen = false;
      this.currentNFT = null;
    }, 300);
  }
  
  updateModalContent(nft) {
    // Update title
    this.modalContainer.querySelector('.monkey-modal-title').textContent = nft.name || 'Monkey NFT';
    
    // Update image
    const img = this.modalContainer.querySelector('.monkey-modal-image');
    img.src = nft.image || '';
    img.alt = nft.name || 'Monkey NFT';
    
    // Update rarity
    const rarityElement = this.modalContainer.querySelector('.monkey-modal-rarity');
    rarityElement.textContent = nft.rarity || 'Common';
    rarityElement.className = `monkey-modal-rarity rarity-${(nft.rarity || 'common').toLowerCase()}`;
    
    // Update description
    this.modalContainer.querySelector('.monkey-modal-description').textContent = 
      nft.description || 'A unique monkey NFT from our exclusive collection.';
    
    // Update price
    this.modalContainer.querySelector('.monkey-modal-price').textContent = 
      nft.price ? `$${nft.price.toLocaleString()}` : 'Price not available';
    
    // Update traits - display exactly like shop cards
    const traits = nft.traits || {};
    const traitsArray = Object.values(traits);
    const traitsHTML = traitsArray.map(value => 
      `<span class="trait">${value}</span>`
    ).join('');
    
    this.modalContainer.querySelector('.monkey-modal-traits-list').innerHTML = traitsHTML;
  }
  
  async handleBuy() {
    if (!this.currentNFT) return;
    
    const btn = this.modalContainer.querySelector('.monkey-modal-buy-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Adding...';
    
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nftId: this.currentNFT.id })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        btn.textContent = 'Added!';
        // Update cart badge
        const cartBadge = document.getElementById('cartBadge');
        if (cartBadge) {
          const currentCount = parseInt(cartBadge.textContent) || 0;
          cartBadge.textContent = currentCount + 1;
        }
      } else {
        btn.textContent = 'Error';
      }
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
    } catch (error) {
      console.error('Error adding to cart:', error);
      btn.textContent = 'Error';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
    }
  }
  
  handleFavorite() {
    console.log('Favorite button clicked for:', this.currentNFT?.name);
    // Add your favorite functionality here
    const btn = this.modalContainer.querySelector('.monkey-modal-favorite-btn');
    btn.classList.toggle('favorited');
    alert('Favorite functionality will be implemented soon!');
  }
  
  handleShare() {
    if (this.currentNFT) {
      const shareUrl = `${window.location.origin}${window.location.pathname}#nft-${this.currentNFT.id}`;
      
      // Try to use native share API if available
      if (navigator.share) {
        navigator.share({
          title: this.currentNFT.name,
          text: `Check out this ${this.currentNFT.rarity} Monkey NFT!`,
          url: shareUrl
        }).catch(err => {
          // Fallback to copy to clipboard
          this.copyToClipboard(shareUrl);
        });
      } else {
        // Fallback to copy to clipboard
        this.copyToClipboard(shareUrl);
      }
    }
  }
  
  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy link');
    });
  }
}

// Initialize modal and attach to NFT cards
document.addEventListener('DOMContentLoaded', () => {
  const nftModal = new NFTModal();
  
  // Function to attach click handlers to NFT cards
  function attachNFTClickHandlers() {
    const nftCards = document.querySelectorAll('.nft-card');
    
    nftCards.forEach(card => {
      // Remove any existing click handlers to avoid duplicates
      card.style.cursor = 'pointer';
      
      card.addEventListener('click', async (e) => {
        // Don't open modal if clicking on buttons within the card
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
          return;
        }
        
        const nftId = card.dataset.nftId;
        if (!nftId) return;
        
        try {
          // Fetch NFT details from API
          const nftData = await fetchNFTById(nftId);
          nftModal.open(nftData);
        } catch (error) {
          console.error('Error loading NFT details:', error);
          alert('Failed to load NFT details. Please try again.');
        }
      });
    });
  }
  
  // Attach handlers to existing cards
  attachNFTClickHandlers();
  
  // Re-attach handlers when new cards are added (e.g., after filtering)
  const observer = new MutationObserver(() => {
    attachNFTClickHandlers();
  });
  
  const nftGrid = document.getElementById('nftGrid');
  if (nftGrid) {
    observer.observe(nftGrid, { childList: true, subtree: true });
  }
  
  // Make modal instance globally available if needed
  window.monkeyNFTModal = nftModal;

  window.openNFTModal = (id) => {
  fetchNFTById(id)
    .then(nft => window.monkeyNFTModal.open(nft))
    .catch(err => {
      console.error('Error loading NFT:', err);
      alert('Could not open NFT modal');
    });
};

});

// Helper function to fetch NFT by ID
async function fetchNFTById(id) {
  try {
    const response = await fetch(`/api/monkeys/${id}`);
    if (!response.ok) throw new Error('NFT not found');
    const nft = await response.json();
    
    // Add description if not present
    if (!nft.description) {
      nft.description = `This unique ${nft.rarity} Monkey NFT features distinctive traits that make it truly one-of-a-kind. Each monkey is procedurally generated with rare characteristics.`;
    }
    
    // Log the traits to verify they're being fetched correctly
    console.log(`NFT ${id} traits:`, nft.traits);
    
    return nft;
  } catch (error) {
    console.error('Error fetching NFT:', error);
    throw error;
  }
}