import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Github, Apple, X } from 'lucide-react'

interface LoginDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function LoginDialog({ isOpen, onClose, onSuccess }: LoginDialogProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { signIn, signUp } = useAuth()

  if (!isOpen) return null

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading('email')

    try {
      const result = mode === 'login' 
        ? await signIn(email, password)
        : await signUp(email, password)

      if (result.error) {
        setError(result.error.message || 'Authentication failed')
        setLoading(null)
      } else {
        setLoading(null)
        onSuccess?.()
        onClose()
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
      setLoading(null)
    }
  }

  const handleSocialAuth = async (provider: 'google' | 'github' | 'apple') => {
    if (!supabase) return
    
    setLoading(provider)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}`,
        },
      })

      if (error) throw error
    } catch (err: any) {
      setError(err.message || `Failed to sign in with ${provider}`)
      setLoading(null)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden relative z-[10000]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">
            {mode === 'login' ? 'Sign In' : 'Sign Up'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            title="Close"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-transparent"
                placeholder="you@example.com"
                disabled={!!loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-transparent"
                placeholder="••••••••"
                disabled={!!loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!!loading}
              className="w-full px-4 py-3 bg-tesla-red hover:bg-tesla-red/80 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'email' ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Please wait...</span>
                </div>
              ) : (
                mode === 'login' ? 'Sign In' : 'Sign Up'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#1c1c1e] text-white/40">Or continue with</span>
            </div>
          </div>

          {/* Social Buttons */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Google */}
              <button
                onClick={() => handleSocialAuth('google')}
                disabled={!!loading}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading === 'google' ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="text-sm font-medium text-white/70 group-hover:text-white">Google</span>
                  </>
                )}
              </button>

              {/* GitHub */}
              <button
                onClick={() => handleSocialAuth('github')}
                disabled={!!loading}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading === 'github' ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Github className="w-5 h-5 text-white/70 group-hover:text-white" />
                    <span className="text-sm font-medium text-white/70 group-hover:text-white">GitHub</span>
                  </>
                )}
              </button>
            </div>

            {/* Apple */}
            <button
              onClick={() => handleSocialAuth('apple')}
              disabled={!!loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading === 'apple' ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Apple className="w-5 h-5 text-white/70 group-hover:text-white" />
                  <span className="text-sm font-medium text-white/70 group-hover:text-white">Continue with Apple</span>
                </>
              )}
            </button>
          </div>

          {/* Toggle Mode */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setError(null)
              }}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              {mode === 'login' 
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
