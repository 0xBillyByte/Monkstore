# Monkstore - The Place to buy Monkey NFTs

A modern, secure marketplace for trading unique Monkey NFTs with a beautiful dark-themed UI. Built with simplicity and performance in mind, Monkstore provides a seamless experience for discovering, collecting, and trading rare digital monkey collectibles.

## 💭 The Thoughts Behind It

Monkstore was created to demonstrate a clean, minimalist approach to building a full-stack NFT marketplace. The project emphasizes:

- **Zero-dependency backend**: Using only Node.js core modules for maximum simplicity and security
- **Performance first**: Lightweight architecture with direct PostgreSQL queries via `psql` command
- **Modern UX**: Sleek, dark-themed interface with smooth animations and responsive design
- **Security by design**: JWT authentication, SQL injection prevention, and proper input validation
- **Containerized deployment**: Docker-ready with separate frontend and backend services

The goal is to provide a practical example of a real-world NFT marketplace that balances simplicity with professional features, making it perfect for learning or as a foundation for more complex projects.

## ✨ Features

### 🛍️ NFT Marketplace
- **Browse Collection**: Explore a diverse collection of unique Monkey NFTs with various traits
- **Advanced Filtering**: Search by name, filter by rarity (Common, Rare, Epic, Legendary, Mythic), and set maximum price
- **Smart Sorting**: Sort NFTs by price (ascending/descending) or rarity level
- **Detailed View**: View individual NFTs with full trait information (background, fur, headgear, props)

### 👤 User Management
- **User Registration**: Create an account with username, email, and secure password
- **Authentication**: JWT-based authentication system with 7-day token expiration
- **User Profiles**: View and manage personal profile information
- **Secure Sessions**: Token-based authentication with proper authorization checks

### 🛒 Shopping Cart
- **Add to Cart**: Add multiple NFTs to your shopping cart
- **Quantity Management**: Automatically handles quantity updates for duplicate items
- **Cart Overview**: View all items in cart with pricing and images
- **Authenticated Access**: Cart functionality requires user login for security

### 🎨 UI/UX Features
- **Dark Theme**: Modern, eye-friendly dark interface with purple accent colors
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Modal Views**: Interactive NFT detail modals with smooth animations
- **Real-time Updates**: Dynamic cart badge showing item count
- **Smooth Transitions**: CSS animations for enhanced user experience

## 🛠️ Tech Stack

### Frontend
- **HTML5**: Semantic markup with proper accessibility
- **CSS3**: Custom styling with CSS variables, flexbox, and grid layouts
- **Vanilla JavaScript**: Modular ES6+ JavaScript for client-side logic
- **Nginx**: High-performance web server for static file serving

### Backend
- **Node.js 20**: Runtime environment using only core modules (http, url, child_process, crypto)
- **No npm dependencies**: Zero external dependencies for maximum simplicity
- **PostgreSQL**: Relational database for data persistence
- **JWT Authentication**: Custom JWT implementation using Node.js crypto module

### DevOps
- **Docker**: Containerized services for easy deployment
- **Docker Compose**: Multi-container orchestration (frontend, backend, database)
- **Alpine Linux**: Minimal base images for reduced footprint

### Security Features
- **Password Hashing**: SHA-256 hashing with secret salt
- **JWT Tokens**: Custom JWT implementation with HMAC-SHA256 signatures
- **SQL Injection Prevention**: Parameterized queries with proper escaping
- **CORS Configuration**: Configurable cross-origin resource sharing
- **Input Validation**: Request validation and sanitization

## 📡 API Endpoints

### Health Check
```
GET /health
```
Returns server health status.

### Authentication

```
POST /api/register
Body: { "username": "string", "email": "string", "password": "string" }
Response: { "user": {...}, "token": "jwt_token" }
```
Register a new user account.

```
POST /api/login
Body: { "username": "string", "password": "string" }
Response: { "user": {...}, "token": "jwt_token" }
```
Authenticate and receive JWT token.

```
GET /api/profile
Headers: Authorization: Bearer <token>
Response: { "user": {...} }
```
Get current user profile information.

