import { useState, useEffect, useCallback } from 'react';
import type { MapName, RoundSituation, Side, Strategy } from '../types';
import { ROUND_SITUATIONS, SEED_TAGS } from '../types';
import { maps } from '../maps';
import { mapImages } from '../assets/mapImages';
import { api } from '../lib/api';
import { generateId, saveStrategy } from '../storage';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUp, faArrowDown, faFilter, faDownload, faSpinner,
} from '@fortawesome/free-solid-svg-icons';

interface CommunityStrategy {
  strategy: {
    id: string;
    name: string;
    map: string;
    side: string;
    situation: string;
    tags: string[];
    notes: string;
    isPublic: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  };
  author: {
    displayName: string;
    avatarUrl: string | null;
  } | null;
  voteCount: number;
}

export default function Community() {
  const [results, setResults] = useState<CommunityStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMap, setFilterMap] = useState<MapName | 'all'>('all');
  const [filterSide, setFilterSide] = useState<Side | 'all'>('all');
  const [filterSituation, setFilterSituation] = useState<RoundSituation | 'all'>('all');
  const [filterTag, setFilterTag] = useState<string | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterMap !== 'all') params.set('map', filterMap);
      if (filterSide !== 'all') params.set('side', filterSide);
      if (filterSituation !== 'all') params.set('situation', filterSituation);
      if (filterTag !== 'all') params.set('tag', filterTag);
      params.set('limit', '50');

      const data = await api.get<CommunityStrategy[]>(`/community/strategies?${params.toString()}`);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load strategies');
    } finally {
      setLoading(false);
    }
  }, [filterMap, filterSide, filterSituation, filterTag]);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  const handleVote = async (stratId: string, value: 1 | -1) => {
    try {
      await api.post(`/community/strategies/${stratId}/vote`, { value });
      fetchStrategies();
    } catch {
      // Silently fail — user may not be authenticated
    }
  };

  const handleImport = (strat: CommunityStrategy) => {
    const now = Date.now();
    const imported: Strategy = {
      id: generateId(),
      name: `${strat.strategy.name} (forked)`,
      description: '',
      map: strat.strategy.map as MapName,
      side: strat.strategy.side as Side,
      situation: (strat.strategy.situation || 'default') as RoundSituation,
      stratType: 'execute',
      tempo: 'mid-round',
      tags: strat.strategy.tags || [],
      phases: [{
        id: generateId(),
        name: 'Setup',
        sortOrder: 0,
        boardState: { players: [], utilities: [], drawings: [] },
        notes: '',
      }],
      isPublic: false,
      starCount: 0,
      forkCount: 0,
      forkedFrom: strat.strategy.id,
      createdBy: 'local',
      createdAt: now,
      updatedAt: now,
    };
    saveStrategy(imported);
    setImportedIds(prev => new Set(prev).add(strat.strategy.id));
  };

  const allTags = SEED_TAGS;
  const activeFilterCount = [filterMap, filterSide, filterSituation, filterTag].filter(f => f !== 'all').length;

  return (
    <div className="community">
      <div className="community-header">
        <div className="community-header-left">
          <h2>Community Strategies</h2>
          <span className="community-count">{results.length} strategies</span>
        </div>
        <div className="community-actions">
          <button
            className={`filter-toggle ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FontAwesomeIcon icon={faFilter} />
            {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
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
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)}>
            <option value="all">Any Tag</option>
            {allTags.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {activeFilterCount > 0 && (
            <button className="clear-filters" onClick={() => {
              setFilterMap('all'); setFilterSide('all'); setFilterSituation('all'); setFilterTag('all');
            }}>
              Clear
            </button>
          )}
        </div>
      )}

      <div className="community-list">
        {loading && (
          <div className="community-loading">
            <FontAwesomeIcon icon={faSpinner} spin /> Loading strategies...
          </div>
        )}
        {error && (
          <div className="community-error">
            {error}
            <button onClick={fetchStrategies}>Retry</button>
          </div>
        )}
        {!loading && !error && results.length === 0 && (
          <div className="community-empty">
            No public strategies found. Be the first to share one!
          </div>
        )}
        {results.map(item => {
          const mapDisplay = maps.find(m => m.name === item.strategy.map)?.displayName || item.strategy.map;
          const situationLabel = ROUND_SITUATIONS.find(s => s.value === item.strategy.situation)?.label || item.strategy.situation;
          const mapImg = mapImages[item.strategy.map as MapName];
          return (
            <div key={item.strategy.id} className="community-card">
              {mapImg && (
                <div className="community-card-thumb">
                  <img src={mapImg} alt={mapDisplay} />
                </div>
              )}
              <div className="community-card-body">
                <div className="community-card-name">{item.strategy.name}</div>
                <div className="community-card-meta">
                  <span className={`side-badge ${item.strategy.side}`}>{item.strategy.side.toUpperCase()}</span>
                  <span className="map-badge">{mapDisplay}</span>
                  <span className="situation-badge">{situationLabel}</span>
                </div>
                {item.strategy.tags && item.strategy.tags.length > 0 && (
                  <div className="strat-card-tags">
                    {item.strategy.tags.map(t => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                )}
                {item.author && (
                  <div className="community-card-author">
                    {item.author.avatarUrl && <img src={item.author.avatarUrl} alt="" className="author-avatar" />}
                    <span>{item.author.displayName}</span>
                  </div>
                )}
              </div>
              <div className="community-card-actions">
                <div className="vote-controls">
                  <button className="vote-btn up" onClick={() => handleVote(item.strategy.id, 1)}>
                    <FontAwesomeIcon icon={faArrowUp} />
                  </button>
                  <span className="vote-count">{item.voteCount}</span>
                  <button className="vote-btn down" onClick={() => handleVote(item.strategy.id, -1)}>
                    <FontAwesomeIcon icon={faArrowDown} />
                  </button>
                </div>
                <button
                  className={`import-btn ${importedIds.has(item.strategy.id) ? 'imported' : ''}`}
                  onClick={() => handleImport(item)}
                  disabled={importedIds.has(item.strategy.id)}
                >
                  <FontAwesomeIcon icon={faDownload} />
                  {importedIds.has(item.strategy.id) ? 'Imported' : 'Import'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
