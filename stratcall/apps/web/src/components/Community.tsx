import { useState, useEffect, useCallback } from 'react';
import type { MapName, RoundSituation, Side } from '../types';
import { ROUND_SITUATIONS } from '../types';
import { maps } from '../maps';
import { mapImages } from '../assets/mapImages';
import { api } from '../lib/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStar, faFilter, faDownload, faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarOutline } from '@fortawesome/free-regular-svg-icons';
import { useLocale } from '../lib/i18n';

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
  const { t } = useLocale();
  const [results, setResults] = useState<CommunityStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMap, setFilterMap] = useState<MapName | 'all'>('all');
  const [filterSide, setFilterSide] = useState<Side | 'all'>('all');
  const [filterSituation, setFilterSituation] = useState<RoundSituation | 'all'>('all');
  const [filterTag, setFilterTag] = useState<string | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  // Fetch user's starred IDs on mount
  useEffect(() => {
    api.get<string[]>('/community/starred')
      .then(ids => setStarredIds(new Set(ids)))
      .catch(() => {});
  }, []);

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
      setError(err instanceof Error ? err.message : t('community.error'));
    } finally {
      setLoading(false);
    }
  }, [filterMap, filterSide, filterSituation, filterTag]);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  const handleStar = async (stratId: string) => {
    try {
      const res = await api.post<{ starred: boolean }>(`/community/strategies/${stratId}/star`, {});
      setStarredIds(prev => {
        const next = new Set(prev);
        if (res.starred) next.add(stratId); else next.delete(stratId);
        return next;
      });
      // Update local vote count
      setResults(prev => prev.map(item =>
        item.strategy.id === stratId
          ? { ...item, voteCount: item.voteCount + (res.starred ? 1 : -1) }
          : item
      ));
    } catch {
      // Silently fail — user may not be authenticated
    }
  };

  const handleImport = async (strat: CommunityStrategy) => {
    try {
      await api.post(`/community/strategies/${strat.strategy.id}/fork`, {});
      setImportedIds(prev => new Set(prev).add(strat.strategy.id));
    } catch {
      // Fork failed silently
    }
  };

  const [allTags, setAllTags] = useState<string[]>([]);
  useEffect(() => {
    api.get<{ tag: string; count: number }[]>('/community/tags/popular')
      .then(rows => setAllTags(rows.map(r => r.tag)))
      .catch(() => {});
  }, []);
  const activeFilterCount = [filterMap, filterSide, filterSituation, filterTag].filter(f => f !== 'all').length;

  return (
    <div className="community">
      <div className="community-header">
        <div className="community-header-left">
          <h2>{t('community.title')}</h2>
          <span className="community-count">{t('community.count', { count: results.length })}</span>
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
            <option value="all">{t('filter.anyMap')}</option>
            {maps.filter(m => m.hasNavMesh).map(m => (
              <option key={m.name} value={m.name}>{m.displayName}</option>
            ))}
          </select>
          <select value={filterSide} onChange={e => setFilterSide(e.target.value as Side | 'all')}>
            <option value="all">{t('filter.anySide')}</option>
            <option value="t">{t('filter.tSide')}</option>
            <option value="ct">{t('filter.ctSide')}</option>
          </select>
          <select value={filterSituation} onChange={e => setFilterSituation(e.target.value as RoundSituation | 'all')}>
            <option value="all">{t('filter.anySituation')}</option>
            {ROUND_SITUATIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)}>
            <option value="all">{t('filter.anyTag')}</option>
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
            <FontAwesomeIcon icon={faSpinner} spin /> {t('community.loading')}
          </div>
        )}
        {error && (
          <div className="community-error">
            {error}
            <button onClick={fetchStrategies}>{t('retry')}</button>
          </div>
        )}
        {!loading && !error && results.length === 0 && (
          <div className="community-empty">
            {t('community.empty')}
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
                <div className="star-controls">
                  <button
                    className={`star-btn ${starredIds.has(item.strategy.id) ? 'starred' : ''}`}
                    onClick={() => handleStar(item.strategy.id)}
                    title={starredIds.has(item.strategy.id) ? t('community.unstar') : t('community.star')}
                  >
                    <FontAwesomeIcon icon={starredIds.has(item.strategy.id) ? faStar : faStarOutline} />
                    <span className="star-count">{item.voteCount}</span>
                  </button>
                </div>
                <button
                  className={`import-btn ${importedIds.has(item.strategy.id) ? 'imported' : ''}`}
                  onClick={() => handleImport(item)}
                  disabled={importedIds.has(item.strategy.id)}
                >
                  <FontAwesomeIcon icon={faDownload} />
                  {importedIds.has(item.strategy.id) ? t('community.imported') : t('community.import')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
