# Gaming News API

A RESTful API service that provides gaming news and reviews from IGN.

## Features

- Latest gaming news from IGN RSS feeds
- Top rated games with reviews
- Search functionality for news articles
- Caching system to minimize API calls
- Rate limiting for API protection
- Swagger documentation
- Error handling and logging
- Input validation

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Update the environment variables in `.env`

## Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Documentation

Access the Swagger documentation at:
```
http://localhost:3000/api-docs
```

## API Endpoints

- `GET /api/news/latest` - Get latest gaming news
- `GET /api/news/search?q={query}` - Search news articles
- `GET /api/games/top` - Get top rated games
- `GET /api/games/:id` - Get specific game details

## Features

### Caching
- In-memory caching system
- Configurable cache duration
- Automatic cache invalidation

### Rate Limiting
- Configurable request limits
- Time window based limiting
- Protection against abuse

### Error Handling
- Centralized error handling
- Detailed error logging
- Consistent error responses

### Input Validation
- Request parameter validation
- Query string validation
- Path parameter validation

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS` - Maximum requests per window
- `CACHE_DURATION_MS` - Cache duration in milliseconds
- `IGN_NEWS_FEED_URL` - IGN news RSS feed URL
- `IGN_REVIEWS_FEED_URL` - IGN reviews RSS feed URL