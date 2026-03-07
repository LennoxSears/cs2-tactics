import { useState, useEffect, useCallback } from 'react';
import type { Strategy, Playbook, MapName } from '../types';
import type { Session } from '../lib/auth';
import { api } from '../lib/api';
import MyStrategies from './MyStrategies';
import PlaybookList from './PlaybookList';
import PlaybookView from './PlaybookView';
import StrategyView from './StrategyView';
import Community from './Community';
import Profile from './Profile';
import Tutorial from './Tutorial';
import UserProfile from './UserProfile';
import DemoPlayer from './DemoPlayer';
import PhaseLibrary from './PhaseLibrary';
import { isDesktop } from '../lib/demoParser';
import NotificationBell from './NotificationBell';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightFromBracket, faGlobe, faBook, faMap, faUser, faCircleQuestion, faFilm, faBookmark, faDesktop, faXmark } from '@fortawesome/free-solid-svg-icons';
import { faWindows } from '@fortawesome/free-brands-svg-icons';
import { useLocale } from '../lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';

type View =
  | { screen: 'strategies' }
  | { screen: 'playbooks' }
  | { screen: 'playbook'; playbookId: string }
  | { screen: 'editor'; strategyId: string }
  | { screen: 'community' }
  | { screen: 'profile' }
  | { screen: 'userProfile'; userId: string }
  | { screen: 'demo' }
  | { screen: 'library' };

interface Props {
  session: Session;
  onLogout: () => void;
}

