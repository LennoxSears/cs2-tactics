import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBook, faChessBoard, faLayerGroup, faCrosshairs,
  faArrowRight, faXmark,
} from '@fortawesome/free-solid-svg-icons';

interface Props {
  onClose: () => void;
}

const STEPS = [
  {
    icon: faBook,
    title: 'How StratCall Organizes Tactics',
    content: (
      <>
        <div className="tut-hierarchy">
          <div className="tut-level">
            <div className="tut-level-icon playbook"><FontAwesomeIcon icon={faBook} /></div>
            <div className="tut-level-text">
              <strong>Playbook</strong>
              <span>A collection of strategies — your team's game plan for a match or map pool.</span>
            </div>
          </div>
          <div className="tut-arrow"><FontAwesomeIcon icon={faArrowRight} /></div>
          <div className="tut-level">
            <div className="tut-level-icon strategy"><FontAwesomeIcon icon={faChessBoard} /></div>
            <div className="tut-level-text">
              <strong>Strategy</strong>
              <span>A single tactical play for a specific map and side. Classified by 4 axes (see next).</span>
            </div>
          </div>
          <div className="tut-arrow"><FontAwesomeIcon icon={faArrowRight} /></div>
          <div className="tut-level">
            <div className="tut-level-icon phase"><FontAwesomeIcon icon={faLayerGroup} /></div>
            <div className="tut-level-text">
              <strong>Phase</strong>
              <span>One step in a strategy — setup, utility, entry, post-plant. Each has its own board state.</span>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    icon: faCrosshairs,
    title: 'The 4-Axis Strategy Model',
    content: (
      <>
        <p className="tut-intro">Every strategy is classified along 4 axes so you can filter and find the right play instantly.</p>
        <div className="tut-axes">
          <div className="tut-axis-card">
            <div className="tut-axis-name">Side</div>
            <div className="tut-axis-desc">T-Side or CT-Side. Determines which side of the map the strategy is designed for.</div>
            <div className="tut-axis-values">T-Side, CT-Side</div>
          </div>
          <div className="tut-axis-card">
            <div className="tut-axis-name">Situation</div>
            <div className="tut-axis-desc">The economy state of the round. A pistol round strat is very different from a full-buy execute.</div>
            <div className="tut-axis-values">Pistol, Eco, Force Buy, Full Buy, Save, Anti-Eco, Default, Retake</div>
          </div>
          <div className="tut-axis-card">
            <div className="tut-axis-name">Type</div>
            <div className="tut-axis-desc">The style of play. Are you executing onto a site, faking, splitting, or playing default?</div>
            <div className="tut-axis-values">Execute, Default, Rush, Fake, Split, Retake, Stack, Rotate</div>
          </div>
          <div className="tut-axis-card">
            <div className="tut-axis-name">Tempo</div>
            <div className="tut-axis-desc">When the play happens in the round. Fast plays hit early, slow plays wait for information.</div>
            <div className="tut-axis-values">Fast, Mid-Round, Slow</div>
          </div>
        </div>
      </>
    ),
  },
  {
    icon: faChessBoard,
    title: 'Using the Tactical Board',
    content: (
      <>
        <div className="tut-board-tips">
          <div className="tut-tip">
            <div className="tut-tip-label">Players</div>
            <div className="tut-tip-text">Select a player tool (CT/T) from the toolbar, then click the map to place. Drag to reposition. Drag off the board to delete.</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-label">Utilities</div>
            <div className="tut-tip-text">Place smokes, flashes, molotovs, and HE grenades. Drag a utility onto a player to assign a thrower.</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-label">Drawing</div>
            <div className="tut-tip-text">Use the freehand tool to draw movement paths and annotations. Use the eraser to remove drawings.</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-label">Phases</div>
            <div className="tut-tip-text">Add phases to break a strategy into steps. Each phase has its own board state. Use Animate to play through them.</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-label">Right-click</div>
            <div className="tut-tip-text">Right-click any player or utility token to add notes, assign roles, or set labels.</div>
          </div>
        </div>
      </>
    ),
  },
];

export default function Tutorial({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

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
            {STEPS.map((_, i) => (
              <button
                key={i}
                className={`tut-dot${i === step ? ' active' : ''}`}
                onClick={() => setStep(i)}
              />
            ))}
          </div>
          <div className="tut-nav">
            {step > 0 && (
              <button className="tut-btn secondary" onClick={() => setStep(step - 1)}>Back</button>
            )}
            {isLast ? (
              <button className="tut-btn primary" onClick={onClose}>Get Started</button>
            ) : (
              <button className="tut-btn primary" onClick={() => setStep(step + 1)}>
                Next <FontAwesomeIcon icon={faArrowRight} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
