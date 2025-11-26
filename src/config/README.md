# Application Configuration

This directory contains the centralized configuration for the Kabuki Observer application.

## Configuration Files

### `app.config.ts`
Main application configuration including:
- App name and branding
- Domain configuration
- Email settings
- Default values
- Feature flags

## Usage

### In React Components
```typescript
import { APP_CONFIG, getFromEmail } from '@/config/app.config'

// Use configuration values
<Input placeholder={APP_CONFIG.email.placeholderEmail} />
<p>From: {getFromEmail()}</p>
```

### In Convex Functions
For Convex functions, use environment variables:

```typescript
// Set these environment variables in Convex:
// APP_NAME="Kabuki Observer"
// FROM_EMAIL="noreply@example.com"

const fromEmail = `${process.env.APP_NAME} <${process.env.FROM_EMAIL}>`
```

## Environment Variables

To update configuration in Convex:
```bash
npx convex env set APP_NAME "Your App Name"
npx convex env set FROM_EMAIL "noreply@yourdomain.com"
```

## Customization

To customize for your own deployment:

1. Update `app.config.ts` with your values:
   - Change `domain` to your domain
   - Update `email` settings
   - Modify `urls` as needed

2. Set corresponding environment variables in Convex

3. Update any remaining hardcoded values by searching for the old domain/email addresses