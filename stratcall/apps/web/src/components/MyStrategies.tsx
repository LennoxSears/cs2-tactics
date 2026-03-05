import { useState } from 'react';
import type { Strategy, MapName, RoundSituation, Side } from '../types';
import { ROUND_SITUATIONS, STRAT_TYPES, STRAT_TEMPOS } from '../types';
import { maps } from '../maps';
import { mapImages } from '../assets/mapImages';
import ConfirmDialog from './ConfirmDialog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faFilter, faGlobe, faLock, faCodeFork } from '@fortawesome/free-solid-svg-icons';

interface Props {
  strategies: Strategy[];
  onOpenStrategy: (id: string) => void;
  onCreateStrategy: (map: MapName, name: string) => void;
  onDeleteStrategy: (id: string) => void;
  onUpdateStrategy?: (strategy: Strategy) => void;
}

export default function MyStrategies({
  strategies, onOpenStrategy, onCreateStrategy, onDeleteStrategy,
}: Props) {
  const [filterMap, setFilterMap] = useState<MapName | 'all'>('all');
  const [filterSide, setFilterSide] = useState<Side | 'all'>('all');
  const [filterSituation, setFilterSituation] = useState<RoundSituation | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showNewStrat, setShowNewStrat] = useState(false);
  const [newStratName, setNewStratName] = useState('');
  const [newStratMap, setNewStratMap] = useState<MapName>('mirage');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  let filtered = strategies;
  if (filterMap !== 'all') filtered = filtered.filter(s => s.map === filterMap);
  if (filterSide !== 'all') filtered = filtered.filter(s => s.side === filterSide);
  if (filterSituation !== 'all') filtered = filtered.filter(s => s.situation === filterSituation);

  const handleCreate = () => {
    if (!newStratName.trim()) return;
    onCreateStrategy(newStratMap, newStratName.trim());
    setNewStratName('');
    setShowNewStrat(false);
  };

  const activeFilterCount = [filterMap, filterSide, filterSituation].filter(f => f !== 'all').length;

  return (
    <div className="my-strategies">
      <div className="ms-header">
        <div className="ms-header-left">
          <h2>My Strategies</h2>
          <span className="strat-count">{strategies.length} strategies</span>
        </div>
        <div className="ms-header-actions">
          <button
            className={`filter-toggle ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FontAwesomeIcon icon={faFilter} />
            {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
          </button>
          <button className="new-strat-btn" onClick={() => setShowNewStrat(true)}>
            <FontAwesomeIcon icon={faPlus} /> New Strategy
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="pb-filter-bar">
          <select value={filterMap} onChange={e => setFilterMap(e.target.value as MapName | 'all')}>
            <option value="all">Any Map</option>
            {maps.filter(m => m.hasNavMesh).map(m => (
              <option key={m.name} value={m.name}>{m.displayName}</option>
            ))}
          </select>
          <select value={filterSide} onChange={e => setFilterSide(e.target.value as Side | 'all')}>
            <option value="all">Any Side</option>
            <option value="t">T-Side</option>
            <option value="ct">CT-Side</option>
          </select>
          <select value={filterSituation} onChange={e => setFilterSituation(e.target.value as RoundSituation | 'all')}>
            <option value="all">Any Situation</option>
            {ROUND_SITUATIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {activeFilterCount > 0 && (
            <button className="clear-filters" onClick={() => { setFilterMap('all'); setFilterSide('all'); setFilterSituation('all'); }}>
              Clear
            </button>
          )}
        </div>
      )}

      {showNewStrat && (
        <div className="new-strat-form">
          <input
            className="strat-input"
            placeholder="Strategy name..."
            value={newStratName}
            onChange={e => setNewStratName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <select className="strat-select" value={newStratMap} onChange={e => setNewStratMap(e.target.value as MapName)}>
            {maps.map(m => (
              <option key={m.name} value={m.name}>{m.displayName}</option>
            ))}
          </select>
          <button className="create-btn confirm" onClick={handleCreate}>Create</button>
          <button className="create-btn cancel" onClick={() => { setShowNewStrat(false); setNewStratName(''); }}>Cancel</button>
        </div>
      )}

      <div className="strat-grid">
        {filtered.length === 0 ? (
          <div className="strat-empty">
            {strategies.length === 0
              ? 'No strategies yet. Create your first one!'
              : 'No strategies match the current filters.'}
          </div>
        ) : (
          filtered.map(strat => {
            const mapDisplay = maps.find(m => m.name === strat.map)?.displayName || strat.map;
            const situationLabel = ROUND_SITUATIONS.find(s => s.value === strat.situation)?.label || strat.situation;
            const typeLabel = STRAT_TYPES.find(t => t.value === strat.stratType)?.label || strat.stratType;
            const tempoLabel = STRAT_TEMPOS.find(t => t.value === strat.tempo)?.label || strat.tempo;
            const mapImg = mapImages[strat.map];
            return (
              <div key={strat.id} className="strat-repo-card" onClick={() => onOpenStrategy(strat.id)}>
                {mapImg && (
                  <div className="strat-repo-thumb">
                    <img src={mapImg} alt={mapDisplay} />
                  </div>
                )}
                <div className="strat-repo-body">
                  <div className="strat-repo-name">
                    {strat.name || 'Untitled'}
                    <span className="visibility-icon">
                      <FontAwesomeIcon icon={strat.isPublic ? faGlobe : faLock} />
                    </span>
                    {strat.forkedFrom && (
                      <span className="forked-badge"><FontAwesomeIcon icon={faCodeFork} /> forked</span>
                    )}
                  </div>
                  {strat.description && (
                    <div className="strat-repo-desc">{strat.description}</div>
                  )}
                  <div className="strat-repo-meta">
                    <span className={`side-badge ${strat.side}`}>{strat.side.toUpperCase()}</span>
                    <span className="map-badge">{mapDisplay}</span>
                    <span className="situation-badge">{situationLabel}</span>
                    <span className="type-badge">{typeLabel}</span>
                    <span className="tempo-badge">{tempoLabel}</span>
                    <span className="phase-count">{strat.phases.length}p</span>
                  </div>
                  {strat.tags.length > 0 && (
                    <div className="strat-card-tags">
                      {strat.tags.map(t => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="strat-card-delete"
                  onClick={e => { e.stopPropagation(); setConfirmDelete({ id: strat.id, name: strat.name || 'Untitled' }); }}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Strategy?"
          message={`"${confirmDelete.name}" will be permanently deleted.`}
          onConfirm={() => { onDeleteStrategy(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
