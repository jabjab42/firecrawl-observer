'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { Id } from '../../../../../convex/_generated/dataModel'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Loader2, ArrowLeft, Save, CheckCircle, Mail, Bot, Globe, Settings } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

export default function AdminUserDetail() {
    const params = useParams()
    const userId = params.userId as Id<"users">


    const data = useQuery(api.admin.getUserDetails, { userId })
    const updateUserEmailConfig = useMutation(api.admin.updateUserEmailConfig)
    const updateUserSettings = useMutation(api.admin.updateUserSettings)

    const [activeTab, setActiveTab] = useState<'profile' | 'settings' | 'websites'>('profile')

    // Form states
    const [email, setEmail] = useState('')
    const [isVerified, setIsVerified] = useState(false)
    const [aiSystemPrompt, setAiSystemPrompt] = useState('')
    const [goNoGoRules, setGoNoGoRules] = useState('')
    const [emailOnlyIfMeaningful, setEmailOnlyIfMeaningful] = useState(false)

    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)

    // Populate form when data loads
    useEffect(() => {
        if (data) {
            setEmail(data.emailConfig?.email || data.user?.email || '')
            setIsVerified(data.emailConfig?.isVerified || false)
            setAiSystemPrompt(data.userSettings?.aiSystemPrompt || '')
            setGoNoGoRules(data.userSettings?.goNoGoRules || '')
            setEmailOnlyIfMeaningful(data.userSettings?.emailOnlyIfMeaningful || false)
        }
    }, [data])

    if (data === undefined) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
            </AdminLayout>
        )
    }

    if (data === null) {
        return (
            <AdminLayout>
                <div className="p-8 text-center">
                    <h2 className="text-xl font-bold text-gray-900">User not found</h2>
                    <Link href="/admin" className="text-orange-600 hover:underline mt-4 inline-block">
                        Return to Dashboard
                    </Link>
                </div>
            </AdminLayout>
        )
    }

    const handleSaveProfile = async () => {
        setIsSaving(true)
        try {
            await updateUserEmailConfig({
                userId,
                email,
                isVerified,
            })
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 3000)
        } catch (error) {
            console.error("Failed to save profile:", error)
            alert("Failed to save profile")
        } finally {
            setIsSaving(false)
        }
    }

    const handleSaveSettings = async () => {
        setIsSaving(true)
        try {
            await updateUserSettings({
                userId,
                settings: {
                    aiSystemPrompt,
                    goNoGoRules,
                    emailOnlyIfMeaningful,
                }
            })
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 3000)
        } catch (error) {
            console.error("Failed to save settings:", error)
            alert("Failed to save settings")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{data.user.name || 'Unknown User'}</h1>
                        <p className="text-sm text-gray-500">ID: {userId}</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'profile'
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <UserIcon className="h-4 w-4" />
                                Profile & Email
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'settings'
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                Settings & AI
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('websites')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'websites'
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                Websites ({data.websites.length})
                            </div>
                        </button>
                    </nav>
                </div>

                {/* Content */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                    {activeTab === 'profile' && (
                        <div className="max-w-xl space-y-6">
                            <h3 className="text-lg font-medium">Email Configuration</h3>

                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input
                                        id="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Email Verified</Label>
                                        <p className="text-sm text-gray-500">
                                            Is this email address verified?
                                        </p>
                                    </div>
                                    <Switch
                                        checked={isVerified}
                                        onCheckedChange={setIsVerified}
                                    />
                                </div>

                                <div className="pt-4">
                                    <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full sm:w-auto">
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Save Profile
                                    </Button>
                                    {saveSuccess && <span className="ml-3 text-green-600 text-sm flex items-center inline-flex"><CheckCircle className="h-4 w-4 mr-1" /> Saved</span>}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="max-w-2xl space-y-8">
                            <div>
                                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                                    <Bot className="h-5 w-5 text-purple-600" />
                                    AI Configuration
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="aiPrompt">System Prompt</Label>
                                        <Textarea
                                            id="aiPrompt"
                                            value={aiSystemPrompt}
                                            onChange={(e) => setAiSystemPrompt(e.target.value)}
                                            className="min-h-[150px] font-mono text-sm"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="goNoGo">Go/No Go Rules</Label>
                                        <Textarea
                                            id="goNoGo"
                                            value={goNoGoRules}
                                            onChange={(e) => setGoNoGoRules(e.target.value)}
                                            className="min-h-[100px] font-mono text-sm"
                                            placeholder="e.g. Must be in France, Budget > 50k..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-6">
                                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                                    <Mail className="h-5 w-5 text-blue-600" />
                                    Notification Preferences
                                </h3>

                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Email Only If Meaningful</Label>
                                        <p className="text-sm text-gray-500">
                                            Suppress emails if AI deems change not meaningful
                                        </p>
                                    </div>
                                    <Switch
                                        checked={emailOnlyIfMeaningful}
                                        onCheckedChange={setEmailOnlyIfMeaningful}
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full sm:w-auto">
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    Save Settings
                                </Button>
                                {saveSuccess && <span className="ml-3 text-green-600 text-sm flex items-center inline-flex"><CheckCircle className="h-4 w-4 mr-1" /> Saved</span>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'websites' && (
                        <div>
                            <h3 className="text-lg font-medium mb-6">Monitored Websites</h3>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Checked</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {data.websites.map((website) => (
                                            <tr key={website._id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                                    {website.name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <a href={website.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                                        {website.url}
                                                        <Globe className="h-3 w-3" />
                                                    </a>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${website.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                        }`}>
                                                        {website.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {website.lastChecked ? new Date(website.lastChecked).toLocaleString() : 'Never'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {data.websites.length === 0 && (
                                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg mt-4">
                                    No websites monitored by this user.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    )
}
