import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useEditorStore } from '../state/useEditorStore'
import { exportPngAsDataUrl } from '../../utils/publish'
import { saveProjectToSupabase } from '../../utils/supabaseProjects'
import { X, Loader2, Check } from 'lucide-react'
import type { Stage } from 'konva/lib/Stage'

interface SaveDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  stageRef: React.RefObject<Stage | null>
}

export function SaveDialog({ isOpen, onClose, onSuccess, stageRef }: SaveDialogProps) {
  const { projectName, setProjectName, getSerializedState, designId, setDesignId, markAsSaved } = useEditorStore()
  const [editingName, setEditingName] = useState(projectName)
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Generate preview when dialog opens
  useEffect(() => {
    if (isOpen && stageRef.current) {
      exportPngAsDataUrl(stageRef.current).then((dataUrl) => {
        setPreviewDataUrl(dataUrl)
      })
      setEditingName(projectName)
      setError(null)
      setSuccess(false)
    }
  }, [isOpen, projectName, stageRef])

  const handleSave = async () => {
    if (!stageRef.current) {
      setError('Canvas not available')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Generate preview if not already generated
      let preview = previewDataUrl
      if (!preview) {
        preview = await exportPngAsDataUrl(stageRef.current)
        if (!preview) {
          throw new Error('Failed to generate preview image')
        }
        setPreviewDataUrl(preview)
      }

      // Get serialized project state
      const project = getSerializedState()
      
      // Update project name if changed
      if (editingName.trim() !== projectName) {
        setProjectName(editingName.trim())
        project.name = editingName.trim()
      }

      // Save to Supabase
      const savedDesign = await saveProjectToSupabase(
        project,
        preview,
        designId || undefined
      )

      // Update store
      setDesignId(savedDesign.id)
      markAsSaved()

      setSuccess(true)
      
      // Close after short delay
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Failed to save design')
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Save Design</h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
            title="Close"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Preview Image */}
          {previewDataUrl && (
            <div className="relative aspect-square bg-white/5 rounded-xl overflow-hidden border border-white/10">
              <img
                src={previewDataUrl}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* Project Name */}
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-white/70 mb-2">
              Design Name
            </label>
            <input
              id="project-name"
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              disabled={saving || success}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-transparent disabled:opacity-50"
              placeholder="Enter design name"
            />
          </div>

          {/* Status Messages */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Design saved successfully!</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || success || !editingName.trim()}
              className="flex-1 px-4 py-3 bg-tesla-red hover:bg-tesla-red/80 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : success ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                designId ? 'Update Design' : 'Save Design'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
