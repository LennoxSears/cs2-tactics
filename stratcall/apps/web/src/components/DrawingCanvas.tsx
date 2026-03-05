import { useEffect, useRef } from 'react';
import type { Drawing } from '../types';

interface Props {
  drawings: Drawing[];
  width: number;
  height: number;
}

export default function DrawingCanvas({ drawings, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0 || height === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    for (const drawing of drawings) {
      if (drawing.type === 'arrow') {
        drawArrow(
          ctx,
          drawing.start.x * width,
          drawing.start.y * height,
          drawing.end.x * width,
          drawing.end.y * height,
          drawing.color
        );
      } else if (drawing.type === 'freehand') {
        drawFreehand(
          ctx,
          drawing.points.map(p => ({ x: p.x * width, y: p.y * height })),
          drawing.color
        );
      }
    }
  }, [drawings, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="drawing-canvas"
      style={{ pointerEvents: 'none' }}
    />
  );
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string
) {
  const headLen = 14;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

function drawFreehand(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string
) {
  if (points.length < 2) return;

  // Dark outline for contrast against any map color
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  // Bright line on top
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}
