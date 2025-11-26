# Kabuki Observer Architecture

## System Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Next.js App   │────▶│   Convex DB     │◀────│  Scheduled      │
│   (Frontend)    │     │   (Backend)     │     │  Functions      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│     Resend      │     │   Firecrawl     │     │    OpenAI/      │
│  (Email API)    │     │  (Scraping)     │     │    AI APIs      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Data Flow

1. **User adds website** → Stored in Convex DB
2. **Scheduled check runs** → Calls Firecrawl API
3. **Firecrawl scrapes** → Returns page content
4. **Change detected** → Compares with previous version
5. **AI Analysis** (optional) → Determines if meaningful
6. **Notifications sent** → Email via Resend / Webhook

## Key Components

### Frontend (Next.js)
- `/` - Dashboard with website list
- `/settings` - User configuration
- `/api/*` - REST API endpoints

### Backend (Convex)
- **Tables**:
  - `users` - User accounts
  - `websites` - Monitored websites
  - `scrapeResults` - Change history
  - `userSettings` - User preferences
  - `emailConfig` - Email settings

- **Functions**:
  - `websites.ts` - CRUD operations
  - `firecrawl.ts` - Scraping logic
  - `notifications.ts` - Alert handling
  - `aiAnalysis.ts` - AI integration

### External Services
- **Firecrawl**: Web scraping
- **Resend**: Email delivery
- **OpenAI/Groq/etc**: AI analysis

## Security

- API keys encrypted with AES-256-GCM
- JWT authentication
- Environment-based configuration
- Sanitized HTML in emails