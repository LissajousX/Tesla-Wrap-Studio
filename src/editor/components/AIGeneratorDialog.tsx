import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../state/useEditorStore';
import { loadImage } from '../../utils/image';
import { useAuth } from '../../contexts/AuthContext';
import { getUserCredits } from '../../utils/aiCredits';
import type { UserCredits } from '../../utils/aiCredits';
import { createCheckoutSession, CREDIT_PACKAGES, saveStripeReturnContext, setStripeNavigation } from '../../utils/stripe';
import { saveProjectToLocalStorage, saveUIState } from '../../utils/localStorageProject';
import { supabase } from '../../lib/supabase';

// Using Nano Banana Pro for image generation
const AI_MODEL_ID = 'google/nano-banana-pro';

// Prompt suggestions focused on 3D-aware themes, characters, and franchises
const PROMPT_SUGGESTIONS = [
  'Ironman',
  'Flash',
  'Lightning McQueen',
  'Spongebob',
  'Racecar',
  'Star Wars',
  'Space X',
  'Batman',
  'Superman',
  'Spider-Man',
  'Transformers',
  'Jurassic Park',
  'Fast and Furious',
  'Formula 1',
  'NASCAR',
  'Cyberpunk 2077',
  'Tron',
  'The Matrix',
  'Mad Max',
  'Initial D',
  'Tokyo Drift',
  'Synthwave',
  'Vaporwave',
  '80s aesthetic',
];

// Replicate API via Supabase Edge Function (secure, server-side)
const REPLICATE_EDGE_FUNCTION = 'replicate-api';

interface AIGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GeneratedImage {
  original: string;
  preview: string;
}

interface GenerationState {
  loading: boolean;
  error: string | null;
  currentImage: GeneratedImage | null;
  progress: number;
  timeElapsed: number;
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
}

