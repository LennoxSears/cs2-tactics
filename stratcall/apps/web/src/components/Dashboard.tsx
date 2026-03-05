import { useState, useEffect } from 'react';
import type { Strategy, Playbook, MapName } from '../types';
import type { Session } from '../lib/auth';
import {
  loadStrategies, saveStrategy, deleteStrategy,
  loadPlaybooks, savePlaybook, deletePlaybook,
  generateId, migrateFromLegacy,
} from '../storage';
import MyStrategies from './MyStrategies';
import PlaybookList from './PlaybookList';
import PlaybookView from './PlaybookView';
import StrategyView from './StrategyView';
import Community from './Community';
import Profile from './Profile';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightFromBracket, faGlobe, faBook, faMap, faUser } from '@fortawesome/free-solid-svg-icons';

type View =
  | { screen: 'strategies' }
  | { screen: 'playbooks' }
  | { screen: 'playbook'; playbookId: string }
  | { screen: 'editor'; strategyId: string }
  | { screen: 'community' }
  | { screen: 'profile' };

interface Props {
  session: Session;
  onLogout: () => void;
}

export default function Dashboard({ session, onLogout }: Props) {
  const [view, setView] = useState<View>({ screen: 'strategies' });
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);

  useEffect(() => {
    migrateFromLegacy();
    setStrategies(loadStrategies());
    setPlaybooks(loadPlaybooks());
  }, []);

  const refresh = () => {
    setStrategies(loadStrategies());
    setPlaybooks(loadPlaybooks());
  };

  const handleCreateStrategy = (map: MapName, name: string) => {
    const now = Date.now();
    const strat: Strategy = {
      id: generateId(),
      name,
      description: '',
      map,
      side: 't',
      situation: 'default',
      stratType: 'execute',
      tempo: 'mid-round',
      tags: [],
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
      forkedFrom: null,
      createdBy: session.userId,
      createdAt: now,
      updatedAt: now,
    };
    saveStrategy(strat);
    refresh();
    setView({ screen: 'editor', strategyId: strat.id });
  };

  const handleSaveStrategy = (strat: Strategy) => {
    saveStrategy(strat);
    refresh();
  };

  const handleDeleteStrategy = (id: string) => {
    deleteStrategy(id);
    refresh();
  };

  const handleCreatePlaybook = (name: string) => {
    const now = Date.now();
    const pb: Playbook = {
      id: generateId(),
      name,
      description: '',
      isPublic: false,
      createdBy: session.userId,
      createdAt: now,
      updatedAt: now,
    };
    savePlaybook(pb);
    refresh();
  };

  const handleDeletePlaybook = (id: string) => {
    deletePlaybook(id);
    refresh();
  };

  const currentStrategy = view.screen === 'editor'
    ? strategies.find(s => s.id === view.strategyId)
    : undefined;

  const currentPlaybook = view.screen === 'playbook'
    ? playbooks.find(p => p.id === view.playbookId)
    : undefined;

  return (
    <div className="dashboard">
      {view.screen !== 'editor' && (
        <div className="dash-topbar">
          <div className="dash-topbar-left">
            <div className="dash-topbar-logo" onClick={() => setView({ screen: 'strategies' })} style={{ cursor: 'pointer' }}>StratCall</div>
            <nav className="dash-nav">
              <button
                className={`dash-nav-btn ${view.screen === 'strategies' ? 'active' : ''}`}
                onClick={() => setView({ screen: 'strategies' })}
              >
                <FontAwesomeIcon icon={faMap} /> My Strategies
              </button>
              <button
                className={`dash-nav-btn ${view.screen === 'playbooks' || view.screen === 'playbook' ? 'active' : ''}`}
                onClick={() => setView({ screen: 'playbooks' })}
              >
                <FontAwesomeIcon icon={faBook} /> Playbooks
              </button>
              <button
                className={`dash-nav-btn ${view.screen === 'community' ? 'active' : ''}`}
                onClick={() => setView({ screen: 'community' })}
              >
                <FontAwesomeIcon icon={faGlobe} /> Community
              </button>
              <button
                className={`dash-nav-btn ${view.screen === 'profile' ? 'active' : ''}`}
                onClick={() => setView({ screen: 'profile' })}
              >
                <FontAwesomeIcon icon={faUser} /> Profile
              </button>
            </nav>
          </div>
          <div className="dash-topbar-user">
            {session.avatarUrl && (
              <img className="dash-avatar" src={session.avatarUrl} alt="" />
            )}
            <span className="dash-username">{session.displayName}</span>
            <button className="dash-logout" onClick={onLogout} title="Sign out">
              <FontAwesomeIcon icon={faRightFromBracket} />
            </button>
          </div>
        </div>
      )}

      <div className="dash-content">
        {view.screen === 'strategies' && (
          <MyStrategies
            strategies={strategies}
            onOpenStrategy={(id) => setView({ screen: 'editor', strategyId: id })}
            onCreateStrategy={handleCreateStrategy}
            onDeleteStrategy={handleDeleteStrategy}
            onUpdateStrategy={handleSaveStrategy}
          />
        )}
        {view.screen === 'playbooks' && (
          <PlaybookList
            playbooks={playbooks}
            onSelect={(id) => setView({ screen: 'playbook', playbookId: id })}
            onCreate={handleCreatePlaybook}
            onDelete={handleDeletePlaybook}
          />
        )}
        {view.screen === 'playbook' && currentPlaybook && (
          <PlaybookView
            playbook={currentPlaybook}
            onBack={() => setView({ screen: 'playbooks' })}
            onOpenStrategy={(id) => setView({ screen: 'editor', strategyId: id })}
          />
        )}
        {view.screen === 'editor' && currentStrategy && (
          <StrategyView
            strategy={currentStrategy}
            onBack={() => setView({ screen: 'strategies' })}
            onSave={handleSaveStrategy}
          />
        )}
        {view.screen === 'community' && (
          <Community />
        )}
        {view.screen === 'profile' && (
          <Profile session={session} onOpenStrategy={(id) => setView({ screen: 'editor', strategyId: id })} />
        )}
      </div>
    </div>
  );
}
