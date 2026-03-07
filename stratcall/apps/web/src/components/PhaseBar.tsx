import { useState } from 'react';
import type { Phase, MapName } from '../types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faBookmark, faDownload, faUpload } from '@fortawesome/free-solid-svg-icons';
import { useLocale } from '../lib/i18n';
import { api } from '../lib/api';
import { exportPhasesToFile, importPhasesFromFile } from '../lib/phaseIO';

interface Props {
  phases: Phase[];
  activeIndex: number;
  mapName: MapName;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onRename: (index: number, name: string) => void;
  onImportPhases?: (phases: Array<{ name: string; boardState: any }>) => void;
}

export default function PhaseBar({ phases, activeIndex, mapName, onSelect, onAdd, onDelete, onRename, onImportPhases }: Props) {
  const { t } = useLocale();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

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

  const savePhaseToLibrary = async (idx: number) => {
    const phase = phases[idx];
    setSavingIdx(idx);
    try {
      await api.post('/phases', {
        name: phase.name,
        mapName,
        boardState: phase.boardState,
        source: 'manual',
        tags: [],
      });
    } catch (err) {
      console.error('Failed to save phase to library:', err);
    } finally {
      setSavingIdx(null);
    }
  };

  const handleExportPhases = () => {
    exportPhasesToFile(
      mapName,
      phases.map(p => ({ name: p.name, boardState: p.boardState })),
    );
  };

  const handleImportPhases = async () => {
    const data = await importPhasesFromFile();
    if (data && onImportPhases) {
      onImportPhases(data.phases);
    }
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
            <button
              className="phase-save-lib"
              title={t('phases.saveToLibrary')}
              disabled={savingIdx === idx}
              onClick={e => { e.stopPropagation(); savePhaseToLibrary(idx); }}
            >
              <FontAwesomeIcon icon={faBookmark} />
            </button>
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
      <div className="phase-bar-actions">
        <button className="phase-action-btn" onClick={handleExportPhases} title={t('phases.exportPhases')}>
          <FontAwesomeIcon icon={faDownload} /> {t('phases.exportPhases')}
        </button>
        <button className="phase-action-btn" onClick={handleImportPhases} title={t('phases.importPhases')}>
          <FontAwesomeIcon icon={faUpload} /> {t('phases.importPhases')}
        </button>
      </div>
    </div>
  );
}
