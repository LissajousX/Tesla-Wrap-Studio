import { useState } from 'react';
import { useEditorStore } from '../state/useEditorStore';
import { carModels } from '../../data/carModels';
import { getVehicleImageUrl } from '../../utils/assets';

interface NewProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Tesla factory colors + popular wrap colors
const colorOptions = [
  // Tesla Factory
  { name: 'Pearl White', color: '#F5F5F5', group: 'factory' },
  { name: 'Solid Black', color: '#1C1C1C', group: 'factory' },
  { name: 'Midnight Silver', color: '#4A4B4D', group: 'factory' },
  { name: 'Deep Blue', color: '#1E3A5F', group: 'factory' },
  { name: 'Red Multi-Coat', color: '#A12830', group: 'factory' },
  { name: 'Ultra White', color: '#FFFFFF', group: 'factory' },
  { name: 'Quicksilver', color: '#8C8C8C', group: 'factory' },
  { name: 'Midnight Cherry', color: '#4A1C2B', group: 'factory' },
  // Popular wrap colors
  { name: 'Matte Black', color: '#1A1A1A', group: 'popular' },
  { name: 'Satin White', color: '#E8E8E8', group: 'popular' },
  { name: 'Nardo Gray', color: '#7B7D7D', group: 'popular' },
  { name: 'Racing Green', color: '#1B4D3E', group: 'popular' },
  { name: 'Miami Blue', color: '#00A3E0', group: 'popular' },
  { name: 'Sunset Orange', color: '#FF5733', group: 'popular' },
  { name: 'Frozen Purple', color: '#5D3A9B', group: 'popular' },
  { name: 'Army Green', color: '#4B5320', group: 'popular' },
];

