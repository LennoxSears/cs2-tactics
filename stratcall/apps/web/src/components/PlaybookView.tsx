import { useState, useEffect } from 'react';
import type { Playbook, Strategy } from '../types';
import { ROUND_SITUATIONS } from '../types';
import { maps } from '../maps';
import { getPlaybookStrategies, loadStrategies, addToPlaybook, removeFromPlaybook } from '../storage';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';

interface Props {
  playbook: Playbook;
  onBack: () => void;
  onOpenStrategy: (id: string) => void;
}

export default function PlaybookView({ playbook, onBack, onOpenStrategy }: Props) {
  const [pbStrategies, setPbStrategies] = useState<Strategy[]>([]);
  const [allStrategies, setAllStrategies] = useState<Strategy[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const refresh = () => {
    setPbStrategies(getPlaybookStrategies(playbook.id));
    setAllStrategies(loadStrategies());
  };

  useEffect(() => { refresh(); }, [playbook.id]);

  const pbIds = new Set(pbStrategies.map(s => s.id));
  const available = allStrategies.filter(s => !pbIds.has(s.id));

  return (
    <div className="playbook-view no-sidebar">
      <div className="pb-main-header">
        <div className="pb-header-left">
          <button className="back-btn" onClick={onBack}>
            <FontAwesomeIcon icon={faArrowLeft} /> Back
          </button>
          <div className="pb-name">{playbook.name}</div>
          <span className="strat-count">{pbStrategies.length} strategies</span>
        </div>
        <div className="pb-main-actions">
          <button className="new-strat-btn" onClick={() => setShowAdd(!showAdd)}>
            <FontAwesomeIcon icon={faPlus} /> Add Strategy
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="add-to-pb">
          <div className="add-to-pb-label">Add from your strategies:</div>
          {available.length === 0 ? (
            <div className="add-to-pb-empty">All your strategies are already in this playbook.</div>
          ) : (
            <div className="add-to-pb-list">
              {available.map(s => (
                <button key={s.id} className="add-to-pb-item" onClick={() => { addToPlaybook(playbook.id, s.id); refresh(); }}>
                  <FontAwesomeIcon icon={faPlus} />
                  <span>{s.name || 'Untitled'}</span>
                  <span className="add-to-pb-map">{maps.find(m => m.name === s.map)?.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="strat-list">
        {pbStrategies.length === 0 ? (
          <div className="strat-empty">
            This playbook is empty. Add strategies to build your collection.
          </div>
        ) : (
          pbStrategies.map(strat => {
            const mapDisplay = maps.find(m => m.name === strat.map)?.displayName || strat.map;
            const situationLabel = ROUND_SITUATIONS.find(s => s.value === strat.situation)?.label || strat.situation;
            return (
              <div key={strat.id} className="strat-card" onClick={() => onOpenStrategy(strat.id)}>
                <div className="strat-card-info">
                  <div className="strat-card-name">{strat.name || 'Untitled'}</div>
                  <div className="strat-card-meta">
                    <span className={`side-badge ${strat.side}`}>{strat.side.toUpperCase()}</span>
                    <span className="map-badge">{mapDisplay}</span>
                    <span className="situation-badge">{situationLabel}</span>
                    <span className="phase-count">{strat.phases.length} phases</span>
                  </div>
                </div>
                <button
                  className="strat-card-delete"
                  onClick={e => { e.stopPropagation(); removeFromPlaybook(playbook.id, strat.id); refresh(); }}
                  title="Remove from playbook"
                >
                  <FontAwesomeIcon icon={faMinus} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
