import { useState, useMemo, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBook, faChessBoard, faLayerGroup, faCrosshairs,
  faArrowRight, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useLocale } from '../lib/i18n';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface Props {
  onClose: () => void;
}

export default function Tutorial({ onClose }: Props) {
  const { t } = useLocale();
  const [step, setStep] = useState(0);

  const steps: { icon: IconDefinition; title: string; content: ReactNode }[] = useMemo(() => [
    {
      icon: faBook,
      title: t('tut.step1Title'),
      content: (
        <div className="tut-hierarchy">
          <div className="tut-level">
            <div className="tut-level-icon playbook"><FontAwesomeIcon icon={faBook} /></div>
            <div className="tut-level-text">
              <strong>{t('tut.playbook')}</strong>
              <span>{t('tut.playbookDesc')}</span>
            </div>
          </div>
          <div className="tut-arrow"><FontAwesomeIcon icon={faArrowRight} /></div>
          <div className="tut-level">
            <div className="tut-level-icon strategy"><FontAwesomeIcon icon={faChessBoard} /></div>
            <div className="tut-level-text">
              <strong>{t('tut.strategy')}</strong>
              <span>{t('tut.strategyDesc')}</span>
            </div>
          </div>
          <div className="tut-arrow"><FontAwesomeIcon icon={faArrowRight} /></div>
          <div className="tut-level">
            <div className="tut-level-icon phase"><FontAwesomeIcon icon={faLayerGroup} /></div>
            <div className="tut-level-text">
              <strong>{t('tut.phase')}</strong>
              <span>{t('tut.phaseDesc')}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: faCrosshairs,
      title: t('tut.step2Title'),
      content: (
        <>
          <p className="tut-intro">{t('tut.step2Intro')}</p>
          <div className="tut-axes">
            <div className="tut-axis-card">
              <div className="tut-axis-name">{t('axis.side')}</div>
              <div className="tut-axis-desc">{t('tut.sideDesc')}</div>
              <div className="tut-axis-values">{t('tut.sideValues')}</div>
            </div>
            <div className="tut-axis-card">
              <div className="tut-axis-name">{t('axis.situation')}</div>
              <div className="tut-axis-desc">{t('tut.situationDesc')}</div>
              <div className="tut-axis-values">{t('tut.situationValues')}</div>
            </div>
            <div className="tut-axis-card">
              <div className="tut-axis-name">{t('axis.type')}</div>
              <div className="tut-axis-desc">{t('tut.typeDesc')}</div>
              <div className="tut-axis-values">{t('tut.typeValues')}</div>
            </div>
            <div className="tut-axis-card">
              <div className="tut-axis-name">{t('axis.tempo')}</div>
              <div className="tut-axis-desc">{t('tut.tempoDesc')}</div>
              <div className="tut-axis-values">{t('tut.tempoValues')}</div>
            </div>
          </div>
        </>
      ),
    },
    {
      icon: faChessBoard,
      title: t('tut.step3Title'),
      content: (
        <div className="tut-board-tips">
          <div className="tut-tip">
            <div className="tut-tip-label">{t('tut.tipPlayers')}</div>
            <div className="tut-tip-text">{t('tut.tipPlayersText')}</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-label">{t('tut.tipUtilities')}</div>
            <div className="tut-tip-text">{t('tut.tipUtilitiesText')}</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-label">{t('tut.tipDrawing')}</div>
            <div className="tut-tip-text">{t('tut.tipDrawingText')}</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-label">{t('tut.tipPhases')}</div>
            <div className="tut-tip-text">{t('tut.tipPhasesText')}</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-label">{t('tut.tipRightClick')}</div>
            <div className="tut-tip-text">{t('tut.tipRightClickText')}</div>
          </div>
        </div>
      ),
    },
  ], [t]);

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="tut-overlay" onClick={onClose}>
      <div className="tut-modal" onClick={e => e.stopPropagation()}>
        <button className="tut-close" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <div className="tut-header">
          <FontAwesomeIcon icon={current.icon} className="tut-header-icon" />
          <h2>{current.title}</h2>
        </div>
        <div className="tut-body">
          {current.content}
        </div>
        <div className="tut-footer">
          <div className="tut-dots">
            {steps.map((_, i) => (
              <button
                key={i}
                className={`tut-dot${i === step ? ' active' : ''}`}
                onClick={() => setStep(i)}
              />
            ))}
          </div>
          <div className="tut-nav">
            {step > 0 && (
              <button className="tut-btn secondary" onClick={() => setStep(step - 1)}>{t('back')}</button>
            )}
            {isLast ? (
              <button className="tut-btn primary" onClick={onClose}>{t('tut.getStarted')}</button>
            ) : (
              <button className="tut-btn primary" onClick={() => setStep(step + 1)}>
                {t('next')} <FontAwesomeIcon icon={faArrowRight} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
