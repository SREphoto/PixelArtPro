
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  PencilIcon, EraserIcon, DropperIcon, MagicWandIcon, SelectionIcon, UndoIcon, RedoIcon, LayersIcon, PaletteIcon,
  PlusIcon, TrashIcon, EyeOpenIcon, EyeClosedIcon, SaveIcon, SparklesIcon, HandIcon, GridIcon, SymmetryHorizontalIcon,
  ZoomInIcon, ZoomOutIcon, MergeDownIcon, BucketIcon, LineIcon, RectangleIcon, MoveIcon,
  DuplicateIcon, FlipHorizontalIcon, BanIcon, ImageIcon, XIcon, FileUpIcon, GrabIcon, LightenIcon, ColorReplaceIcon,
  SymmetryVerticalIcon,
} from './icons';
import { generateAIPalette } from '../services/geminiService';

export type Tool = 'pencil' | 'eraser' | 'picker' | 'select' | 'magic-edit' | 'pan' | 'bucket' | 'line' | 'rectangle' | 'move' | 'lighten' | 'darken' | 'replace';
export type SymmetryMode = 'none' | 'horizontal' | 'vertical';

export interface Layer {
  id: string;
  name: string;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  isVisible: boolean;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  offset: { x: number, y: number };
}

export interface Frame {
  id: string;
  layers: Layer[];
  duration: number; // in ms
}

export interface EditorState {
  sourceImage: HTMLImageElement;
  frames: Frame[];
  currentFrameIndex: number;
  history: any[];
  historyIndex: number;
}

interface EditorProps {
  initialState: EditorState;
  onSave: (dataUrl: string) => void;
}

// UTILS
const createLayer = (id: string, name: string, width: number, height: number): Layer => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  return { id, name, canvas, context, isVisible: true, opacity: 1, blendMode: 'source-over', offset: { x: 0, y: 0 } };
};

const createFrame = (width: number, height: number): Frame => ({
  id: crypto.randomUUID(),
  layers: [createLayer(crypto.randomUUID(), 'Layer 1', width, height)],
  duration: 100
});

const hexToRgba = (hex: string): [number, number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return [r, g, b, 255];
};

const rgbaToHex = (r: number, g: number, b: number): string => {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const BLEND_MODES: GlobalCompositeOperation[] = [
  'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference',
  'exclusion', 'hue', 'saturation', 'color', 'luminosity'
];

// Color Quantization using Median Cut
const quantizeColors = (imageData: ImageData, count: number): string[] => {
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < imageData.data.length; i += 4) {
    if (imageData.data[i + 3] > 128) { // Only consider opaque pixels
      pixels.push([imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]]);
    }
  }

  if (pixels.length === 0) return [];
  if (new Set(pixels.map(p => rgbaToHex(p[0], p[1], p[2]))).size <= count) {
    return Array.from(new Set(pixels.map(p => rgbaToHex(p[0], p[1], p[2]))));
  }

  const buckets: [number, number, number][][] = [pixels];

  while (buckets.length < count) {
    let largestBucketIndex = -1;
    let largestRange = -1;

    buckets.forEach((bucket, i) => {
      if (bucket.length > 1) {
        let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
        bucket.forEach(([r, g, b]) => {
          minR = Math.min(minR, r); maxR = Math.max(maxR, r);
          minG = Math.min(minG, g); maxG = Math.max(maxG, g);
          minB = Math.min(minB, b); maxB = Math.max(maxB, b);
        });
        const range = Math.max(maxR - minR, maxG - minG, maxB - minB);
        if (range > largestRange) {
          largestRange = range;
          largestBucketIndex = i;
        }
      }
    });

    if (largestBucketIndex === -1) break;

    const bucketToSort = buckets[largestBucketIndex];
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    bucketToSort.forEach(([r, g, b]) => {
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minG = Math.min(minG, g); maxG = Math.max(maxG, g);
      minB = Math.min(minB, b); maxB = Math.max(maxB, b);
    });

    const rRange = maxR - minR;
    const gRange = maxG - minG;
    const bRange = maxB - minB;

    let sortAxis = 0; // 0=R, 1=G, 2=B
    if (gRange >= rRange && gRange >= bRange) sortAxis = 1;
    else if (bRange >= rRange && bRange >= gRange) sortAxis = 2;

    bucketToSort.sort((a, b) => a[sortAxis] - b[sortAxis]);

    const mid = Math.floor(bucketToSort.length / 2);
    const newBucket1 = bucketToSort.slice(0, mid);
    const newBucket2 = bucketToSort.slice(mid);
    buckets.splice(largestBucketIndex, 1, newBucket1, newBucket2);
  }

  const palette: string[] = [];
  buckets.forEach(bucket => {
    if (bucket.length > 0) {
      const avgR = Math.round(bucket.reduce((sum, p) => sum + p[0], 0) / bucket.length);
      const avgG = Math.round(bucket.reduce((sum, p) => sum + p[1], 0) / bucket.length);
      const avgB = Math.round(bucket.reduce((sum, p) => sum + p[2], 0) / bucket.length);
      palette.push(rgbaToHex(avgR, avgG, avgB));
    }
  });

  return Array.from(new Set(palette)); // Remove duplicates
}