export default function Dashboard({ session, onLogout }: Props) {
  const [view, setView] = useState<View>({ screen: 'strategies' });
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [showTutorial, setShowTutorial] = useState(() => {
    return !localStorage.getItem('stratcall-tutorial-seen');
  });

  const refresh = useCallback(async () => {
    const [strats, pbs] = await Promise.all([
      api.get<Strategy[]>('/playbooks/strategies'),
      api.get<Playbook[]>('/playbooks/playbooks'),
    ]);
    setStrategies(strats);
    setPlaybooks(pbs);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreateStrategy = async (map: MapName, name: string) => {
    const strat = await api.post<Strategy>('/playbooks/strategies', { map, name });
    await refresh();
    setView({ screen: 'editor', strategyId: strat.id });
  };

  const handleSaveStrategy = async (strat: Strategy) => {
    const { id, phases: stratPhases, ...fields } = strat;
    await api.patch(`/playbooks/strategies/${id}`, {
      name: fields.name,
      description: fields.description,
      map: fields.map,
      side: fields.side,
      situation: fields.situation,
      stratType: fields.stratType,
      tempo: fields.tempo,
      tags: fields.tags,
      isPublic: fields.isPublic,
    });

    // Sync phases: update existing, create new, delete removed
    const existing = strategies.find(s => s.id === id);
    const existingPhaseIds = new Set(existing?.phases.map(p => p.id) || []);
    const newPhaseIds = new Set(stratPhases.map(p => p.id));

    for (const phase of stratPhases) {
      if (existingPhaseIds.has(phase.id)) {
        await api.patch(`/playbooks/phases/${phase.id}`, {
          name: phase.name,
          sortOrder: phase.sortOrder,
          boardState: phase.boardState,
          notes: phase.notes,
        });
      } else {
        await api.post(`/playbooks/strategies/${id}/phases`, phase);
      }
    }

    for (const pid of existingPhaseIds) {
      if (!newPhaseIds.has(pid)) {
        await api.delete(`/playbooks/phases/${pid}`);
      }
    }

    await refresh();
  };

  const handleDeleteStrategy = async (id: string) => {
    await api.delete(`/playbooks/strategies/${id}`);
    await refresh();
  };

  const handleCreatePlaybook = async (name: string) => {
    await api.post('/playbooks/playbooks', { name });
    await refresh();
  };

  const handleDeletePlaybook = async (id: string) => {
    await api.delete(`/playbooks/playbooks/${id}`);
    await refresh();
  };

  const currentStrategy = view.screen === 'editor'
    ? strategies.find(s => s.id === view.strategyId)
    : undefined;

  const currentPlaybook = view.screen === 'playbook'
    ? playbooks.find(p => p.id === view.playbookId)
    : undefined;

  const { t } = useLocale();

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
                <FontAwesomeIcon icon={faMap} /> <span>{t('nav.myStrategies')}</span>
              </button>
              <button
                className={`dash-nav-btn ${view.screen === 'playbooks' || view.screen === 'playbook' ? 'active' : ''}`}
                onClick={() => setView({ screen: 'playbooks' })}
              >
                <FontAwesomeIcon icon={faBook} /> <span>{t('nav.playbooks')}</span>
              </button>
              <button
                className={`dash-nav-btn ${view.screen === 'demo' ? 'active' : ''}`}
                onClick={() => setView({ screen: 'demo' })}
              >
                <FontAwesomeIcon icon={faFilm} /> <span>{t('nav.demo')}</span>
              </button>
              <button
                className={`dash-nav-btn ${view.screen === 'library' ? 'active' : ''}`}
                onClick={() => setView({ screen: 'library' })}
              >
                <FontAwesomeIcon icon={faBookmark} /> <span>{t('nav.library')}</span>
              </button>
              <button
                className={`dash-nav-btn ${view.screen === 'community' ? 'active' : ''}`}
                onClick={() => setView({ screen: 'community' })}
              >
                <FontAwesomeIcon icon={faGlobe} /> <span>{t('nav.community')}</span>
              </button>
              <button
                className={`dash-nav-btn ${view.screen === 'profile' ? 'active' : ''}`}
                onClick={() => setView({ screen: 'profile' })}
              >
                <FontAwesomeIcon icon={faUser} /> <span>{t('nav.profile')}</span>
              </button>
            </nav>
          </div>
          <div className="dash-topbar-user">
            {!isDesktop() && (
              <a href="/download" className="dash-desktop-link" title={t('dash.getDesktop')}>
                <FontAwesomeIcon icon={faDesktop} /> <span>{t('dash.desktop')}</span>
              </a>
            )}
            <NotificationBell onViewUser={(id) => setView({ screen: 'userProfile', userId: id })} />
            <LanguageSwitcher />
            <button className="dash-help" onClick={() => setShowTutorial(true)} title={t('nav.helpTooltip')}>
              <FontAwesomeIcon icon={faCircleQuestion} />
            </button>
            {session.avatarUrl && (
              <img className="dash-avatar" src={session.avatarUrl} alt="" />
            )}
            <span className="dash-username">{session.displayName}</span>
            <button className="dash-logout" onClick={onLogout} title={t('signOut')}>
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
        {view.screen === 'demo' && (
          isDesktop() ? (
            <DemoPlayer />
          ) : (
            <div className="demo-promo">
              <div className="demo-promo-content">
                <button className="demo-promo-close" onClick={() => setView({ screen: 'strategies' })} title={t('back')}>
                  <FontAwesomeIcon icon={faXmark} />
                </button>
                <FontAwesomeIcon icon={faFilm} className="demo-promo-icon" />
                <h2>{t('dash.demoPromoTitle')}</h2>
                <p>{t('dash.demoPromoDesc')}</p>
                <div className="demo-promo-features">
                  <div className="demo-promo-feature">
                    <strong>{t('dash.demoFeature1Title')}</strong>
                    <span>{t('dash.demoFeature1Desc')}</span>
                  </div>
                  <div className="demo-promo-feature">
                    <strong>{t('dash.demoFeature2Title')}</strong>
                    <span>{t('dash.demoFeature2Desc')}</span>
                  </div>
                  <div className="demo-promo-feature">
                    <strong>{t('dash.demoFeature3Title')}</strong>
                    <span>{t('dash.demoFeature3Desc')}</span>
                  </div>
                </div>
                <a href="/download" className="demo-promo-btn">
                  <FontAwesomeIcon icon={faWindows} /> {t('dash.demoPromoCta')}
                </a>
                <p className="demo-promo-note">{t('dash.demoPromoNote')}</p>
              </div>
            </div>
          )
        )}
        {view.screen === 'library' && (
          <PhaseLibrary />
        )}
        {view.screen === 'community' && (
          <Community />
        )}
        {view.screen === 'profile' && (
          <Profile session={session} onOpenStrategy={(id) => setView({ screen: 'editor', strategyId: id })} />
        )}
        {view.screen === 'userProfile' && (
          <UserProfile
            userId={view.userId}
            session={session}
            onBack={() => setView({ screen: 'community' })}
            onOpenStrategy={(id) => setView({ screen: 'editor', strategyId: id })}
          />
        )}
      </div>
      {showTutorial && (
        <Tutorial onClose={() => {
          setShowTutorial(false);
          localStorage.setItem('stratcall-tutorial-seen', '1');
        }} />
      )}
    </div>
  );
}
