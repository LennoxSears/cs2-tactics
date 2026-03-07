import { useState, useEffect, useCallback } from 'react';
import type { MapName } from '../types';
import { maps } from '../maps';
import { api } from '../lib/api';
import { exportPhasesToFile, importPhasesFromFile } from '../lib/phaseIO';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTrash, faDownload, faUpload, faPen, faCheck, faXmark, faFilter,
} from '@fortawesome/free-solid-svg-icons';


interface PhaseRow {
  id: string;
  name: string;
  mapName: MapName;
  boardState: any;
  source: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export default function PhaseLibrary() {
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapFilter, setMapFilter] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchPhases = useCallback(async () => {
    setLoading(true);
    try {
      const query = mapFilter ? `?map=${mapFilter}` : '';
      const data = await api.get<PhaseRow[]>(`/phases${query}`);
      setPhases(data);
    } catch {
      setPhases([]);
    }
    setLoading(false);
  }, [mapFilter]);

  useEffect(() => { fetchPhases(); }, [fetchPhases]);

  const deletePhase = async (id: string) => {
    await api.delete(`/phases/${id}`);
    setPhases(prev => prev.filter(p => p.id !== id));
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const startEdit = (phase: PhaseRow) => {
    setEditingId(phase.id);
    setEditName(phase.name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await api.patch(`/phases/${editingId}`, { name: editName });
    setPhases(prev => prev.map(p => p.id === editingId ? { ...p, name: editName } : p));
    setEditingId(null);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const selectAll = () => {
    if (selected.size === phases.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(phases.map(p => p.id)));
    }
  };

  const exportSelected = () => {
    const toExport = phases.filter(p => selected.has(p.id));
    if (toExport.length === 0) return;
    const mapName = toExport[0].mapName;
    exportPhasesToFile(mapName, toExport.map(p => ({
      name: p.name,
      boardState: p.boardState,
    })));
  };

  const handleImport = async () => {
    const data = await importPhasesFromFile();
    if (!data) return;

    let count = 0;
    for (const phase of data.phases) {
      await api.post('/phases', {
        name: phase.name,
        mapName: data.mapName,
        boardState: phase.boardState,
        source: 'manual',
        tags: [],
      });
      count++;
    }
    alert(`Imported ${count} phases`);
    fetchPhases();
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} phases?`)) return;
    for (const id of selected) {
      await api.delete(`/phases/${id}`);
    }
    setPhases(prev => prev.filter(p => !selected.has(p.id)));
    setSelected(new Set());
  };

  return (
    <div className="phase-library">
      <div className="phase-library-header">
        <h2>Phase Library</h2>
        <div className="phase-library-actions">
          <button className="phase-lib-btn" onClick={handleImport}>
            <FontAwesomeIcon icon={faUpload} /> Import
          </button>
          {selected.size > 0 && (
            <>
              <button className="phase-lib-btn" onClick={exportSelected}>
                <FontAwesomeIcon icon={faDownload} /> Export ({selected.size})
              </button>
              <button className="phase-lib-btn danger" onClick={deleteSelected}>
                <FontAwesomeIcon icon={faTrash} /> Delete ({selected.size})
              </button>
            </>
          )}
        </div>
      </div>

      <div className="phase-library-filters">
        <FontAwesomeIcon icon={faFilter} />
        <select value={mapFilter} onChange={(e) => setMapFilter(e.target.value)}>
          <option value="">All Maps</option>
          {maps.map(m => (
            <option key={m.name} value={m.name}>{m.displayName}</option>
          ))}
        </select>
        <label className="phase-select-all">
          <input
            type="checkbox"
            checked={phases.length > 0 && selected.size === phases.length}
            onChange={selectAll}
          />
          Select all
        </label>
      </div>

      {loading && <p className="phase-loading">Loading...</p>}

      {!loading && phases.length === 0 && (
        <div className="phase-empty">
          <p>No saved phases yet</p>
          <p>Capture phases from the Demo Player or save them from the Tactical Board</p>
        </div>
      )}

      <div className="phase-grid">
        {phases.map(phase => (
          <div
            key={phase.id}
            className={`phase-card ${selected.has(phase.id) ? 'selected' : ''}`}
          >
            <div className="phase-card-check">
              <input
                type="checkbox"
                checked={selected.has(phase.id)}
                onChange={() => toggleSelect(phase.id)}
              />
            </div>
            <div className="phase-card-body">
              {editingId === phase.id ? (
                <div className="phase-card-edit">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    autoFocus
                  />
                  <button onClick={saveEdit}><FontAwesomeIcon icon={faCheck} /></button>
                  <button onClick={() => setEditingId(null)}><FontAwesomeIcon icon={faXmark} /></button>
                </div>
              ) : (
                <div className="phase-card-name" onDoubleClick={() => startEdit(phase)}>
                  {phase.name}
                </div>
              )}
              <div className="phase-card-meta">
                <span className="phase-card-map">{phase.mapName}</span>
                <span className="phase-card-source">{phase.source}</span>
                <span className="phase-card-date">
                  {new Date(phase.createdAt).toLocaleDateString()}
                </span>
              </div>
              {phase.tags.length > 0 && (
                <div className="phase-card-tags">
                  {phase.tags.map(tag => (
                    <span key={tag} className="phase-tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="phase-card-actions">
              <button onClick={() => startEdit(phase)} title="Rename">
                <FontAwesomeIcon icon={faPen} />
              </button>
              <button onClick={() => deletePhase(phase.id)} title="Delete" className="danger">
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
