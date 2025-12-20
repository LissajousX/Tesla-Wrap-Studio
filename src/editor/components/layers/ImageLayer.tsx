import { useEffect, useState, useMemo, useRef } from 'react';
import { Image as KonvaImage } from 'react-konva';
import type { ImageLayer as ImageLayerType } from '../../state/editorTypes';
import { loadImage } from '../../../utils/image';
import { useEditorStore } from '../../state/useEditorStore';

interface ImageLayerProps {
  layer: ImageLayerType;
  id?: string;
  onClick?: (e: any) => void;
  onTap?: (e: any) => void;
  onDragStart?: (e: any) => void;
  onDragMove?: (e: any) => void;
  onDragEnd?: (e: any) => void;
  onTransformStart?: (e: any) => void;
  onTransformEnd?: (e: any) => void;
  draggable?: boolean;
}

export const ImageLayer = ({ 
  layer,
  id,
  onClick,
  onTap,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTransformStart,
  onTransformEnd,
  draggable 
}: ImageLayerProps) => {
  const [image, setImage] = useState<HTMLImageElement | null>(layer.image || null);
  const templateImage = useEditorStore((state) => state.templateImage);
  const updateLayer = useEditorStore((state) => state.updateLayer);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (layer.image) {
      setImage(layer.image);
    } else if (layer.src) {
      loadImage(layer.src)
        .then(setImage)
        .catch((error) => {
          console.error('Failed to load image:', error);
        });
    }
  }, [layer.image, layer.src]);

  // Create masked canvas when template mask is enabled
  const maskedCanvas = useMemo(() => {
    if (!layer.useTemplateMask || !templateImage || !image) {
      return null;
    }

    // Create offscreen canvas at template size (1024x1024)
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Calculate where the image should be drawn on the 1024x1024 canvas
    // Account for layer position, scale, and rotation
    ctx.save();
    
    // Apply transformations at the image's position
    ctx.translate(layer.x, layer.y);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.scale(layer.scaleX, layer.scaleY);
    
    // Draw the image (handle cropping if present)
    if (layer.cropX !== undefined && layer.cropY !== undefined && 
        layer.cropWidth !== undefined && layer.cropHeight !== undefined) {
      ctx.drawImage(
        image,
        layer.cropX, layer.cropY, layer.cropWidth, layer.cropHeight,
        0, 0, layer.cropWidth, layer.cropHeight
      );
    } else {
      ctx.drawImage(image, 0, 0);
    }
    
    ctx.restore();
    
    // Apply template mask using destination-in composite
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(templateImage, 0, 0, 1024, 1024);
    
    return canvas;
  }, [image, templateImage, layer.useTemplateMask, layer.x, layer.y, layer.rotation, layer.scaleX, layer.scaleY, layer.cropX, layer.cropY, layer.cropWidth, layer.cropHeight]);

  if (!image) return null;

  // Custom drag handlers for masked mode
  const handleMaskedDragStart = (e: any) => {
    // Store the starting point of the drag (relative to the node's current position)
    const stage = e.target.getStage();
    const pointerPos = stage?.getPointerPosition();
    if (pointerPos) {
      dragStartPosRef.current = {
        x: pointerPos.x - layer.x,
        y: pointerPos.y - layer.y
      };
    }
    // Reset node position to prevent visual jump
    e.target.x(0);
    e.target.y(0);
    onDragStart?.(e);
  };

  const handleMaskedDragMove = (e: any) => {
    // Get current pointer position and calculate the layer's new position
    const stage = e.target.getStage();
    const pointerPos = stage?.getPointerPosition();
    if (pointerPos && dragStartPosRef.current) {
      const newX = pointerPos.x - dragStartPosRef.current.x;
      const newY = pointerPos.y - dragStartPosRef.current.y;
      // Update layer position directly for responsive feedback
      updateLayer(layer.id, { x: newX, y: newY });
    }
    // Keep the Konva node at origin since we're handling position in the canvas
    e.target.x(0);
    e.target.y(0);
    onDragMove?.(e);
  };

  const handleMaskedDragEnd = (e: any) => {
    // Get final pointer position
    const stage = e.target.getStage();
    const pointerPos = stage?.getPointerPosition();
    if (pointerPos && dragStartPosRef.current) {
      const newX = pointerPos.x - dragStartPosRef.current.x;
      const newY = pointerPos.y - dragStartPosRef.current.y;
      updateLayer(layer.id, { x: newX, y: newY });
    }
    dragStartPosRef.current = null;
    // Reset node position
    e.target.x(0);
    e.target.y(0);
    onDragEnd?.(e);
  };

  // If using template mask and we have a masked canvas, render it
  if (layer.useTemplateMask && maskedCanvas) {
    return (
      <KonvaImage
        id={id || layer.id}
        x={0}
        y={0}
        image={maskedCanvas}
        rotation={0}
        scaleX={1}
        scaleY={1}
        opacity={layer.opacity}
        visible={layer.visible}
        listening={!layer.locked}
        onClick={onClick}
        onTap={onTap}
        onDragStart={handleMaskedDragStart}
        onDragMove={handleMaskedDragMove}
        onDragEnd={handleMaskedDragEnd} 
        // Disable transform for masked images (use properties panel instead)
        onTransformStart={undefined}
        onTransformEnd={undefined}
        draggable={draggable}
      />
    );
  }

  // Normal rendering without mask
  return (
    <KonvaImage
      id={id || layer.id}
      x={layer.x}
      y={layer.y}
      image={image}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={layer.opacity}
      visible={layer.visible}
      listening={!layer.locked}
      cropX={layer.cropX}
      cropY={layer.cropY}
      cropWidth={layer.cropWidth}
      cropHeight={layer.cropHeight}
      onClick={onClick}
      onTap={onTap}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTransformStart={onTransformStart}
      onTransformEnd={onTransformEnd}
      draggable={draggable}
    />
  );
};

