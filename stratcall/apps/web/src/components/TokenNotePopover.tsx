import { useState, useEffect, useRef } from 'react';
import RichEditor from './RichEditor';
import CommentThread from './CommentThread';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useLocale } from '../lib/i18n';

interface Props {
  title: string;
  content: string;
  onChange: (content: string) => void;
  onClose: () => void;
  onDelete: () => void;
  position: { x: number; y: number };
  containerSize: number;
  strategyId: string;
  tokenId: string;
}

export default function TokenNotePopover({ title, content, onChange, onClose, onDelete, position, containerSize, strategyId, tokenId }: Props) {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [showComments, setShowComments] = useState(false);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const popoverWidth = 300;
  const pxX = position.x * containerSize;
  const pxY = position.y * containerSize;
  const left = pxX + 20 + popoverWidth > containerSize ? pxX - popoverWidth - 10 : pxX + 20;
  const top = Math.max(10, Math.min(pxY - 30, containerSize - 350));

  return (
    <div
      ref={ref}
      className="token-note-popover"
      style={{ left: `${left}px`, top: `${top}px`, width: popoverWidth }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="token-note-header">
        <span>{title}</span>
        <button className="token-note-delete" onClick={() => { onDelete(); onClose(); }} title={t('token.clearNote')}>
          <FontAwesomeIcon icon={faTrash} />
        </button>
        <button className="token-note-close" onClick={onClose}>✕</button>
      </div>
      <div className="token-note-body">
        <RichEditor
          content={content}
          onChange={onChange}
          placeholder={t('token.addNotes')}
          compact
        />
        <details className="token-comments-toggle" open={showComments} onToggle={e => setShowComments((e.target as HTMLDetailsElement).open)}>
          <summary>{t('token.comments')}</summary>
          {showComments && (
            <CommentThread
              strategyId={strategyId}
              targetType="token"
              targetId={tokenId}
              compact
            />
          )}
        </details>
      </div>
    </div>
  );
}
