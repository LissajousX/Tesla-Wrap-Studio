interface InfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoDialog = ({ isOpen, onClose }: InfoDialogProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-tesla-red/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-tesla-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-white">
                How to Install Your Design on Your Tesla
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close dialog"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* How to Use */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">How to Use Custom Wraps</h3>
            <ol className="space-y-2 text-white/70 text-sm">
              <li className="flex gap-3">
                <span className="text-tesla-red font-semibold flex-shrink-0">1.</span>
                <span><strong>Download</strong> your design as a PNG file using the Export PNG button</span>
              </li>
              <li className="flex gap-3">
                <span className="text-tesla-red font-semibold flex-shrink-0">2.</span>
                <span><strong>Load</strong> your wraps onto a USB drive in a folder called <code className="bg-white/10 px-1.5 py-0.5 rounded text-tesla-red">Wraps</code></span>
              </li>
              <li className="flex gap-3">
                <span className="text-tesla-red font-semibold flex-shrink-0">3.</span>
                <span><strong>Apply</strong> in your Tesla: <strong>Toybox → Paint Shop → Wraps tab</strong></span>
              </li>
            </ol>
          </div>

          {/* USB Drive Setup */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">USB Drive Setup</h3>
            <ol className="space-y-2 text-white/70 text-sm">
              <li className="flex gap-3">
                <span className="text-tesla-red font-semibold flex-shrink-0">1.</span>
                <span>Format the USB drive as one of the following: <strong>exFAT</strong>, <strong>FAT32</strong> (for Windows), <strong>MS-DOS FAT</strong> (for Mac), <strong>ext3</strong>, or <strong>ext4</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="text-tesla-red font-semibold flex-shrink-0">2.</span>
                <span>Create a folder called <code className="bg-white/10 px-1.5 py-0.5 rounded text-tesla-red">Wraps</code> at the root level of the drive</span>
              </li>
              <li className="flex gap-3">
                <span className="text-tesla-red font-semibold flex-shrink-0">3.</span>
                <span>Place your PNG files inside the <code className="bg-white/10 px-1.5 py-0.5 rounded text-tesla-red">Wraps</code> folder</span>
              </li>
              <li className="flex gap-3">
                <span className="text-tesla-red font-semibold flex-shrink-0">4.</span>
                <span>Ensure the drive doesn't contain map or firmware updates</span>
              </li>
            </ol>
            <p className="mt-3 text-white/50 text-xs italic">
              Note: NTFS is not currently supported
            </p>
          </div>

          {/* Troubleshooting */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Troubleshooting</h3>
            <p className="text-white/70 text-sm mb-2">
              If you encounter any issues with loading or applying wrap images, please check the following:
            </p>
            <ul className="space-y-2 text-white/70 text-sm">
              <li className="flex gap-3">
                <span className="text-tesla-red flex-shrink-0">•</span>
                <span>Ensure that the USB drive is formatted correctly and does not contain any map update or firmware update files</span>
              </li>
              <li className="flex gap-3">
                <span className="text-tesla-red flex-shrink-0">•</span>
                <span>Verify that the USB drive is properly formatted and the Wraps folder is correctly set up</span>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#161618]">
          <button
            onClick={onClose}
            className="w-full px-5 py-2 bg-tesla-red hover:bg-tesla-red/90 text-white rounded-lg font-medium transition-colors text-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
