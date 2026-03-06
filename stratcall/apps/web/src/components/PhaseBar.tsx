import { useState } from 'react';
import type { Phase } from '../types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useLocale } from '../lib/i18n';

interface Props {
  phases: Phase[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onRename: (index: number, name: string) => void;
}

export default function PhaseBar({ phases, activeIndex, onSelect, onAdd, onDelete, onRename }: Props) {
  const { t } = useLocale();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const startRename = (idx: number) => {
    setEditingIdx(idx);
    setEditName(phases[idx].name);
  };

  const finishRename = () => {
    if (editingIdx !== null && editName.trim()) {
      onRename(editingIdx, editName.trim());
    }
    setEditingIdx(null);
  };

  return (
    <div className="phase-bar">
      <div className="phase-bar-label">Phases</div>
      <div className="phase-tabs">
        {phases.map((phase, idx) => (
          <div
            key={phase.id}
            className={`phase-tab ${idx === activeIndex ? 'active' : ''}`}
            onClick={() => onSelect(idx)}
          >
            {editingIdx === idx ? (
              <input
                className="phase-rename-input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={finishRename}
                onKeyDown={e => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setEditingIdx(null); }}
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="phase-tab-name"
                onDoubleClick={e => { e.stopPropagation(); startRename(idx); }}
              >
                {phase.name}
              </span>
            )}
            {phases.length > 1 && (
              <button
                className="phase-delete"
                onClick={e => { e.stopPropagation(); onDelete(idx); }}
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            )}
          </div>
        ))}
        <button className="phase-add" onClick={onAdd} title={t('phases.addPhase')}>
          <FontAwesomeIcon icon={faPlus} />
        </button>
      </div>
    </div>
  );
}
