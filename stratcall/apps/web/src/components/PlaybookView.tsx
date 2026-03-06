import { useState, useEffect, useCallback } from 'react';
import type { Playbook, Strategy } from '../types';
import { ROUND_SITUATIONS } from '../types';
import { maps } from '../maps';
import { useLocale } from '../lib/i18n';
import { api } from '../lib/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';

interface Props {
  playbook: Playbook;
  onBack: () => void;
  onOpenStrategy: (id: string) => void;
}

export default function PlaybookView({ playbook, onBack, onOpenStrategy }: Props) {
  const { t } = useLocale();
  const [pbStrategies, setPbStrategies] = useState<Strategy[]>([]);
  const [allStrategies, setAllStrategies] = useState<Strategy[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const refresh = useCallback(async () => {
    const [pbData, allStrats] = await Promise.all([
      api.get<{ strategies: Strategy[] }>(`/playbooks/playbooks/${playbook.id}`),
      api.get<Strategy[]>('/playbooks/strategies'),
    ]);
    setPbStrategies(pbData.strategies || []);
    setAllStrategies(allStrats);
  }, [playbook.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAdd = async (strategyId: string) => {
    const maxOrder = pbStrategies.reduce((m, _, i) => Math.max(m, i), -1);
    await api.post(`/playbooks/playbooks/${playbook.id}/strategies`, { strategyId, sortOrder: maxOrder + 1 });
    await refresh();
  };

  const handleRemove = async (strategyId: string) => {
    await api.delete(`/playbooks/playbooks/${playbook.id}/strategies/${strategyId}`);
    await refresh();
  };

  const pbIds = new Set(pbStrategies.map(s => s.id));
  const available = allStrategies.filter(s => !pbIds.has(s.id));

  return (
    <div className="playbook-view no-sidebar">
      <div className="pb-main-header">
        <div className="pb-header-left">
          <button className="back-btn" onClick={onBack}>
            <FontAwesomeIcon icon={faArrowLeft} /> {t('back')}
          </button>
          <div className="pb-name">{playbook.name}</div>
          <span className="strat-count">{t('strats.count', { count: pbStrategies.length })}</span>
        </div>
        <div className="pb-main-actions">
          <button className="new-strat-btn" onClick={() => setShowAdd(!showAdd)}>
            <FontAwesomeIcon icon={faPlus} /> {t('pb.addStrategy')}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="add-to-pb">
          <div className="add-to-pb-label">{t('pb.addFromYours')}</div>
          {available.length === 0 ? (
            <div className="add-to-pb-empty">{t('pb.allAdded')}</div>
          ) : (
            <div className="add-to-pb-list">
              {available.map(s => (
                <button key={s.id} className="add-to-pb-item" onClick={() => handleAdd(s.id)}>
                  <FontAwesomeIcon icon={faPlus} />
                  <span>{s.name || t('untitled')}</span>
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
            {t('pb.emptyPlaybook')}
          </div>
        ) : (
          pbStrategies.map(strat => {
            const mapDisplay = maps.find(m => m.name === strat.map)?.displayName || strat.map;
            const situationLabel = ROUND_SITUATIONS.find(s => s.value === strat.situation)?.label || strat.situation;
            return (
              <div key={strat.id} className="strat-card" onClick={() => onOpenStrategy(strat.id)}>
                <div className="strat-card-info">
                  <div className="strat-card-name">{strat.name || t('untitled')}</div>
                  <div className="strat-card-meta">
                    <span className={`side-badge ${strat.side}`}>{strat.side.toUpperCase()}</span>
                    <span className="map-badge">{mapDisplay}</span>
                    <span className="situation-badge">{situationLabel}</span>
                    <span className="phase-count">{t('pb.phases', { count: strat.phases.length })}</span>
                  </div>
                </div>
                <button
                  className="strat-card-delete"
                  onClick={e => { e.stopPropagation(); handleRemove(strat.id); }}
                  title={t('pb.removeFromPlaybook')}
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
