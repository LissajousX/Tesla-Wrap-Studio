import { Image as KonvaImage } from 'react-konva';
import { useEffect, useState } from 'react';
import type { FillLayer as FillLayerType } from '../../state/editorTypes';

interface FillLayerProps {
  layer: FillLayerType;
  id?: string;
  onClick?: (e: any) => void;
  onTap?: (e: any) => void;
  onDragStart?: (e: any) => void;
  onDragEnd?: (e: any) => void;
  onTransformStart?: (e: any) => void;
  onTransformEnd?: (e: any) => void;
  draggable?: boolean;
  listening?: boolean;
}

// Helper function to regenerate fill image with new color
const regenerateFillImage = (
  pixelMask: number[],
  fillColorHex: string,
  width: number,
  height: number
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  // Parse fill color
  const fillColorMatch = fillColorHex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  const r = fillColorMatch ? parseInt(fillColorMatch[1], 16) : 0;
  const g = fillColorMatch ? parseInt(fillColorMatch[2], 16) : 0;
  const b = fillColorMatch ? parseInt(fillColorMatch[3], 16) : 0;
  
  // Create image data
  const imageData = ctx.createImageData(width, height);
  
  // Fill the pixels
  pixelMask.forEach((pixelIdx) => {
    imageData.data[pixelIdx] = r;
    imageData.data[pixelIdx + 1] = g;
    imageData.data[pixelIdx + 2] = b;
    imageData.data[pixelIdx + 3] = 255; // Full opacity
  });
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
};

export const FillLayer = ({
  layer,
  id,
  onClick,
  onTap,
  onDragStart,
  onDragEnd,
  onTransformStart,
  onTransformEnd,
  draggable,
  listening,
}: FillLayerProps) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  
  // Load or regenerate image when layer changes or fill color changes
  useEffect(() => {
    // If we have pixel mask data, regenerate the image with current fill color
    if (layer.pixelMask && layer.maskWidth && layer.maskHeight) {
      const newImageDataUrl = regenerateFillImage(
        layer.pixelMask,
        layer.fill,
        layer.maskWidth,
        layer.maskHeight
      );
      const img = new window.Image();
      img.onload = () => {
        setImage(img);
      };
      img.src = newImageDataUrl;
    } else if (layer.fillImageDataUrl) {
      // Fallback to existing image data URL if no pixel mask
      const img = new window.Image();
      img.onload = () => {
        setImage(img);
      };
      img.src = layer.fillImageDataUrl;
    }
  }, [layer.fillImageDataUrl, layer.fill, layer.pixelMask, layer.maskWidth, layer.maskHeight]);
  
  if (!image) return null;
  
  return (
    <KonvaImage
      id={id || layer.id}
      image={image}
      x={layer.x}
      y={layer.y}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={layer.opacity}
      visible={layer.visible}
      listening={listening !== undefined ? listening : !layer.locked}
      onClick={onClick}
      onTap={onTap}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTransformStart={onTransformStart}
      onTransformEnd={onTransformEnd}
      draggable={draggable}
      filters={[]}
    />
  );
};