export const NewProjectDialog = ({ isOpen, onClose }: NewProjectDialogProps) => {
  const [step, setStep] = useState<'model' | 'color'>('model');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('#F5F5F5');
  const [customColorInput, setCustomColorInput] = useState('#F5F5F5');
  const [projectName, setProjectNameLocal] = useState('');
  
  const { setCurrentModelId, setBaseColor, resetProject, setProjectName } = useEditorStore();

  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId);
    setStep('color');
  };

  const handleSelectColor = (color: string) => {
    setSelectedColor(color);
    setCustomColorInput(color);
  };

  const handleCreate = () => {
    if (!selectedModelId) return;
    
    // Reset project (clears all layers and history)
    resetProject();
    
    // Set the new model and color
    setCurrentModelId(selectedModelId);
    setBaseColor(selectedColor);
    
    // Set project name
    const model = carModels.find(m => m.id === selectedModelId);
    const name = projectName.trim() || `${model?.name || 'Tesla'} Wrap Design`;
    setProjectName(name);
    
    // Reset dialog state
    setStep('model');
    setSelectedModelId(null);
    setSelectedColor('#F5F5F5');
    setProjectNameLocal('');
    
    onClose();
  };

  const handleBack = () => {
    setStep('model');
  };

  const selectedModel = carModels.find(m => m.id === selectedModelId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Step pills */}
              <div className="flex items-center gap-1 bg-white/5 rounded-full p-1">
                <div className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  step === 'model' 
                    ? 'bg-tesla-red text-white' 
                    : 'text-white/40'
                }`}>
                  1. Model
                </div>
                <div className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  step === 'color' 
                    ? 'bg-tesla-red text-white' 
                    : 'text-white/40'
                }`}>
                  2. Color
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="mt-4">
            <h2 className="text-2xl font-semibold text-white">
              {step === 'model' ? 'Select Tesla Model' : 'Choose Base Color'}
            </h2>
            <p className="text-sm text-white/50 mt-1">
              {step === 'model' 
                ? 'Choose the Tesla you want to design a wrap for'
                : 'This color shows through transparent areas of your design'
              }
            </p>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'model' ? (
            <div className="space-y-4">
              {/* Project Name Input */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Project Name (optional)</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectNameLocal(e.target.value)}
                  placeholder="My Tesla Wrap Design"
                  className="w-full px-4 py-3 bg-[#2c2c2e] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-transparent"
                />
              </div>
              
              {/* Model Selection */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Select Tesla Model</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {carModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model.id)}
                  className={`group relative rounded-xl overflow-hidden transition-all duration-200 focus:outline-none ${
                    selectedModelId === model.id
                      ? 'ring-2 ring-tesla-red ring-offset-2 ring-offset-[#1c1c1e]'
                      : 'ring-1 ring-white/10 hover:ring-white/30'
                  }`}
                >
                  {/* Square container */}
                  <div className="aspect-square bg-[#2c2c2e] flex items-center justify-center relative overflow-hidden">
                    <img
                      src={getVehicleImageUrl(model.folderName)}
                      alt={model.name}
                      className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    {/* Selection indicator */}
                    {selectedModelId === model.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-tesla-red rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Label */}
                  <div className="p-2.5 bg-[#252527]">
                    <span className="text-xs font-medium text-white/80 truncate block">{model.name}</span>
                  </div>
                </button>
              ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Selected Color Display */}
              <div className="flex items-center gap-4 p-4 bg-[#2c2c2e] rounded-xl">
                <div 
                  className="w-16 h-16 rounded-xl shadow-lg flex-shrink-0"
                  style={{ backgroundColor: selectedColor }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/50 mb-1">Selected Color</div>
                  <div className="text-lg font-semibold text-white">
                    {colorOptions.find(c => c.color === selectedColor)?.name || 'Custom Color'}
                  </div>
                  <div className="text-sm text-white/40 font-mono">{selectedColor}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/40 mb-1">Model</div>
                  <div className="text-sm text-white/70">{selectedModel?.name}</div>
                </div>
              </div>

              {/* Tesla Factory Colors */}
              <div>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Tesla Factory Colors</div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {colorOptions.filter(c => c.group === 'factory').map((c) => (
                    <button
                      key={c.color}
                      onClick={() => handleSelectColor(c.color)}
                      className={`group relative aspect-square rounded-xl transition-all duration-150 focus:outline-none ${
                        selectedColor === c.color
                          ? 'ring-2 ring-tesla-red ring-offset-2 ring-offset-[#1c1c1e] scale-105'
                          : 'hover:scale-105 ring-1 ring-white/10'
                      }`}
                      title={c.name}
                    >
                      <div 
                        className="absolute inset-0 rounded-xl"
                        style={{ backgroundColor: c.color }}
                      />
                      {selectedColor === c.color && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className={`w-5 h-5 drop-shadow-md ${c.color === '#FFFFFF' || c.color === '#F5F5F5' || c.color === '#E8E8E8' ? 'text-black/40' : 'text-white/80'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Popular Wrap Colors */}
              <div>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Popular Wrap Colors</div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {colorOptions.filter(c => c.group === 'popular').map((c) => (
                    <button
                      key={c.color}
                      onClick={() => handleSelectColor(c.color)}
                      className={`group relative aspect-square rounded-xl transition-all duration-150 focus:outline-none ${
                        selectedColor === c.color
                          ? 'ring-2 ring-tesla-red ring-offset-2 ring-offset-[#1c1c1e] scale-105'
                          : 'hover:scale-105 ring-1 ring-white/10'
                      }`}
                      title={c.name}
                    >
                      <div 
                        className="absolute inset-0 rounded-xl"
                        style={{ backgroundColor: c.color }}
                      />
                      {selectedColor === c.color && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-5 h-5 text-white/80 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Color */}
              <div>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Custom Color</div>
                <div className="flex items-center gap-3">
                  <label className="relative cursor-pointer">
                    <input
                      type="color"
                      value={customColorInput}
                      onChange={(e) => {
                        setCustomColorInput(e.target.value);
                        setSelectedColor(e.target.value);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div 
                      className={`w-12 h-12 rounded-xl transition-all ${
                        !colorOptions.some(c => c.color === selectedColor)
                          ? 'ring-2 ring-tesla-red ring-offset-2 ring-offset-[#1c1c1e]'
                          : 'ring-1 ring-white/20'
                      }`}
                      style={{ backgroundColor: customColorInput }}
                    />
                  </label>
                  <div className="flex-1 max-w-[200px]">
                    <input
                      type="text"
                      value={customColorInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCustomColorInput(value);
                        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                          setSelectedColor(value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#2c2c2e] border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-transparent"
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between bg-[#161618]">
          <div>
            {step === 'color' && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            {step === 'color' && (
              <button
                onClick={handleCreate}
                className="px-6 py-2 bg-tesla-red hover:bg-tesla-red/90 text-white rounded-lg font-medium transition-colors text-sm flex items-center gap-2"
              >
                Create Project
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
