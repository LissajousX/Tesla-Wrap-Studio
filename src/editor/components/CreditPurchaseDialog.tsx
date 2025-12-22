import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getUserCredits } from '../../utils/aiCredits';
import type { UserCredits } from '../../utils/aiCredits';
import { createCheckoutSession, CREDIT_PACKAGES, setStripeNavigation } from '../../utils/stripe';
import { X, CreditCard, Loader2 } from 'lucide-react';

interface CreditPurchaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void;
}

export function CreditPurchaseDialog({ isOpen, onClose, onPurchaseSuccess }: CreditPurchaseDialogProps) {
  const { user } = useAuth();
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      getUserCredits(user.id).then(setCredits);
    }
  }, [isOpen, user]);

  // Check for payment success/cancel on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    
    if (paymentStatus === 'success') {
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh credits
      if (user) {
        getUserCredits(user.id).then(setCredits);
      }
      onPurchaseSuccess?.();
    } else if (paymentStatus === 'cancelled') {
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user, onPurchaseSuccess]);

  if (!isOpen) return null;

  const handlePurchase = async (pkg: typeof CREDIT_PACKAGES[number]) => {
    if (!user) {
      setError('Please log in to purchase credits');
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedPackage(pkg.id);

    try {
      const { url, error: checkoutError } = await createCheckoutSession(
        user.id,
        user.email || '',
        pkg.id
      );

      if (checkoutError) {
        setError(checkoutError);
        setLoading(false);
        setSelectedPackage(null);
        return;
      }

      if (url) {
        // Set flag to bypass the "Leave site?" warning
        setStripeNavigation(true);
        
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else {
        setError('Failed to create checkout session');
        setLoading(false);
        setSelectedPackage(null);
      }
    } catch (err) {
      console.error('Purchase error:', err);
      setError('An error occurred. Please try again.');
      setLoading(false);
      setSelectedPackage(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70"
        onClick={!loading ? onClose : undefined}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-md bg-[#1a1a1a] rounded-xl border border-white/[0.08] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div>
            <h2 className="text-lg font-medium text-white">Purchase Credits</h2>
            {credits && (
              <p className="text-xs text-white/50 mt-0.5">
                Current: {credits.credits} credit{credits.credits !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-400 flex-1">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            {CREDIT_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handlePurchase(pkg)}
                disabled={loading}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  pkg.popular
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20'
                } ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01]'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{pkg.credits} Credits</span>
                      {pkg.popular && (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-500 text-white rounded">
                          Best Value
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">
                      ${(pkg.price / pkg.credits).toFixed(2)} per credit
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-white">${pkg.price.toFixed(0)}</div>
                    {loading && selectedPackage === pkg.id && (
                      <div className="flex items-center gap-1 text-xs text-white/40 mt-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Loading...</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-white/[0.08] space-y-2">
            <div className="flex items-center justify-center gap-2 text-white/40">
              <CreditCard className="w-4 h-4" />
              <span className="text-xs">Secure payment via Stripe</span>
            </div>
            <p className="text-[10px] text-white/30 text-center">
              Credits are added instantly after successful payment. All transactions are securely processed.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

