'use client'

import { useState } from 'react'
import { Layout, Footer } from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, ArrowLeft, Mail } from 'lucide-react'
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSent, setIsSent] = useState(false)
    const requestPasswordReset = useMutation(api.passwordReset.requestPasswordReset)
    const { addToast } = useToast()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            await requestPasswordReset({ email })
            setIsSent(true)
            addToast({
                variant: 'success',
                title: 'Reset Link Sent',
                description: 'If an account exists with this email, you will receive a password reset link.',
                duration: 5000
            })
        } catch (error) {
            console.error(error)
            addToast({
                variant: 'error',
                title: 'Error',
                description: 'Something went wrong. Please try again.',
                duration: 4000
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Layout>
            <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-200px)]">
                <div className="w-full max-w-md px-4">
                    <div className="bg-white rounded-lg p-8 shadow-sm">
                        <div className="mb-6">
                            <Link
                                href="/"
                                className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
                            >
                                <ArrowLeft className="w-4 h-4 mr-1" />
                                Back to Sign In
                            </Link>
                            <h1 className="text-2xl font-semibold mb-2">Forgot Password</h1>
                            <p className="text-gray-600">
                                Enter your email address and we&apos;ll send you a link to reset your password.
                            </p>
                        </div>

                        {isSent ? (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Mail className="w-6 h-6 text-green-600" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">Check your email</h3>
                                <p className="text-gray-600 mb-6">
                                    We&apos;ve sent a password reset link to <strong>{email}</strong>.
                                </p>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => setIsSent(false)}
                                >
                                    Try another email
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-medium text-zinc-700">
                                        Email Address
                                    </label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    variant="orange"
                                    className="w-full"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Sending Link...
                                        </>
                                    ) : (
                                        'Send Reset Link'
                                    )}
                                </Button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </Layout>
    )
}
