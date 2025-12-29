'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Mail, Copy, Check, Network, FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

interface WebhookConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: {
    notificationPreference: 'none' | 'email' | 'webhook' | 'both'
    webhookUrl?: string
    checkInterval?: number
    monitorType?: 'single_page' | 'full_site'
    crawlLimit?: number
    crawlDepth?: number
    deepAnalysisEnabled?: boolean
    headers?: string
    checkNow?: boolean
  }) => void
  initialConfig?: {
    notificationPreference: 'none' | 'email' | 'webhook' | 'both'
    webhookUrl?: string
    checkInterval?: number
    monitorType?: 'single_page' | 'full_site'
    crawlLimit?: number
    crawlDepth?: number
    deepAnalysisEnabled?: boolean
    headers?: string
  }
  websiteName: string
}

export function WebhookConfigModal({ isOpen, onClose, onSave, initialConfig, websiteName }: WebhookConfigModalProps) {
  const [notificationPreference, setNotificationPreference] = useState(initialConfig?.notificationPreference || 'none')
  const [webhookUrl, setWebhookUrl] = useState(initialConfig?.webhookUrl || '')
  const [checkInterval, setCheckInterval] = useState(String(initialConfig?.checkInterval || 60))
  const [monitorType, setMonitorType] = useState(initialConfig?.monitorType || 'single_page')
  const [crawlLimit, setCrawlLimit] = useState(String(initialConfig?.crawlLimit || 5))
  const [crawlDepth, setCrawlDepth] = useState(String(initialConfig?.crawlDepth || 3))
  // Default deepAnalysisEnabled to true if not provided (i.e. for new websites)
  const [deepAnalysisEnabled, setDeepAnalysisEnabled] = useState(initialConfig?.deepAnalysisEnabled ?? true)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Parse initial headers to get cookie string
  const getInitialCookie = () => {
    if (!initialConfig?.headers) return ''
    try {
      const parsed = JSON.parse(initialConfig.headers)
      return parsed.Cookie || ''
    } catch {
      return ''
    }
  }
  const [cookieString, setCookieString] = useState(getInitialCookie())
  const [copied, setCopied] = useState(false)
  const [checkNow, setCheckNow] = useState(true) // Default to true for new websites

  const handleSave = useCallback(() => {
    onSave({
      notificationPreference: notificationPreference as 'none' | 'email' | 'webhook' | 'both',
      webhookUrl: (notificationPreference === 'webhook' || notificationPreference === 'both') ? webhookUrl : undefined,
      checkInterval: parseInt(checkInterval),
      monitorType: monitorType as 'single_page' | 'full_site',
      crawlLimit: monitorType === 'full_site' ? parseInt(crawlLimit) : undefined,
      crawlDepth: monitorType === 'full_site' ? parseInt(crawlDepth) : undefined,
      deepAnalysisEnabled: deepAnalysisEnabled,
      headers: cookieString ? JSON.stringify({ "Cookie": cookieString }) : undefined,
      checkNow: checkNow
    })
  }, [notificationPreference, webhookUrl, checkInterval, monitorType, crawlLimit, crawlDepth, deepAnalysisEnabled, cookieString, checkNow, onSave])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        // Cmd/Ctrl + Enter to submit
        handleSave()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, handleSave])

  if (!isOpen) return null

  const copyPayloadExample = () => {
    const payload = JSON.stringify({
      event: "website_changed",
      website: {
        name: websiteName,
        url: "https://example.com",
        checkInterval: 60
      },
      change: {
        detectedAt: new Date().toISOString(),
        changeType: "content_modified",
        summary: "Page content has changed",
        diff: {
          added: ["New paragraph added", "Updated heading"],
          removed: ["Old footer text"]
        }
      },
      scrapeResult: {
        title: "Example Website",
        description: "Website description",
        markdown: "# Page Content\\n\\nThis is the scraped content..."
      }
    }, null, 2)

    navigator.clipboard.writeText(payload)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Website Settings</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="w-8 h-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="space-y-6">
            {/* Monitoring Configuration */}
            <div className="border-b pb-6">
              <h3 className="text-lg font-medium mb-4">Monitoring Configuration</h3>

              {/* Check Interval */}
              <div className="mb-4">
                <Label htmlFor="check-interval">Check Interval</Label>
                <Select
                  id="check-interval"
                  value={checkInterval}
                  onChange={(e) => setCheckInterval(e.target.value)}
                  className="w-full mt-1"
                >
                  <option value="0.25">15 seconds (Testing only)</option>
                  <option value="5">5 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="180">3 hours</option>
                  <option value="360">6 hours</option>
                  <option value="720">12 hours</option>
                  <option value="1440">24 hours</option>
                  <option value="4320">3 days</option>
                  <option value="10080">7 days</option>
                </Select>
              </div>

              {/* Check Now Option - Only show for new websites */}
              {!initialConfig && (
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkNow}
                      onChange={(e) => setCheckNow(e.target.checked)}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium">
                      Check immediately after adding
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Perform an initial check right after adding this website
                  </p>
                </div>
              )}

              {/* Advanced Options Toggle */}
              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  {showAdvanced ? (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2" />
                  )}
                  Advanced Options
                </button>
              </div>

              {/* Advanced Options Content */}
              {showAdvanced && (
                <div className="space-y-6 pt-4 pl-2 border-l-2 border-gray-100 ml-2">
                  {/* Monitor Type */}
                  <div className="mb-4">
                    <Label htmlFor="monitor-type">Monitor Type</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setMonitorType('single_page')}
                        className={`p-3 rounded-lg border-2 transition-all ${monitorType === 'single_page'
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <FileText className={`h-5 w-5 mx-auto mb-1 ${monitorType === 'single_page' ? 'text-orange-600' : 'text-gray-500'
                          }`} />
                        <span className={`text-sm font-medium ${monitorType === 'single_page' ? 'text-orange-900' : 'text-gray-700'
                          }`}>Single Page</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMonitorType('full_site')}
                        className={`p-3 rounded-lg border-2 transition-all ${monitorType === 'full_site'
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <Network className={`h-5 w-5 mx-auto mb-1 ${monitorType === 'full_site' ? 'text-orange-600' : 'text-gray-500'
                          }`} />
                        <span className={`text-sm font-medium ${monitorType === 'full_site' ? 'text-orange-900' : 'text-gray-700'
                          }`}>Full Site</span>
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {monitorType === 'single_page'
                        ? 'Monitor changes on a specific page URL'
                        : 'Crawl and monitor multiple pages across the entire website'}
                    </p>
                  </div>

                  {/* Crawl Configuration */}
                  {monitorType === 'full_site' && (
                    <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <Label htmlFor="crawl-limit">Maximum Pages to Crawl</Label>
                        <Input
                          id="crawl-limit"
                          type="number"
                          min="1"
                          max="1000"
                          value={crawlLimit}
                          onChange={(e) => setCrawlLimit(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                          className="mt-1"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Limit the number of pages to crawl (default: 5)
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="crawl-depth">Maximum Crawl Depth</Label>
                        <Input
                          id="crawl-depth"
                          type="number"
                          min="1"
                          max="10"
                          value={crawlDepth}
                          onChange={(e) => setCrawlDepth(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                          className="mt-1"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          How many levels deep to crawl from the starting page (default: 3)
                        </p>
                      </div>
                    </div>
                  )}


                  {/* Deep Analysis Configuration */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center h-5">
                        <input
                          id="deep-analysis"
                          type="checkbox"
                          checked={deepAnalysisEnabled}
                          onChange={(e) => setDeepAnalysisEnabled(e.target.checked)}
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="deep-analysis" className="font-medium text-gray-900">
                          Enable Deep Analysis (Follow Links)
                        </Label>
                        <p className="text-sm text-gray-500 mt-1">
                          When enabled, we&apos;ll automatically visit new links found on the page and analyze them using your &quot;Go/No Go&quot; rules.
                        </p>
                        <div className="mt-2 p-3 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100">
                          <strong>Note:</strong> This consumes more AI credits and Firecrawl scrapes. Make sure you have defined your &quot;Go/No Go Rules&quot; in Settings.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Authentication / Headers Configuration */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="cookie-string">Session Cookie</Label>
                        <textarea
                          id="cookie-string"
                          value={cookieString}
                          onChange={(e) => setCookieString(e.target.value)}
                          placeholder="Paste your session cookie here..."
                          className="flex h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1 font-mono"
                        />
                        <div className="mt-2 p-3 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100">
                          <strong>Important:</strong> You must be logged into the website for this to work.
                          <ol className="list-decimal ml-4 mt-1 space-y-1">
                            <li>Open the website in your browser and ensure you are logged in.</li>
                            <li>Open Developer Tools (F12) and go to the <strong>Network</strong> tab.</li>
                            <li>Refresh the page and click on the first request (usually the website URL).</li>
                            <li>Look for <strong>Cookie</strong> in the &quot;Request Headers&quot; section.</li>
                            <li>Copy the entire value and paste it above.</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Notification Type Selection */}
            <div>
              <Label htmlFor="notification-type">Notification Type</Label>
              <Select
                id="notification-type"
                value={notificationPreference}
                onChange={(e) => setNotificationPreference(e.target.value as 'none' | 'email' | 'webhook' | 'both')}
                className="w-full mt-1"
              >
                <option value="none">No notifications</option>
                <option value="email">Email only</option>
                <option value="webhook">Webhook only</option>
                <option value="both">Email and Webhook</option>
              </Select>
            </div>

            {/* Email Configuration Info */}
            {(notificationPreference === 'email' || notificationPreference === 'both') && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-900">Email Notifications</p>
                    <p className="text-sm text-orange-700 mt-1">
                      Configure your email address in the <a href="/settings" className="underline font-medium">settings page</a> to receive change notifications.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Webhook Configuration */}
            {(notificationPreference === 'webhook' || notificationPreference === 'both') && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    type="url"
                    placeholder="https://your-server.com/webhook"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    className="mt-1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    We&apos;ll send a POST request to this URL when changes are detected
                  </p>
                  
                  {/* Slack Integration Info */}
                  <div className="mt-3 p-3 bg-blue-50 text-blue-800 rounded-md border border-blue-100 text-sm">
                    <p className="font-semibold flex items-center gap-2 mb-2">
                       <img src="https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png" className="w-4 h-4" alt="Slack" />
                       Slack Integration
                    </p>
                    <p className="mb-2">To get notifications in Slack:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Go to <a href="https://api.slack.com/apps" target="_blank" className="underline">api.slack.com/apps</a> and create a new app</li>
                      <li>Enable <strong>Incoming Webhooks</strong> in the sidebar</li>
                      <li>Click &quot;Add New Webhook to Workspace&quot;</li>
                      <li>Copy the Webhook URL and paste it above</li>
                    </ol>
                    <p className="mt-2 text-xs italic">
                      We automatically detect Slack URLs and format messages beautifully for Slack!
                    </p>
                  </div>
                </div>

                {/* Webhook Payload Example */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Webhook Payload Example</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyPayloadExample}
                      className="text-xs"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-xs">
                      <code>{`{
  "event": "website_changed",
  "website": {
    "name": "${websiteName}",
    "url": "https://example.com",
    "checkInterval": 60
  },
  "change": {
    "detectedAt": "${new Date().toISOString()}",
    "changeType": "content_modified",
    "summary": "Page content has changed",
    "diff": {
      "added": ["New paragraph added", "Updated heading"],
      "removed": ["Old footer text"]
    }
  },
  "scrapeResult": {
    "title": "Example Website",
    "description": "Website description",
    "markdown": "# Page Content\\n\\nThis is the scraped content..."
  }
}`}</code>
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-gray-500">
              Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> or <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">⌘</kbd>+<kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> to save
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="orange">
                Save Settings
              </Button>
            </div>
          </div>
        </form>
      </div >
    </div >
  )
}