// EDITOR COMPONENT
const Editor: React.FC<EditorProps> = ({ initialState, onSave }) => {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const [frames, setFrames] = useState<Frame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);

  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [primaryColor, setPrimaryColor] = useState('#FFFFFF');
  const [secondaryColor, setSecondaryColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(1);
  const [zoom, setZoom] = useState(4); // Default zoom

  const [historyStack, setHistoryStack] = useState<any[]>([]); // simplified, TODO: robust history for frames
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [isDrawing, setIsDrawing] = useState(false);
  const lastMousePos = useRef<{ x: number, y: number } | null>(null);
  const startMousePos = useRef<{ x: number, y: number } | null>(null);
  const buttonUsed = useRef(0);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });

  const [showGrid, setShowGrid] = useState(true);
  const [showOnionSkin, setShowOnionSkin] = useState(false); // Onion Skin State
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>('none');

  const [palettePrompt, setPalettePrompt] = useState('cyberpunk city');
  const [generatedPalette, setGeneratedPalette] = useState<string[]>([]);
  const [isPaletteLoading, setIsPaletteLoading] = useState(false);

  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);

  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(8);

  // Initialization
  useEffect(() => {
    if (!initialState) return;

    // Safety check for legacy state
    if (initialState.frames && initialState.frames.length > 0) {
      setFrames(initialState.frames);
      setCurrentFrameIndex(initialState.currentFrameIndex || 0);
      // Set active layer to first of current frame if not set
      if (initialState.frames[0].layers.length > 0) {
        setActiveLayerId(initialState.frames[0].layers[0].id);
      }
    } else {
      // Migration from non-frame state
      const { sourceImage } = initialState;
      const initialWidth = sourceImage?.width || 64;
      const initialHeight = sourceImage?.height || 64;

      let initialLayers: Layer[] = [];
      // If legacy state had layers, try to use them? Hard to migrate Canvas contexts
      // Better to check if sourceImage exists and recreate base layer

      if (sourceImage) {
        const baseLayer = createLayer(crypto.randomUUID(), 'Layer 1', initialWidth, initialHeight);
        baseLayer.context.drawImage(sourceImage, 0, 0);
        initialLayers = [baseLayer];
      } else {
        initialLayers = [createLayer(crypto.randomUUID(), 'Layer 1', 64, 64)];
      }

      const initialFrame: Frame = {
        id: crypto.randomUUID(),
        layers: initialLayers,
        duration: 100
      };

      setFrames([initialFrame]);
      setCurrentFrameIndex(0);
      setActiveLayerId(initialLayers[0].id);
    }

    const container = canvasContainerRef.current;
    if (container && initialState.sourceImage) {
      const initialZoom = Math.min(8, Math.floor(container.clientWidth / initialState.sourceImage.width / 2));
      setZoom(initialZoom > 0 ? initialZoom : 1);
    }
  }, [initialState]);


  // Helpers to get current active data
  const currentFrame = useMemo(() => frames[currentFrameIndex], [frames, currentFrameIndex]);
  const layers = useMemo(() => currentFrame?.layers || [], [currentFrame]);
  const activeLayer = useMemo(() => layers.find(l => l.id === activeLayerId), [layers, activeLayerId]);

  const canvasWidth = initialState.sourceImage?.width || 64;
  const canvasHeight = initialState.sourceImage?.height || 64;

  const updateCurrentFrameLayers = (newLayers: Layer[]) => {
    setFrames(prev => prev.map((f, i) => i === currentFrameIndex ? { ...f, layers: newLayers } : f));
  };

  const recordHistory = useCallback(() => {
    // Placeholder for robust history. 
    // Snapshotting entire frame state with canvases is heavy.
    // For now, we skip history implementation on this refactor step to focus on structure.
  }, []);

  // Removed history logic mostly for this pass as it needs deep cloning of all frames

  const handleUndo = () => { };
  const handleRedo = () => { };

  const drawPixel = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number) => {
    ctx.fillStyle = color;
    const offset = Math.floor((size - 1) / 2);

    const drawX = Math.floor(x - offset);
    const drawY = Math.floor(y - offset);
    ctx.fillRect(drawX, drawY, size, size);

    if (symmetryMode === 'horizontal') {
      const mirroredX = Math.floor((canvasWidth - 1 - x) - offset);
      if (mirroredX !== drawX) ctx.fillRect(mirroredX, drawY, size, size);
    } else if (symmetryMode === 'vertical') {
      const mirroredY = Math.floor((canvasHeight - 1 - y) - offset);
      if (mirroredY !== drawY) ctx.fillRect(drawX, mirroredY, size, size);
    }
  }, [symmetryMode, canvasWidth, canvasHeight]);

  const drawLine = useCallback((ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, size: number, operation?: GlobalCompositeOperation) => {
    if (operation) ctx.globalCompositeOperation = operation;
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, e2;

    for (; ;) {
      drawPixel(ctx, x0, y0, color, size);
      if (x0 === x1 && y0 === y1) break;
      e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    if (operation) ctx.globalCompositeOperation = activeLayer?.blendMode || 'source-over';
  }, [drawPixel, activeLayer]);

  const drawRectangle = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, size: number) => {
    const x_start = Math.min(x0, x1);
    const x_end = Math.max(x0, x1);
    const y_start = Math.min(y0, y1);
    const y_end = Math.max(y0, y1);

    drawLine(ctx, x_start, y_start, x_end, y_start, color, size);
    drawLine(ctx, x_end, y_start, x_end, y_end, color, size);
    drawLine(ctx, x_end, y_end, x_start, y_end, color, size);
    drawLine(ctx, x_start, y_end, x_start, y_start, color, size);
  }

  const replaceColor = useCallback((ctx: CanvasRenderingContext2D, targetColor: number[], replacementColor: number[]) => {
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === targetColor[0] && data[i + 1] === targetColor[1] && data[i + 2] === targetColor[2] && data[i + 3] === targetColor[3]) {
        data[i] = replacementColor[0];
        data[i + 1] = replacementColor[1];
        data[i + 2] = replacementColor[2];
        data[i + 3] = replacementColor[3];
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [canvasWidth, canvasHeight]);


  const floodFill = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, color: string, isMirrorCall = false) => {
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;
    const fillColorRgba = hexToRgba(color);
    const startPos = (y * canvasWidth + x) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    if (fillColorRgba[0] === startR && fillColorRgba[1] === startG && fillColorRgba[2] === startB && fillColorRgba[3] === startA) return;

    const pixelStack: [number, number][] = [[x, y]];

    while (pixelStack.length > 0) {
      const [currentX, currentY] = pixelStack.pop()!;
      let currentPos = (currentY * canvasWidth + currentX) * 4;

      if (currentX < 0 || currentX >= canvasWidth || currentY < 0 || currentY >= canvasHeight ||
        data[currentPos] !== startR || data[currentPos + 1] !== startG || data[currentPos + 2] !== startB || data[currentPos + 3] !== startA) {
        continue;
      }

      data[currentPos] = fillColorRgba[0];
      data[currentPos + 1] = fillColorRgba[1];
      data[currentPos + 2] = fillColorRgba[2];
      data[currentPos + 3] = fillColorRgba[3];

      pixelStack.push([currentX + 1, currentY]);
      pixelStack.push([currentX - 1, currentY]);
      pixelStack.push([currentX, currentY + 1]);
      pixelStack.push([currentX, currentY - 1]);
    }
    ctx.putImageData(imageData, 0, 0);

    if (!isMirrorCall && symmetryMode !== 'none') {
      let mirroredX = x;
      let mirroredY = y;
      if (symmetryMode === 'horizontal') {
        mirroredX = canvasWidth - 1 - x;
      } else if (symmetryMode === 'vertical') {
        mirroredY = canvasHeight - 1 - y;
      }
      if (mirroredX !== x || mirroredY !== y) {
        floodFill(ctx, mirroredX, mirroredY, color, true);
      }
    }
  }, [canvasWidth, canvasHeight, symmetryMode]);


  const getMousePosOnCanvas = (e: React.MouseEvent<HTMLDivElement>): { x: number, y: number } => {
    const rect = mainCanvasRef.current!.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeLayer) return;
    const pos = getMousePosOnCanvas(e);
    setIsDrawing(true);
    lastMousePos.current = pos;
    startMousePos.current = pos;
    buttonUsed.current = e.button;

    if (activeTool === 'pan') return;

    const ctx = activeLayer.context;

    switch (activeTool) {
      case 'pencil':
        const color = e.button === 2 ? secondaryColor : primaryColor; // Right click for secondary
        drawLine(ctx, pos.x, pos.y, pos.x, pos.y, color, brushSize);
        break;
      case 'eraser':
        drawLine(ctx, pos.x, pos.y, pos.x, pos.y, '', brushSize, 'destination-out');
        break;
      case 'picker':
        const compositeCtx = mainCanvasRef.current?.getContext('2d');
        if (compositeCtx) {
          const pixel = compositeCtx.getImageData(pos.x, pos.y, 1, 1).data;
          const hex = rgbaToHex(pixel[0], pixel[1], pixel[2]);
          if (e.button === 2) setSecondaryColor(hex);
          else setPrimaryColor(hex);
        }
        break;
      case 'bucket':
        floodFill(ctx, pos.x, pos.y, primaryColor, false);
        break;
      case 'replace': {
        const targetPixel = ctx.getImageData(pos.x, pos.y, 1, 1).data;
        const targetColor = [targetPixel[0], targetPixel[1], targetPixel[2], targetPixel[3]];
        const replacementColor = [...hexToRgba(primaryColor)];
        replaceColor(ctx, targetColor, replacementColor);
        break;
      }
    }

    updateCurrentFrameLayers([...layers]); // Trigger redraw
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !activeLayer) return;
    const pos = getMousePosOnCanvas(e);

    if (activeTool === 'pan') {
      if (lastMousePos.current) {
        setViewOffset(prev => ({ x: prev.x + (e.clientX - lastMousePos.current!.x), y: prev.y + (e.clientY - lastMousePos.current!.y) }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      } else {
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    const ctx = activeLayer.context;

    const previewCtx = previewCanvasRef.current?.getContext('2d');
    if (previewCtx) {
      previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      const color = buttonUsed.current === 2 ? secondaryColor : primaryColor;
      if (activeTool === 'line') {
        drawLine(previewCtx, startMousePos.current!.x, startMousePos.current!.y, pos.x, pos.y, color, brushSize);
      } else if (activeTool === 'rectangle') {
        drawRectangle(previewCtx, startMousePos.current!.x, startMousePos.current!.y, pos.x, pos.y, color, brushSize);
      }
    }


    switch (activeTool) {
      case 'pencil':
        const color = e.buttons === 2 ? secondaryColor : primaryColor;
        drawLine(ctx, lastMousePos.current!.x, lastMousePos.current!.y, pos.x, pos.y, color, brushSize);
        break;
      case 'eraser':
        drawLine(ctx, lastMousePos.current!.x, lastMousePos.current!.y, pos.x, pos.y, '', brushSize, 'destination-out');
        break;
      case 'lighten':
      case 'darken':
        const operation = activeTool === 'lighten' ? 'lighten' : 'darken';
        const gradColor = activeTool === 'lighten' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        drawLine(ctx, lastMousePos.current!.x, lastMousePos.current!.y, pos.x, pos.y, gradColor, brushSize, operation);
        break;
      case 'move':
        if (lastMousePos.current) {
          const dx = pos.x - lastMousePos.current.x;
          const dy = pos.y - lastMousePos.current.y;
          handleLayerPropChange(activeLayer.id, { offset: { x: activeLayer.offset.x + dx, y: activeLayer.offset.y + dy } });
        }
        break;
    }

    lastMousePos.current = pos;
    updateCurrentFrameLayers([...layers]); // Trigger redraw
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      if (activeLayer) {
        const previewCtx = previewCanvasRef.current?.getContext('2d');
        if (previewCtx) previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);

        const ctx = activeLayer.context;
        const color = buttonUsed.current === 2 ? secondaryColor : primaryColor;

        if (activeTool === 'line') {
          drawLine(ctx, startMousePos.current!.x, startMousePos.current!.y, lastMousePos.current!.x, lastMousePos.current!.y, color, brushSize);
        } else if (activeTool === 'rectangle') {
          drawRectangle(ctx, startMousePos.current!.x, startMousePos.current!.y, lastMousePos.current!.x, lastMousePos.current!.y, color, brushSize);
        }
      }

      if (isDrawing && activeTool !== 'pan' && activeTool !== 'picker') {
        if (activeTool === 'move' && activeLayer) {
          const { offset, canvas, context } = activeLayer;
          if (offset.x !== 0 || offset.y !== 0) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            tempCanvas.getContext('2d')!.drawImage(canvas, 0, 0);
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(tempCanvas, offset.x, offset.y);
            handleLayerPropChange(activeLayer.id, { offset: { x: 0, y: 0 } });
          }
        }
        recordHistory();
      }
    }
    setIsDrawing(false);
    lastMousePos.current = null;
    startMousePos.current = null;
  };

  const handleAddLayer = () => {
    const newLayer = createLayer(crypto.randomUUID(), `Layer ${layers.length + 1}`, canvasWidth, canvasHeight);
    const activeIndex = layers.findIndex(l => l.id === activeLayerId);
    const newLayers = [...layers.slice(0, activeIndex + 1), newLayer, ...layers.slice(activeIndex + 1)];
    updateCurrentFrameLayers(newLayers);
    setActiveLayerId(newLayer.id);
    recordHistory();
  };

  const handleDeleteLayer = () => {
    if (layers.length <= 1) return;
    const activeIndex = layers.findIndex(l => l.id === activeLayerId);
    const newLayers = layers.filter(l => l.id !== activeLayerId);
    let newActiveId = null;
    if (newLayers.length > 0) {
      newActiveId = newLayers[Math.max(0, activeIndex - 1)].id;
    }
    updateCurrentFrameLayers(newLayers);
    setActiveLayerId(newActiveId);
    recordHistory();
  }

  const handleDuplicateLayer = () => {
    if (!activeLayer) return;
    const newLayer = createLayer(crypto.randomUUID(), `${activeLayer.name} Copy`, canvasWidth, canvasHeight);
    newLayer.context.drawImage(activeLayer.canvas, 0, 0);
    const activeIndex = layers.findIndex(l => l.id === activeLayerId);
    const newLayers = [...layers.slice(0, activeIndex + 1), newLayer, ...layers.slice(activeIndex + 1)];
    updateCurrentFrameLayers(newLayers);
    setActiveLayerId(newLayer.id);
    recordHistory();
  };

  const handleClearLayer = () => {
    if (!activeLayer) return;
    activeLayer.context.clearRect(0, 0, canvasWidth, canvasHeight);
    updateCurrentFrameLayers([...layers]);
    recordHistory();
  }

  const handleFlipHorizontal = () => {
    if (!activeLayer) return;
    const { context, canvas } = activeLayer;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(canvas, 0, 0);

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(-1, 1);
    context.drawImage(tempCanvas, -canvas.width, 0);
    context.restore();

    updateCurrentFrameLayers([...layers]);
    recordHistory();
  }

  const handleMergeDown = () => {
    const activeIndex = layers.findIndex(l => l.id === activeLayerId);
    if (!activeLayer || activeIndex <= 0) return;

    const layerToMerge = layers[activeIndex];
    const layerBelow = layers[activeIndex - 1];

    layerBelow.context.globalAlpha = layerToMerge.opacity;
    layerBelow.context.globalCompositeOperation = layerToMerge.blendMode;
    layerBelow.context.drawImage(layerToMerge.canvas, layerToMerge.offset.x, layerToMerge.offset.y);
    layerBelow.context.globalAlpha = 1.0;
    layerBelow.context.globalCompositeOperation = 'source-over';

    const newLayers = layers.filter(l => l.id !== activeLayerId);
    updateCurrentFrameLayers(newLayers);
    setActiveLayerId(layerBelow.id);
    recordHistory();
  };

  const handleLayerPropChange = (id: string, prop: Partial<Omit<Layer, 'id' | 'canvas' | 'context'>>) => {
    updateCurrentFrameLayers(layers.map(l => (l.id === id ? { ...l, ...prop } : l)));
  };

  const handleFinishRename = () => {
    if (renamingLayerId && renameInputRef.current) {
      handleLayerPropChange(renamingLayerId, { name: renameInputRef.current.value });
    }
    setRenamingLayerId(null);
  }

  const handleDrop = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const newLayers = [...layers];
    const [draggedItem] = newLayers.splice(dragItem.current, 1);
    newLayers.splice(dragOverItem.current, 0, draggedItem);
    updateCurrentFrameLayers(newLayers);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  useEffect(() => {
    if (renamingLayerId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingLayerId]);

  const handleExport = (scale: number) => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasWidth * scale;
    tempCanvas.height = canvasHeight * scale;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.imageSmoothingEnabled = false;

    // Export Current Frame or All Frames? 
    // Default to Current Frame for now
    layers.forEach(layer => {
      if (layer.isVisible) {
        tempCtx.globalAlpha = layer.opacity;
        tempCtx.globalCompositeOperation = layer.blendMode;
        tempCtx.drawImage(layer.canvas, 0, 0, tempCanvas.width, tempCanvas.height);
      }
    });

    onSave(tempCanvas.toDataURL('image/png'));
    setIsExportModalOpen(false);
  };

  const handleImportImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const newLayer = createLayer(crypto.randomUUID(), file.name.substring(0, 20), canvasWidth, canvasHeight);
        newLayer.context.drawImage(img, 0, 0, canvasWidth, canvasHeight);
        const activeIndex = layers.findIndex(l => l.id === activeLayerId);
        const newLayers = [...layers.slice(0, activeIndex + 1), newLayer, ...layers.slice(activeIndex + 1)];
        updateCurrentFrameLayers(newLayers);
        setActiveLayerId(newLayer.id);
        recordHistory();
      }
      img.src = e.target?.result as string;
    }
    reader.readAsDataURL(file);
  }

  const handleExtractPalette = () => {
    if (!activeLayer) return;
    const imageData = activeLayer.context.getImageData(0, 0, canvasWidth, canvasHeight);
    const quantized = quantizeColors(imageData, 24);
    setGeneratedPalette(quantized);
  }

  // -- Animation Handlers --
  const handleDuplicateFrame = () => {
    if (!currentFrame) return;

    const newLayers = currentFrame.layers.map(l => {
      const newLayer = createLayer(crypto.randomUUID(), l.name, canvasWidth, canvasHeight);
      newLayer.context.drawImage(l.canvas, 0, 0);
      return newLayer;
    });

    const newFrame: Frame = {
      id: crypto.randomUUID(),
      layers: newLayers,
      duration: currentFrame.duration
    };

    setFrames(prev => [...prev.slice(0, currentFrameIndex + 1), newFrame, ...prev.slice(currentFrameIndex + 1)]);
    setCurrentFrameIndex(i => i + 1);
  };

  const handleAddFrame = () => {
    const newFrame = createFrame(canvasWidth, canvasHeight);
    setFrames(prev => [...prev, newFrame]);
    setCurrentFrameIndex(frames.length); // go to new frame
  };

  const handleDeleteFrame = () => {
    if (frames.length <= 1) return;
    const newFrames = frames.filter((_, i) => i !== currentFrameIndex);
    setFrames(newFrames);
    setCurrentFrameIndex(Math.max(0, currentFrameIndex - 1));
  };

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentFrameIndex(i => (i + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [isPlaying, fps, frames.length]);


  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const keyMap: { [key: string]: Tool } = {
        'p': 'pencil', 'e': 'eraser', 'g': 'bucket', 'l': 'line', 'r': 'rectangle', 'm': 'move', 'h': 'pan', 'i': 'picker', 'b': 'lighten'
      };
      if (keyMap[e.key.toLowerCase()]) {
        setActiveTool(keyMap[e.key.toLowerCase()]);
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'Z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);


  // Redraw main canvas and grid canvas
  useEffect(() => {
    const canvas = mainCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const grid = gridCanvasRef.current;
    const gridCtx = grid?.getContext('2d');
    if (!canvas || !ctx || !grid || !gridCtx) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    grid.width = canvasWidth;
    grid.height = canvasHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Onion Skin Rendering (Previous Frame)
    if (showOnionSkin && currentFrameIndex > 0) {
      const prevFrame = frames[currentFrameIndex - 1];
      ctx.globalAlpha = 0.3; // Faint opacity
      prevFrame.layers.forEach(layer => {
        if (layer.isVisible) {
          ctx.globalCompositeOperation = layer.blendMode;
          ctx.drawImage(layer.canvas, layer.offset.x, layer.offset.y);
        }
      });
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
    }

    layers.forEach(layer => {
      if (layer.isVisible) {
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blendMode;
        ctx.drawImage(layer.canvas, layer.offset.x, layer.offset.y);
      }
    });

    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    gridCtx.clearRect(0, 0, grid.width, grid.height);
    if (showGrid) {
      gridCtx.strokeStyle = 'rgba(128,128,128,0.5)';
      gridCtx.lineWidth = 1;
      ctx.imageSmoothingEnabled = false;
      gridCtx.imageSmoothingEnabled = false;

      gridCtx.beginPath();
      for (let x = 1; x < canvasWidth; x++) {
        gridCtx.moveTo(x + 0.5, 0);
        gridCtx.lineTo(x + 0.5, canvasHeight);
      }
      for (let y = 1; y < canvasHeight; y++) {
        gridCtx.moveTo(0, y + 0.5);
        gridCtx.lineTo(canvasWidth, y + 0.5);
      }
      gridCtx.stroke();
    }

  }, [layers, showGrid, zoom, canvasWidth, canvasHeight]);


  if (!currentFrame || !activeLayer) {
    return <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400">Loading Editor...</div>;
  }

  const activeLayerIndex = layers.findIndex(l => l.id === activeLayerId);
  const reversedLayers = useMemo(() => [...layers].reverse(), [layers]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-900/50 border-2 border-slate-700 rounded-lg shadow-lg overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      {/* Top Toolbar */}
      <div className="flex items-center justify-between p-1 bg-slate-800 border-b-2 border-slate-700">
        <div className="flex items-center gap-1">
          <button title="Undo (Ctrl+Z)" onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 rounded-md hover:bg-slate-700 disabled:opacity-50"><UndoIcon className="w-5 h-5" /></button>
          <button title="Redo (Ctrl+Y)" onClick={handleRedo} disabled={historyIndex >= historyStack.length - 1} className="p-2 rounded-md hover:bg-slate-700 disabled:opacity-50"><RedoIcon className="w-5 h-5" /></button>
        </div>
        <div className="text-sm font-bold text-slate-400">Pixel Art Studio</div>
        <button onClick={() => setIsExportModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500 text-slate-900 font-bold rounded-md hover:bg-cyan-400 text-sm">
          <SaveIcon className="w-4 h-4" /> Save & Close
        </button>
      </div>

      <div className="flex-grow flex min-h-0">
        {/* Left Toolbar */}
        <div className="w-24 flex flex-col items-center gap-1 p-2 bg-slate-800/50 border-r-2 border-slate-700 overflow-y-auto">
          {[
            { tool: 'pencil', icon: PencilIcon, label: 'Pencil (P)' },
            { tool: 'eraser', icon: EraserIcon, label: 'Eraser (E)' },
            { tool: 'bucket', icon: BucketIcon, label: 'Bucket (G)' },
            { tool: 'line', icon: LineIcon, label: 'Line (L)' },
            { tool: 'rectangle', icon: RectangleIcon, label: 'Rectangle (R)' },
            { tool: 'replace', icon: ColorReplaceIcon, label: 'Replace' },
            { tool: 'lighten', icon: LightenIcon, label: 'Lighten (B)' },
            { tool: 'picker', icon: DropperIcon, label: 'Picker (I)' },
            { tool: 'move', icon: MoveIcon, label: 'Move (M)' },
            { tool: 'pan', icon: HandIcon, label: 'Pan (H)' },
          ].map(({ tool, icon: Icon, label }) => (
            <button key={tool} title={label} onClick={() => setActiveTool(tool as Tool)}
              className={`flex flex-col items-center p-2 rounded-md w-full ${activeTool === tool ? 'bg-fuchsia-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
              <Icon className="w-6 h-6 mx-auto" />
              <span className="text-[10px] mt-1">{label.split('(')[0]}</span>
            </button>
          ))}
          <div className="mt-auto flex relative py-2">
            <label htmlFor="secondary-color" className="block w-8 h-8 rounded-md border-2 border-slate-500 cursor-pointer absolute top-4 left-2 z-0" style={{ backgroundColor: secondaryColor }} />
            <input id="secondary-color" type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="opacity-0 w-0 h-0" />
            <label htmlFor="primary-color" className="block w-10 h-10 rounded-md border-2 border-slate-500 cursor-pointer relative z-10" style={{ backgroundColor: primaryColor }} />
            <input id="primary-color" type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="opacity-0 w-0 h-0" />
          </div>
          <div className="w-full px-1 mt-2">
            <label className="text-xs text-slate-400">Size: {brushSize}</label>
            <input type="range" min="1" max="32" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-full" />
          </div>
        </div>

        {/* Main Canvas Area */}
        <div ref={canvasContainerRef} className="flex-grow flex flex-col">
          <div className="flex-grow flex items-center justify-center bg-slate-800 overflow-hidden relative cursor-crosshair" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <div style={{ transform: `translate(${viewOffset.x}px, ${viewOffset.y}px)`, imageRendering: 'pixelated' }}>
              <div className="bg-grid-pattern" style={{ width: canvasWidth * zoom, height: canvasHeight * zoom, position: 'relative' }}>
                <canvas ref={mainCanvasRef} className="absolute top-0 left-0" style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }} width={canvasWidth} height={canvasHeight} />
                <canvas ref={gridCanvasRef} className="absolute top-0 left-0 pointer-events-none" style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }} width={canvasWidth} height={canvasHeight} />
                <canvas ref={previewCanvasRef} className="absolute top-0 left-0 pointer-events-none" style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }} width={canvasWidth} height={canvasHeight} />
              </div>
            </div>
          </div>

          {/* Timeline UI */}
          <div className="h-24 bg-slate-900 border-t-2 border-slate-700 flex flex-col">
            <div className="flex items-center gap-2 p-1 border-b border-slate-700 bg-slate-800 text-xs">
              <button onClick={() => setIsPlaying(p => !p)} className={`p-1 w-8 flex items-center justify-center rounded ${isPlaying ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                {isPlaying ? '||' : '>'}
              </button>
              <span>FPS: {fps}</span>
              <input type="range" min="1" max="24" value={fps} onChange={e => setFps(parseInt(e.target.value))} className="w-24" />
              <div className="flex-grow" />
              <button onClick={handleDuplicateFrame} className="p-1 hover:bg-slate-700 rounded" title="Duplicate Frame"><DuplicateIcon className="w-4 h-4" /></button>
              <button onClick={handleAddFrame} className="p-1 hover:bg-slate-700 rounded" title="New Frame"><PlusIcon className="w-4 h-4" /></button>
              <button onClick={handleDeleteFrame} className="p-1 hover:bg-slate-700 rounded text-red-400" title="Delete Frame"><TrashIcon className="w-4 h-4" /></button>
            </div>
            <div className="flex-grow overflow-x-auto flex items-center gap-1 p-2 text-xs">
              {frames.map((frame, idx) => (
                <div key={frame.id} onClick={() => setCurrentFrameIndex(idx)}
                  className={`flex-shrink-0 w-16 h-16 flex flex-col items-center justify-center border-2 rounded bg-slate-800 cursor-pointer ${currentFrameIndex === idx ? 'border-cyan-400 bg-slate-700' : 'border-slate-600 hover:border-slate-500'}`}>
                  <span className="text-slate-500 font-bold">{idx + 1}</span>
                  <span className="text-[10px] text-slate-500">{frame.layers.length} lyrs</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panels */}
        <div className="w-72 flex flex-col bg-slate-800/50 p-2 gap-2 overflow-y-auto border-l-2 border-slate-700">
          {/* Layers Panel */}
          <div>
            <div className="flex items-center justify-between mb-2"> <h3 className="text-sm font-bold flex items-center gap-2"><LayersIcon className="w-4 h-4" />Layers</h3></div>
            <ul className="space-y-1 bg-slate-900/50 p-1 rounded-md">
              {reversedLayers.map((layer) => {
                const originalIndex = layers.findIndex(l => l.id === layer.id);
                return (
                  <li key={layer.id} draggable onDragStart={() => dragItem.current = originalIndex} onDragEnter={() => dragOverItem.current = originalIndex} onDragEnd={handleDrop} onDragOver={e => e.preventDefault()}
                    onClick={() => setActiveLayerId(layer.id)} onDoubleClick={() => setRenamingLayerId(layer.id)}
                    className={`p-1.5 rounded-md text-sm cursor-pointer flex items-center gap-2 ${activeLayerId === layer.id ? 'bg-fuchsia-600/40 border-fuchsia-500 border-2' : 'bg-slate-700/50 border-2 border-transparent'}`}>
                    <GrabIcon className="w-4 h-4 text-slate-500 cursor-grab" />
                    <button onClick={(e) => { e.stopPropagation(); handleLayerPropChange(layer.id, { isVisible: !layer.isVisible }); }}>{layer.isVisible ? <EyeOpenIcon className="w-4 h-4" /> : <EyeClosedIcon className="w-4 h-4" />}</button>
                    <div className="flex-grow overflow-hidden">
                      {renamingLayerId === layer.id ? (
                        <input ref={renameInputRef} type="text" defaultValue={layer.name} onBlur={handleFinishRename} onKeyDown={e => e.key === 'Enter' && handleFinishRename()} onClick={e => e.stopPropagation()} className="w-full bg-slate-900 text-white p-0 m-0 border-0 rounded text-sm" />
                      ) : (
                        <span className="flex-grow truncate pl-1">{layer.name}</span>
                      )}
                      {activeLayerId === layer.id && (
                        <div className="mt-2 space-y-2">
                          <div>
                            <label className="text-xs text-slate-400">Opacity</label>
                            <input type="range" min="0" max="1" step="0.01" value={layer.opacity} onChange={e => handleLayerPropChange(layer.id, { opacity: parseFloat(e.target.value) })} onClick={e => e.stopPropagation()} className="w-full" />
                          </div>
                          <select value={layer.blendMode} onChange={(e) => handleLayerPropChange(layer.id, { blendMode: e.target.value as GlobalCompositeOperation })} onClick={e => e.stopPropagation()} className="w-full text-xs p-1 bg-slate-800 border border-slate-600 rounded">
                            {BLEND_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="flex gap-1 mt-2 border-t-2 border-slate-700 pt-2 justify-end">
              <label htmlFor="import-image" title="Import Image to New Layer" className="p-1.5 hover:bg-slate-700 rounded cursor-pointer"><FileUpIcon className="w-5 h-5" /></label>
              <input type="file" id="import-image" accept="image/*" className="hidden" onChange={e => e.target.files && handleImportImage(e.target.files[0])} />
              <button title="Add New Layer" onClick={handleAddLayer} className="p-1.5 hover:bg-slate-700 rounded"><PlusIcon className="w-5 h-5" /></button>
              <button title="Duplicate Layer" onClick={handleDuplicateLayer} className="p-1.5 hover:bg-slate-700 rounded"><DuplicateIcon className="w-5 h-5" /></button>
              <button title="Merge Layer Down" onClick={handleMergeDown} disabled={activeLayerIndex <= 0} className="p-1.5 hover:bg-slate-700 rounded disabled:opacity-50"><MergeDownIcon className="w-5 h-5" /></button>
              <button title="Flip Horizontal" onClick={handleFlipHorizontal} className="p-1.5 hover:bg-slate-700 rounded"><FlipHorizontalIcon className="w-5 h-5" /></button>
              <button title="Clear Layer" onClick={handleClearLayer} className="p-1.5 hover:bg-slate-700 rounded"><BanIcon className="w-5 h-5" /></button>
              <button title="Delete Layer" onClick={handleDeleteLayer} disabled={layers.length <= 1} className="p-1.5 hover:bg-slate-700 rounded disabled:opacity-50 text-red-400"><TrashIcon className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="border-t-2 border-slate-700 pt-2">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-2"><PaletteIcon className="w-4 h-4" />AI Palette</h3>
            <div className="flex gap-1">
              <input type="text" value={palettePrompt} onChange={e => setPalettePrompt(e.target.value)} placeholder="e.g. enchanted forest" className="w-full text-xs p-2 bg-slate-700 border-2 border-slate-600 rounded-md" />
              <button onClick={() => { setIsPaletteLoading(true); generateAIPalette(palettePrompt).then(setGeneratedPalette).finally(() => setIsPaletteLoading(false)); }} disabled={isPaletteLoading} className="p-2 bg-fuchsia-600 rounded-md hover:bg-fuchsia-500 disabled:bg-slate-600"> <SparklesIcon className="w-4 h-4" /> </button>
            </div>
            <button onClick={handleExtractPalette} className="text-xs w-full mt-1 p-1 bg-slate-700 hover:bg-slate-600 rounded">Extract Palette from Layer (24 colors)</button>
            <div className="grid grid-cols-8 gap-1 mt-2">
              {generatedPalette.map((color, i) => (<button key={`${color}-${i}`} onClick={() => setPrimaryColor(color)} onContextMenu={(e) => { e.preventDefault(); setSecondaryColor(color); }} style={{ backgroundColor: color }} className="w-full aspect-square rounded-md border-2 border-transparent hover:border-cyan-400" />))}
            </div>
          </div>
          <div className="border-t-2 border-slate-700 pt-2">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-2"><ImageIcon className="w-4 h-4" />Reference</h3>
            <label className="w-full text-xs p-2 bg-slate-700 border-2 border-slate-600 rounded-md text-center cursor-pointer hover:border-cyan-400">
              {referenceImage ? 'Change Reference' : 'Upload Reference'}
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                if (e.target.files?.[0]) {
                  if (referenceImage) URL.revokeObjectURL(referenceImage);
                  setReferenceImage(URL.createObjectURL(e.target.files[0]));
                }
              }} />
            </label>
            {referenceImage && <img src={referenceImage} className="w-full rounded-md mt-2 object-contain max-h-32" />}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between p-1 bg-slate-800 border-t-2 border-slate-700 text-sm">
        <div className="flex items-center gap-2">
          <button title="Zoom Out" onClick={() => setZoom(z => Math.max(1, z / 2))} className="p-1 hover:bg-slate-700 rounded"><ZoomOutIcon className="w-5 h-5" /></button>
          <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button title="Zoom In" onClick={() => setZoom(z => Math.min(64, z * 2))} className="p-1 hover:bg-slate-700 rounded"><ZoomInIcon className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-2">
          <button title="Symmetry Off" onClick={() => setSymmetryMode('none')} className={`p-1 rounded ${symmetryMode === 'none' ? 'text-cyan-400' : 'text-slate-300'}`}><BanIcon className="w-5 h-5" /></button>
          <button title="Horizontal Symmetry" onClick={() => setSymmetryMode('horizontal')} className={`p-1 rounded ${symmetryMode === 'horizontal' ? 'text-cyan-400' : 'text-slate-300'}`}><SymmetryHorizontalIcon className="w-5 h-5" /></button>
          <button title="Vertical Symmetry" onClick={() => setSymmetryMode('vertical')} className={`p-1 rounded ${symmetryMode === 'vertical' ? 'text-cyan-400' : 'text-slate-300'}`}><SymmetryVerticalIcon className="w-5 h-5" /></button>
          <div className="w-px h-5 bg-slate-600 mx-1"></div>
          <button title="Toggle Onion Skin" onClick={() => setShowOnionSkin(s => !s)} className={`p-1 rounded ${showOnionSkin ? 'text-cyan-400' : 'text-slate-400'}`}><EyeOpenIcon className="w-5 h-5 opacity-50" /></button>
          <button title="Toggle Grid" onClick={() => setShowGrid(s => !s)} className={`p-1 rounded ${showGrid ? 'text-cyan-400' : 'text-slate-400'}`}><GridIcon className="w-5 h-5" /></button>
        </div>
        <div className="w-24 text-right text-xs text-slate-400">{canvasWidth} x {canvasHeight}</div>
      </div>

      {isExportModalOpen && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-6 shadow-lg text-white">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Export Image</h2>
              <button onClick={() => setIsExportModalOpen(false)}><XIcon className="w-6 h-6" /></button>
            </div>
            <p className="text-sm text-slate-400 mb-4">Choose an export scale. The image will be saved as a PNG without blurring.</p>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 4, 8].map(scale => (
                <button key={scale} onClick={() => handleExport(scale)} className="p-4 bg-slate-700 hover:bg-cyan-500 hover:text-slate-900 rounded-md font-bold">
                  {scale}x <span className="text-slate-400">({canvasWidth * scale}px)</span>
                </button>
              ))}
            </div>

            <div className="mt-4 border-t border-slate-600 pt-4">
              <h3 className="text-sm font-bold mb-2">Animations</h3>
              <button onClick={async () => {
                const GifEncoder = (await import('gif-encoder-2')).default;
                const encoder = new GifEncoder(canvasWidth, canvasHeight);
                encoder.setDelay(1000 / fps);
                encoder.start();

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvasWidth;
                tempCanvas.height = canvasHeight;
                const tempCtx = tempCanvas.getContext('2d')!;

                frames.forEach(frame => {
                  tempCtx.clearRect(0, 0, canvasWidth, canvasHeight);
                  // Draw layers
                  frame.layers.forEach(l => {
                    if (l.isVisible) tempCtx.drawImage(l.canvas, l.offset.x, l.offset.y);
                  });
                  encoder.addFrame(tempCtx);
                });

                encoder.finish();
                const buffer = encoder.out.getData();
                const blob = new Blob([buffer], { type: 'image/gif' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'pixelart_animation.gif';
                a.click();
                setIsExportModalOpen(false);
              }} className="w-full p-3 bg-fuchsia-600 hover:bg-fuchsia-500 rounded-md font-bold flex items-center justify-center gap-2">
                Download GIF Animation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;
