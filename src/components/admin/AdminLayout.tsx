'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Layout, MainContent } from '@/components/layout/layout'
import { Header } from '@/components/layout/header'
import { Users, Shield } from 'lucide-react'

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    return (
        <Layout>
            <Header />
            <MainContent maxWidth="7xl" className="py-8">
                <div className="flex gap-8">
                    {/* Admin Sidebar */}
                    <div className="w-64 flex-shrink-0">
                        <div className="bg-white rounded-lg shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-6 px-2">
                                <Shield className="h-5 w-5 text-orange-600" />
                                <h2 className="font-bold text-gray-900">Admin Panel</h2>
                            </div>

                            <nav className="space-y-1">
                                <Link
                                    href="/admin"
                                    className={`flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${pathname === '/admin'
                                        ? 'bg-orange-50 text-orange-700'
                                        : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <Users className="h-4 w-4" />
                                    Users
                                </Link>
                                {/* Add more admin links here if needed */}
                            </nav>
                        </div>
                    </div>

                    {/* Admin Content */}
                    <div className="flex-1">
                        {children}
                    </div>
                </div>
            </MainContent>
        </Layout>
    )
}