export const AIGeneratorDialog = ({ isOpen, onClose }: AIGeneratorDialogProps) => {
  const [prompt, setPrompt] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchasePackageId, setPurchasePackageId] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [showCreditsPanel, setShowCreditsPanel] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [state, setState] = useState<GenerationState>({
    loading: false,
    error: null,
    currentImage: null,
    progress: 0,
    timeElapsed: 0,
  });
  const startTimeRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useAuth();
  const { addLayer, templateImage, getSerializedState } = useEditorStore();
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Convert template image to base64
  const templateBase64 = useMemo(() => {
    if (!templateImage) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(templateImage, 0, 0, 1024, 1024);
    return canvas.toDataURL('image/png');
  }, [templateImage]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !state.loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, state.loading]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setState({
        loading: false,
        error: null,
        currentImage: null,
        progress: 0,
        timeElapsed: 0,
      });
      setShowCreditsPanel(false);
      setReferenceImage(null);
      startTimeRef.current = null;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      // Focus prompt input
      setTimeout(() => promptInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Track user for logout detection
  const prevUserRef = useRef(user);
  
  // Fetch credits
  useEffect(() => {
    if (isOpen && user) {
      setLoadingCredits(true);
      getUserCredits(user.id)
        .then(setCredits)
        .catch(() => {})
        .finally(() => setLoadingCredits(false));
    } else if (isOpen && !user && prevUserRef.current) {
      onClose();
    }
    prevUserRef.current = user;
  }, [isOpen, user, onClose]);

  // Apply mask to image
  const applyMask = useCallback(async (imageUrl: string): Promise<string> => {
    if (!templateImage) return imageUrl;
    
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = 1024;
      canvas.height = 1024;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 1024, 1024);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(templateImage, 0, 0, 1024, 1024);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  }, [templateImage]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Poll prediction
  const pollPrediction = async (predictionId: string): Promise<ReplicatePrediction> => {
    if (!supabase) throw new Error('Supabase not initialized');

    const maxAttempts = 120;
    let attempts = 0;
    
    startTimeRef.current = Date.now();
    
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = window.setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const estimatedProgress = Math.min(95, (elapsed / 60) * 100);
        setState(prev => ({ ...prev, progress: estimatedProgress, timeElapsed: elapsed }));
      }
    }, 500);

    while (attempts < maxAttempts) {
      const { data, error } = await supabase.functions.invoke(REPLICATE_EDGE_FUNCTION, {
        method: 'POST',
        body: { action: 'poll', predictionId },
      });

      if (error) {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        throw new Error(error.message);
      }

      const prediction = data as ReplicatePrediction;

      if (prediction.status === 'succeeded') {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setState(prev => ({ ...prev, progress: 100 }));
        return prediction;
      } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        throw new Error(prediction.error || 'Generation failed');
      }

      await sleep(2000);
      attempts++;
    }

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    throw new Error('Generation timed out');
  };

  // Generate design
  const handleGenerate = useCallback(async () => {
    if (!user) {
      setState(prev => ({ ...prev, error: 'Please log in to generate designs' }));
      return;
    }

    if (!prompt.trim()) {
      setState(prev => ({ ...prev, error: 'Please describe your design' }));
      return;
    }

    if (!supabase) {
      setState(prev => ({ ...prev, error: 'Service not configured' }));
      return;
    }

    if (!credits || credits.credits <= 0) {
      setShowCreditsPanel(true);
      return;
    }

    if (!templateBase64) {
      setState(prev => ({ ...prev, error: 'Template not loaded. Please wait.' }));
      return;
    }

    setState({ loading: true, error: null, currentImage: null, progress: 0, timeElapsed: 0 });
    startTimeRef.current = null;

    try {
      const imageInput: string[] = [templateBase64];
      if (referenceImage) imageInput.push(referenceImage);
      
      const { data: predictionData, error: createError } = await supabase.functions.invoke(
        REPLICATE_EDGE_FUNCTION,
        {
          method: 'POST',
          body: {
            action: 'create',
            model: AI_MODEL_ID,
            input: {
              prompt: prompt.trim(),
              image_input: imageInput,
              aspect_ratio: '1:1',
              resolution: '1K',
              output_format: 'png',
              safety_filter_level: 'block_only_high',
            },
          },
        }
      );

      if (createError) throw new Error(createError.message || 'Failed to start generation');

      const prediction = predictionData as ReplicatePrediction;
      if (!prediction?.id) throw new Error('Invalid response');

      const completedPrediction = await pollPrediction(prediction.id);

      if (!completedPrediction.output) throw new Error('No image generated');

      const outputUrl = typeof completedPrediction.output === 'string' 
        ? completedPrediction.output 
        : completedPrediction.output[0];

      // Process image
      const response = await fetch(outputUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      
      const originalDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const previewDataUrl = await applyMask(originalDataUrl);

      // Refresh credits
      if (user) {
        const updatedCredits = await getUserCredits(user.id);
        setCredits(updatedCredits);
      }

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      
      setState({
        loading: false,
        error: null,
        currentImage: { original: originalDataUrl, preview: previewDataUrl },
        progress: 100,
        timeElapsed: startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0,
      });
      startTimeRef.current = null;
    } catch (error) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Generation failed',
        progress: 0,
        timeElapsed: 0,
      }));
      startTimeRef.current = null;
    }
  }, [prompt, referenceImage, applyMask, templateBase64, user, credits]);

  // Add to canvas
  const handleAddToCanvas = useCallback(async () => {
    if (!state.currentImage) return;

    try {
      const image = await loadImage(state.currentImage.original);
      addLayer({
        type: 'texture',
        name: 'AI Design',
        src: state.currentImage.original,
        image,
        visible: true,
        locked: false,
        opacity: 1,
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      });
      onClose();
    } catch (error) {
      setState(prev => ({ ...prev, error: 'Failed to add to canvas' }));
    }
  }, [state.currentImage, addLayer, onClose]);

  // Iterate on current design
  const handleIterate = useCallback(() => {
    if (state.currentImage) {
      setReferenceImage(state.currentImage.original);
      promptInputRef.current?.focus();
    }
  }, [state.currentImage]);

  // Handle purchase
  const handlePurchase = async (packageId: string) => {
    if (!user) return;

    setPurchaseLoading(true);
    setPurchasePackageId(packageId);
    setPurchaseError(null);

    try {
      const { url, error: checkoutError } = await createCheckoutSession(user.id, user.email || '', packageId);

      if (checkoutError) {
        setPurchaseError(checkoutError);
        setPurchaseLoading(false);
        setPurchasePackageId(null);
        return;
      }

      if (url) {
        const project = getSerializedState();
        saveProjectToLocalStorage(project);
        saveUIState({ openDialog: 'ai', zoom: 1, autoFit: true });
        saveStripeReturnContext({ openDialog: 'ai' }, project);
        setStripeNavigation(true);
        window.location.href = url;
      }
    } catch {
      setPurchaseError('An error occurred');
      setPurchaseLoading(false);
      setPurchasePackageId(null);
    }
  };

  // Payment callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    
    if (paymentStatus === 'success' || paymentStatus === 'cancelled') {
      window.history.replaceState({}, '', window.location.pathname);
      if (paymentStatus === 'success' && user) {
        getUserCredits(user.id).then(setCredits);
      }
    }
  }, [user]);

  if (!isOpen) return null;

  const hasResult = state.currentImage !== null;
  const noCredits = !loadingCredits && credits !== null && credits.credits <= 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => !state.loading && onClose()}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-[#18181b] rounded-2xl border border-white/10 shadow-2xl">
        
        {/* Header - Compact */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08] bg-[#1c1c1f]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-white">AI Design</span>
            {!loadingCredits && credits !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${credits.credits > 0 ? 'bg-purple-500/20 text-purple-300' : 'bg-red-500/20 text-red-300'}`}>
                {credits.credits} credit{credits.credits !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={() => !state.loading && onClose()}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            disabled={state.loading}
            title="Close"
            aria-label="Close dialog"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex h-[calc(90vh-56px)] overflow-hidden">
          
          {/* Left Panel - Input */}
          <div className="w-[340px] flex-shrink-0 border-r border-white/[0.08] flex flex-col bg-[#1a1a1d]">
            
            {/* Prompt Area */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-4">
                {/* Reference indicator */}
                {referenceImage && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <div className="w-12 h-12 rounded-md overflow-hidden bg-black/30 flex-shrink-0">
                      <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-blue-300">Iterating on design</p>
                      <p className="text-xs text-white/50 truncate">Refining previous result</p>
                    </div>
                    <button
                      onClick={() => setReferenceImage(null)}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white"
                      title="Clear reference"
                      aria-label="Clear reference image"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Prompt input */}
                <div>
                  <textarea
                    ref={promptInputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your wrap design..."
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500/50 resize-none"
                    maxLength={500}
                    disabled={state.loading}
                  />
                </div>

                {/* Quick suggestions */}
                <div className="relative" ref={suggestionsRef}>
                  <button
                    onClick={() => setShowSuggestions(!showSuggestions)}
                    className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
                    disabled={state.loading}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>Ideas</span>
                    <svg className={`w-3 h-3 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showSuggestions && (
                    <div className="absolute top-full left-0 mt-1 w-48 max-h-40 overflow-y-auto bg-[#252528] border border-white/10 rounded-lg shadow-xl z-50 py-1">
                      {PROMPT_SUGGESTIONS.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => { setPrompt(suggestion); setShowSuggestions(false); }}
                          className="w-full px-3 py-1.5 text-left text-xs text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Error */}
                {state.error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-400">{state.error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Generate Button */}
            <div className="p-4 border-t border-white/[0.08]">
              <button
                onClick={handleGenerate}
                disabled={state.loading || !prompt.trim() || noCredits}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-all ${
                  state.loading || !prompt.trim() || noCredits
                    ? 'bg-white/[0.06] text-white/30 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-400 hover:to-blue-400 shadow-lg shadow-purple-500/20'
                }`}
              >
                {state.loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : noCredits ? (
                  <span>No credits</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <span>{referenceImage ? 'Regenerate' : 'Generate'}</span>
                  </>
                )}
              </button>
              
              {/* Buy credits link */}
              {noCredits && (
                <button
                  onClick={() => setShowCreditsPanel(true)}
                  className="w-full mt-2 py-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Get more credits →
                </button>
              )}
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="flex-1 flex flex-col bg-[#0f0f11]">
            
            {/* Preview Area */}
            <div className="flex-1 flex items-center justify-center p-6">
              {state.loading ? (
                /* Loading State */
                <div className="text-center space-y-4">
                  <div className="relative w-20 h-20 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-semibold text-white">{Math.round(state.progress)}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-white/70">Creating your design...</p>
                    {state.timeElapsed > 0 && (
                      <p className="text-xs text-white/40 mt-1">{state.timeElapsed}s elapsed</p>
                    )}
                  </div>
                </div>
              ) : hasResult ? (
                /* Result */
                <div className="w-full max-w-lg">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-[#0a0a0c] border border-white/10">
                    <img
                      src={state.currentImage!.preview}
                      alt="Generated design"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ) : (
                /* Empty State */
                <div className="text-center max-w-xs">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                    <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-white/40">Describe your design and click Generate</p>
                </div>
              )}
            </div>

            {/* Action Bar - Only shown when result exists */}
            {hasResult && !state.loading && (
              <div className="flex items-center gap-3 p-4 border-t border-white/[0.08] bg-[#141416]">
                <button
                  onClick={handleIterate}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/10 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Iterate</span>
                </button>
                <button
                  onClick={handleAddToCanvas}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white text-black font-medium text-sm hover:bg-white/90 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add to Canvas</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Credits Panel Overlay */}
        {showCreditsPanel && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-10">
            <div className="w-full max-w-sm bg-[#1c1c1f] rounded-xl border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
                <h3 className="text-sm font-medium text-white">Get Credits</h3>
                <button
                  onClick={() => setShowCreditsPanel(false)}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-white/50 hover:text-white"
                  title="Close"
                  aria-label="Close credits panel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-4 space-y-2">
                {purchaseError && (
                  <p className="text-xs text-red-400 mb-3">{purchaseError}</p>
                )}
                {CREDIT_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => handlePurchase(pkg.id)}
                    disabled={purchaseLoading}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                      pkg.popular
                        ? 'border-purple-500/40 bg-purple-500/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                    } ${purchaseLoading ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{pkg.credits} credits</span>
                      {pkg.popular && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-purple-500 text-white rounded-full font-bold">BEST</span>
                      )}
                    </div>
                    {purchaseLoading && purchasePackageId === pkg.id ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                    ) : (
                      <span className="text-sm font-semibold text-white">${pkg.price}</span>
                    )}
                  </button>
                ))}
              </div>
              
              <div className="px-4 pb-4">
                <p className="text-xs text-white/30 text-center">1 credit = 1 design generation</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
