import { useEffect, useRef } from 'react';
import RichEditor from './RichEditor';

interface Props {
  title: string;
  content: string;
  onChange: (content: string) => void;
  onClose: () => void;
  position: { x: number; y: number }; // percentage position of the token
  containerSize: number; // map container size in px
}

export default function TokenNotePopover({ title, content, onChange, onClose, position, containerSize }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid closing immediately from the click that opened it
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Position the popover near the token but keep it within bounds
  const popoverWidth = 280;
  const pxX = position.x * containerSize;
  const pxY = position.y * containerSize;
  const left = pxX + 20 + popoverWidth > containerSize ? pxX - popoverWidth - 10 : pxX + 20;
  const top = Math.max(10, Math.min(pxY - 30, containerSize - 250));

  return (
    <div
      ref={ref}
      className="token-note-popover"
      style={{ left: `${left}px`, top: `${top}px` }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="token-note-header">
        <span>{title}</span>
        <button className="token-note-close" onClick={onClose}>✕</button>
      </div>
      <RichEditor
        content={content}
        onChange={onChange}
        placeholder="Add notes for this token..."
        compact
      />
    </div>
  );
}
