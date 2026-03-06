import { useState, useEffect } from 'react';
import type { Strategy, Playbook } from '../types';
import type { Session } from '../lib/auth';
import { ROUND_SITUATIONS, STRAT_TYPES } from '../types';
import { maps } from '../maps';
import { api } from '../lib/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faLock, faCodeFork, faStar, faBook, faMap } from '@fortawesome/free-solid-svg-icons';

interface Props {
  session: Session;
  onOpenStrategy: (id: string) => void;
}

export default function Profile({ session, onOpenStrategy }: Props) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'strategies' | 'playbooks' | 'starred'>('strategies');

  useEffect(() => {
    Promise.all([
      api.get<Strategy[]>('/playbooks/strategies'),
      api.get<Playbook[]>('/playbooks/playbooks'),
      api.get<string[]>('/community/starred'),
    ]).then(([strats, pbs, starred]) => {
      setStrategies(strats);
      setPlaybooks(pbs);
      setStarredIds(new Set(starred));
    });
  }, []);

  const publicStrats = strategies.filter(s => s.isPublic);
  const forkedStrats = strategies.filter(s => s.forkedFrom);
  const starredStrats = strategies.filter(s => starredIds.has(s.id));

  return (
    <div className="profile">
      <div className="profile-header">
        <div className="profile-avatar-area">
          {session.avatarUrl ? (
            <img className="profile-avatar" src={session.avatarUrl} alt="" />
          ) : (
            <div className="profile-avatar-placeholder" />
          )}
        </div>
        <div className="profile-info">
          <h2 className="profile-name">{session.displayName}</h2>
          <div className="profile-stats">
            <span><FontAwesomeIcon icon={faMap} /> {strategies.length} strategies</span>
            <span><FontAwesomeIcon icon={faBook} /> {playbooks.length} playbooks</span>
            <span><FontAwesomeIcon icon={faGlobe} /> {publicStrats.length} public</span>
            <span><FontAwesomeIcon icon={faCodeFork} /> {forkedStrats.length} forked</span>
          </div>
        </div>
      </div>

      <div className="profile-tabs">
        <button className={`profile-tab ${tab === 'strategies' ? 'active' : ''}`} onClick={() => setTab('strategies')}>
          Strategies ({strategies.length})
        </button>
        <button className={`profile-tab ${tab === 'playbooks' ? 'active' : ''}`} onClick={() => setTab('playbooks')}>
          Playbooks ({playbooks.length})
        </button>
        <button className={`profile-tab ${tab === 'starred' ? 'active' : ''}`} onClick={() => setTab('starred')}>
          <FontAwesomeIcon icon={faStar} /> Starred ({starredStrats.length})
        </button>
      </div>

      <div className="profile-content">
        {tab === 'strategies' && (
          <div className="strat-grid">
            {strategies.length === 0 ? (
              <div className="strat-empty">No strategies yet.</div>
            ) : (
              strategies.map(strat => (
                <StratCard key={strat.id} strat={strat} onClick={() => onOpenStrategy(strat.id)} />
              ))
            )}
          </div>
        )}
        {tab === 'playbooks' && (
          <div className="pl-grid">
            {playbooks.length === 0 ? (
              <div className="strat-empty">No playbooks yet.</div>
            ) : (
              playbooks.map(pb => (
                <div key={pb.id} className="pl-card">
                  <div className="pl-card-icon"><FontAwesomeIcon icon={faBook} /></div>
                  <div className="pl-card-body">
                    <div className="pl-card-name">
                      {pb.name}
                      <span className="visibility-icon">
                        <FontAwesomeIcon icon={pb.isPublic ? faGlobe : faLock} />
                      </span>
                    </div>
                    {pb.description && <div className="pl-card-desc">{pb.description}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {tab === 'starred' && (
          <div className="strat-grid">
            {starredStrats.length === 0 ? (
              <div className="strat-empty">No starred strategies.</div>
            ) : (
              starredStrats.map(strat => (
                <StratCard key={strat.id} strat={strat} onClick={() => onOpenStrategy(strat.id)} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StratCard({ strat, onClick }: { strat: Strategy; onClick: () => void }) {
  const mapDisplay = maps.find(m => m.name === strat.map)?.displayName || strat.map;
  const situationLabel = ROUND_SITUATIONS.find(s => s.value === strat.situation)?.label || strat.situation;
  const typeLabel = STRAT_TYPES.find(t => t.value === strat.stratType)?.label || strat.stratType;

  return (
    <div className="strat-repo-card" onClick={onClick}>
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
        {strat.description && <div className="strat-repo-desc">{strat.description}</div>}
        <div className="strat-repo-meta">
          <span className={`side-badge ${strat.side}`}>{strat.side.toUpperCase()}</span>
          <span className="map-badge">{mapDisplay}</span>
          <span className="situation-badge">{situationLabel}</span>
          <span className="type-badge">{typeLabel}</span>
          <span className="phase-count">{strat.phases.length}p</span>
        </div>
      </div>
    </div>
  );
}
