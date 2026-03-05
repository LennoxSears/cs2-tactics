import { useState } from 'react';
import TacticalBoard from './TacticalBoard';
import DiscussionsPage from './DiscussionsPage';
import type { Strategy } from '../types';

type Tab = 'board' | 'discussions';

interface Props {
  strategy: Strategy;
  onBack: () => void;
  onSave: (strategy: Strategy) => void;
}

export default function StrategyView({ strategy, onBack, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('board');

  return (
    <div className="strategy-view">
      <div className="strategy-tabs">
        <button
          className={`strategy-tab${activeTab === 'board' ? ' active' : ''}`}
          onClick={() => setActiveTab('board')}
        >
          Board
        </button>
        <button
          className={`strategy-tab${activeTab === 'discussions' ? ' active' : ''}`}
          onClick={() => setActiveTab('discussions')}
        >
          Discussions
        </button>
      </div>

      {activeTab === 'board' ? (
        <TacticalBoard strategy={strategy} onBack={onBack} onSave={onSave} />
      ) : (
        <DiscussionsPage strategyId={strategy.id} />
      )}
    </div>
  );
}
