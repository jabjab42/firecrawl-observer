'use client'

import { useState, Suspense } from 'react'
import { Layout, Footer } from '@/components/layout/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react'
import { useAction } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { validatePassword } from '@/lib/validation'

function ResetPasswordContent() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const resetPassword = useAction(api.passwordReset.resetPassword)
    const { addToast } = useToast()
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get('token')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!token) {
            addToast({
                variant: 'error',
                title: 'Invalid Link',
                description: 'The reset link is invalid or missing a token.',
                duration: 4000
            })
            return
        }

        if (password !== confirmPassword) {
            addToast({
                variant: 'error',
                title: 'Passwords do not match',
                description: 'Please ensure both passwords match.',
                duration: 4000
            })
            return
        }

        const validation = validatePassword(password, 'signUp')
        if (!validation.isValid) {
            addToast({
                variant: 'error',
                title: 'Invalid Password',
                description: validation.error || 'Password does not meet requirements.',
                duration: 4000
            })
            return
        }

        setIsSubmitting(true)

        try {
            await resetPassword({ token, newPassword: password })
            setIsSuccess(true)
            addToast({
                variant: 'success',
                title: 'Password Reset Successful',
                description: 'Your password has been updated. You can now sign in.',
                duration: 5000
            })

            // Redirect to login after a delay
            setTimeout(() => {
                router.push('/')
            }, 3000)
        } catch (error: any) {
            console.error(error)
            addToast({
                variant: 'error',
                title: 'Reset Failed',
                description: error.message || 'The reset link may have expired or is invalid.',
                duration: 5000
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!token) {
        return (
            <div className="text-center">
                <h1 className="text-2xl font-semibold mb-2">Invalid Link</h1>
                <p className="text-gray-600 mb-6">
                    This password reset link is invalid or has expired.
                </p>
                <Link href="/forgot-password">
                    <Button variant="orange">Request a new link</Button>
                </Link>
            </div>
        )
    }

    return (
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
                    <h1 className="text-2xl font-semibold mb-2">Set New Password</h1>
                    <p className="text-gray-600">
                        Please enter your new password below.
                    </p>
                </div>

                {isSuccess ? (
                    <div className="text-center py-8">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Password Reset!</h3>
                        <p className="text-gray-600 mb-6">
                            Your password has been successfully updated. Redirecting to login...
                        </p>
                        <Link href="/">
                            <Button variant="orange" className="w-full">
                                Sign In Now
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium text-zinc-700">
                                New Password
                            </label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Minimum 6 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-700">
                                Confirm Password
                            </label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="Re-enter password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                autoComplete="new-password"
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
                                    Resetting Password...
                                </>
                            ) : (
                                'Reset Password'
                            )}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Layout>
            <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-200px)]">
                <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-orange-500" />}>
                    <ResetPasswordContent />
                </Suspense>
            </div>
            <Footer />
        </Layout>
    )
}