### NFT Operations

```
GET /api/monkeys
Query Params: 
  - search: string (search by name)
  - rarity: string (Common|Rare|Epic|Legendary|Mythic)
  - maxPrice: number
  - sortBy: string (price-asc|price-desc|rarity-asc|rarity-desc)
Response: Array of monkey NFTs with traits
```
List all monkey NFTs with optional filtering and sorting.

```
GET /api/monkeys/:id
Params: id (format: monk-XXX)
Response: Single monkey NFT with full details
```
Get details of a specific monkey NFT.

### Shopping Cart

```
GET /api/cart
Headers: Authorization: Bearer <token>
Response: Array of cart items with quantities
```
Get current user's shopping cart.

```
POST /api/cart
Headers: Authorization: Bearer <token>
Body: { "nftId": "monk-XXX" }
Response: { "ok": true }
```
Add NFT to shopping cart (increments quantity if already exists).

```
DELETE /api/cart/:id
Headers: Authorization: Bearer <token>
Params: id (format: monk-XXX)
Response: 204 No Content
```
Remove NFT from shopping cart.

## 🚀 Setup & Installation

### Prerequisites
- Docker and Docker Compose installed
- PostgreSQL 15+ (if running locally)
- Node.js 20+ (if running locally without Docker)

### Environment Variables

Create a `.env` file or set the following environment variables:

```bash
# Backend
PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/dbname
FRONTEND_ORIGIN=http://localhost:80
JWT_SECRET=your-secret-key-here

# Database
POSTGRES_USER=monkstore
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=monkstore
```

### Running with Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Running Locally

**Backend:**
```bash
cd backend
export DATABASE_URL="postgresql://user:pass@localhost:5432/monkstore"
export JWT_SECRET="your-secret"
node server.js
```

**Frontend:**
```bash
cd frontend
# Serve with any static file server
python3 -m http.server 8080
# or
npx serve .
```

## 📁 Project Structure

```
Monkstore/
├── backend/
│   ├── Dockerfile           # Backend container configuration
│   └── server.js           # Main Node.js server with all API endpoints
├── frontend/
│   ├── assets/             # Images and static assets
│   ├── css/
│   │   ├── style.css       # Main styles
│   │   ├── cart-styles.css # Shopping cart styles
│   │   └── nft-modal.css   # NFT detail modal styles
│   ├── js/
│   │   ├── api.js          # API client wrapper
│   │   ├── auth-ui.js      # Authentication UI logic
│   │   ├── cart.js         # Shopping cart functionality
│   │   ├── main.js         # Main application logic
│   │   ├── nft-modal.js    # NFT detail modal
│   │   └── profile.js      # User profile logic
│   ├── index.html          # Landing page
│   ├── shop.html           # NFT marketplace page
│   ├── cart.html           # Shopping cart page
│   ├── profile.html        # User profile page
│   ├── login.html          # Login/Register page
│   └── dockerfile          # Frontend container configuration
├── .gitignore
└── README.md
```

## 🎯 Usage

1. **Access the Application**: Navigate to `http://localhost` (or your configured domain)
2. **Create an Account**: Click "Login" and then "Register" to create a new account
3. **Browse NFTs**: Visit the "Shop" page to explore the monkey NFT collection
4. **Filter & Sort**: Use the search bar and filters to find specific NFTs
5. **Add to Cart**: Click on NFTs to view details and add them to your cart
6. **View Cart**: Check your cart to see selected items and total price
7. **Profile**: Visit your profile page to view account information

## 🔒 Security Notes

- Never commit the `.env` file or expose sensitive credentials
- Use strong, unique values for `JWT_SECRET` in production
- Ensure PostgreSQL is not exposed to public internet
- Use HTTPS in production environments
- Regularly update dependencies and base Docker images

## 🤝 Contributing

This project is a demonstration/learning project. Feel free to fork and modify for your own purposes.

## 📄 License

This project is open source and available for educational purposes.

---

**Built with ❤️ and 🐒 by the Monkstore team**
