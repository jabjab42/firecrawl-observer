// Application configuration
export const APP_CONFIG = {
  // App name and branding
  name: 'Kabuki Observer',
  shortName: 'FC Observer',
  description: 'Monitor websites for changes with AI-powered analysis',

  // Domain configuration
  domain: 'example.com',

  // Email configuration
  email: {
    fromName: 'Kabuki Observer',
    fromAddress: 'noreply@example.com',
    defaultRecipient: 'alerts@example.com',
    placeholderEmail: 'you@example.com',
  },

  // URLs
  urls: {
    github: 'https://github.com/your-org/fc-observer',
    documentation: '/docs',
    api: '/api-docs',
  },

  // Feature flags
  features: {
    aiAnalysis: true,
    webhooks: true,
    emailNotifications: true,
  },

  // Default values
  defaults: {
    checkInterval: 60, // minutes
    aiModel: 'gpt-4o-mini',
    aiThreshold: 70,
  },
} as const

// Helper functions
export function getFromEmail(): string {
  return `${APP_CONFIG.email.fromName} <${APP_CONFIG.email.fromAddress}>`
}

export function getAppUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    'http://localhost:3000'
  return baseUrl.replace(/\/$/, '') // Remove trailing slash
}