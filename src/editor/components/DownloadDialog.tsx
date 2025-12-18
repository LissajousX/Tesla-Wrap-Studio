interface DownloadDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DownloadDialog = ({
  isOpen,
  onConfirm,
  onCancel,
}: DownloadDialogProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Dialog */}
      <div className="relative bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-8">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-tesla-red/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-tesla-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          
          {/* Content */}
          <h3 className="text-2xl font-semibold text-white text-center mb-4">
            Download Your Design
          </h3>
          <p className="text-white/70 text-center text-base mb-4">
            This tool is <span className="font-semibold text-tesla-red">100% free</span>.
          </p>
          <p className="text-white/50 text-center text-xs">
            If you would like to support the development of this page, you can{' '}
            <a
              href="https://buymeacoffee.com/dtschannen"
              target="_blank"
              rel="noopener noreferrer"
              className="text-tesla-red hover:text-tesla-red/80 underline transition-colors"
            >
              buy me a coffee
            </a>
            .
          </p>
        </div>
        
        {/* Actions */}
        <div className="p-6 border-t border-white/10 bg-[#161618]">
          <div className="flex flex-col gap-3">
            <button
              onClick={onConfirm}
              className="w-full px-6 py-4 bg-gradient-to-r from-tesla-red to-[#9d252c] hover:from-[#9d252c] hover:to-[#8a1f25] text-white rounded-lg font-semibold text-lg transition-all duration-200 shadow-lg shadow-tesla-red/20 hover:shadow-tesla-red/30 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PNG
            </button>
            <button
              onClick={onCancel}
              className="px-5 py-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
