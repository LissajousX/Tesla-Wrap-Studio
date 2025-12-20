import { Line, Group, Rect } from 'react-konva';
import { useMemo } from 'react';
import type { BrushLayer as BrushLayerType, BrushStroke } from '../../state/editorTypes';

interface BrushLayerProps {
  layer: BrushLayerType;
  id?: string;
  onClick?: (e: any) => void;
  onTap?: (e: any) => void;
  onDragStart?: (e: any) => void;
  onDragEnd?: (e: any) => void;
  onTransformStart?: (e: any) => void;
  onTransformEnd?: (e: any) => void;
  draggable?: boolean;
}

// Render a single stroke with its settings
const StrokeRenderer = ({ stroke, index }: { stroke: BrushStroke; index: number }) => {
  if (!stroke.points || stroke.points.length < 2) return null;

  if (stroke.color === 'transparent') {
    return (
      <Line
        key={index}
        points={stroke.points}
        stroke="#ffffff"
        strokeWidth={stroke.size}
        lineCap="round"
        lineJoin="round"
        tension={0.5}
        globalCompositeOperation="destination-out"
        opacity={stroke.opacity}
      />
    );
  }

  // Calculate shadow blur based on hardness (lower hardness = more blur = softer edge)
  const shadowBlur = stroke.hardness < 100 ? ((100 - stroke.hardness) / 100) * stroke.size * 0.5 : 0;
  
  // Map blend mode to globalCompositeOperation
  type CompositeOp = 'source-over' | 'multiply' | 'screen' | 'overlay';
  const blendModeMap: Record<string, CompositeOp> = {
    'normal': 'source-over',
    'multiply': 'multiply',
    'screen': 'screen',
    'overlay': 'overlay',
  };
  const compositeOp: CompositeOp = blendModeMap[stroke.blendMode] || 'source-over';

  // For soft brushes (hardness < 100), use shadow effect for feathering
  if (shadowBlur > 0) {
    return (
      <Line
        key={index}
        points={stroke.points}
        stroke={stroke.color}
        strokeWidth={stroke.size}
        lineCap="round"
        lineJoin="round"
        tension={0.5}
        opacity={stroke.opacity}
        shadowColor={stroke.color}
        shadowBlur={shadowBlur}
        shadowEnabled={true}
        globalCompositeOperation={compositeOp}
      />
    );
  }

  // Hard brush (hardness = 100)
  return (
    <Line
      key={index}
      points={stroke.points}
      stroke={stroke.color}
      strokeWidth={stroke.size}
      lineCap="round"
      lineJoin="round"
      tension={0.5}
      opacity={stroke.opacity}
      globalCompositeOperation={compositeOp}
    />
  );
};

// Calculate bounding box of all strokes
const calculateBoundingBox = (strokes: BrushStroke[]) => {
  if (strokes.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  strokes.forEach((stroke) => {
    if (!stroke.points || stroke.points.length < 2) return;
    
    const halfStrokeWidth = (stroke.size || 1) / 2;
    
    for (let i = 0; i < stroke.points.length; i += 2) {
      const x = stroke.points[i];
      const y = stroke.points[i + 1];
      
      minX = Math.min(minX, x - halfStrokeWidth);
      minY = Math.min(minY, y - halfStrokeWidth);
      maxX = Math.max(maxX, x + halfStrokeWidth);
      maxY = Math.max(maxY, y + halfStrokeWidth);
    }
  });

  // Add some padding to ensure the hit area is slightly larger than the strokes
  const padding = 10;
  return {
    x: minX - padding,
    y: minY - padding,
    width: (maxX - minX) + padding * 2,
    height: (maxY - minY) + padding * 2,
  };
};

export const BrushLayer = ({ 
  layer,
  id,
  onClick,
  onTap,
  onDragStart,
  onDragEnd,
  onTransformStart,
  onTransformEnd,
  draggable 
}: BrushLayerProps) => {
  const strokes = layer.strokes || [];
  
  // Calculate bounding box for hit area
  const boundingBox = useMemo(() => calculateBoundingBox(strokes), [strokes]);

  if (strokes.length === 0) {
    // Return an invisible placeholder for selection
    return (
      <Group
        id={id || layer.id}
        x={layer.x}
        y={layer.y}
        rotation={layer.rotation}
        scaleX={layer.scaleX}
        scaleY={layer.scaleY}
        opacity={layer.opacity}
        visible={layer.visible}
        listening={!layer.locked}
        onClick={onClick}
        onTap={onTap}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        draggable={draggable}
      >
        <Rect
          x={0}
          y={0}
          width={1}
          height={1}
          fill="transparent"
          listening={true}
        />
      </Group>
    );
  }

  return (
    <Group
      id={id || layer.id}
      x={layer.x}
      y={layer.y}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={layer.opacity}
      visible={layer.visible}
      listening={!layer.locked}
      onClick={onClick}
      onTap={onTap}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTransformStart={onTransformStart}
      onTransformEnd={onTransformEnd}
      draggable={draggable}
    >
      {/* Transparent hit area covering the entire bounding box */}
      <Rect
        x={boundingBox.x}
        y={boundingBox.y}
        width={boundingBox.width}
        height={boundingBox.height}
        fill="transparent"
        listening={true}
        perfectDrawEnabled={false}
      />
      {/* Render all strokes */}
      {strokes.map((stroke, index) => (
        <StrokeRenderer key={index} stroke={stroke} index={index} />
      ))}
    </Group>
  );
};
