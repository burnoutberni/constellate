import { useState } from 'react'
import { Button } from './ui/Button'
import { Card, CardContent } from './ui/Card'
import { SignupModal } from './SignupModal'

interface SignUpPromptProps {
    /**
     * The action context for the prompt (e.g., "follow this user", "RSVP", etc.)
     */
    action?: string
    /**
     * Optional custom message
     */
    message?: string
    /**
     * Callback after successful signup/login
     */
    onSuccess?: () => void
    /**
     * Custom className for the card
     */
    className?: string
}

/**
 * SignUpPrompt component displays a call-to-action for unauthenticated users
 * to sign up or log in to perform specific actions.
 */
export function SignUpPrompt({ 
    action = 'continue', 
    message,
    onSuccess,
    className 
}: SignUpPromptProps) {
    const [showSignupModal, setShowSignupModal] = useState(false)

    const defaultMessage = `Sign up to ${action}`

    return (
        <>
            <Card variant="outlined" className={className}>
                <CardContent className="text-center py-6">
                    <div className="text-4xl mb-3">👋</div>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">
                        Join Constellate
                    </h3>
                    <p className="text-text-secondary mb-4">
                        {message || defaultMessage}
                    </p>
                    <Button 
                        variant="primary" 
                        size="lg"
                        onClick={() => setShowSignupModal(true)}
                    >
                        Sign Up
                    </Button>
                </CardContent>
            </Card>

            <SignupModal 
                isOpen={showSignupModal}
                onClose={() => setShowSignupModal(false)}
                onSuccess={() => {
                    setShowSignupModal(false)
                    onSuccess?.()
                }}
            />
        </>
    )
}
