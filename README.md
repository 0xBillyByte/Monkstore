# Monkstore - The Place to buy Monkey NFTs

A modern, secure marketplace for trading unique Monkey NFTs with a beautiful dark-themed UI. Built with simplicity and performance in mind, Monkstore provides a seamless experience for discovering, collecting, and trading rare digital monkey collectibles.

## The Thoughts Behind It

Monkstore was created to demonstrate a clean, minimalist approach to building a full-stack NFT marketplace. The project emphasizes:

- **Zero-dependency backend**: Using only Node.js core modules for maximum simplicity and security
- **Performance first**: Lightweight architecture with direct PostgreSQL queries via `psql` command
- **Modern UX**: Sleek, dark-themed interface with smooth animations and responsive design
- **Security by design**: JWT authentication, SQL injection prevention, and proper input validation

The goal is to provide a practical example of a real-world NFT marketplace that balances simplicity with professional features, making it perfect for learning or as a foundation for more complex projects.

## Tech Stack

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

## Security Notes

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
