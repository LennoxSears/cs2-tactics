import type { ToolType } from '../types';
import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCloud,
  faBolt,
  faFire,
  faBomb,
  faPen,
  faEraser,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useLocale } from '../lib/i18n';

interface Props {
  activeTool: ToolType | null;
  onToolChange: (tool: ToolType | null) => void;
}

interface ToolDef {
  type: ToolType;
  label: string;
  faIcon?: IconDefinition;
  customIcon?: React.ReactNode;
  color?: string;
}

const CTBadge = () => (
  <span className="circle-badge ct-badge">CT</span>
);

const TBadge = () => (
  <span className="circle-badge t-badge">T</span>
);

export default function Toolbar({ activeTool, onToolChange }: Props) {
  const { t } = useLocale();

  const tools: (ToolDef | 'divider')[] = useMemo(() => [
    { type: 'player-ct', label: t('tool.placeCT'), customIcon: <CTBadge />, color: '#4a9eff' },
    { type: 'player-t', label: t('tool.placeT'), customIcon: <TBadge />, color: '#ff8c00' },
    'divider',
    { type: 'smoke', label: t('tool.smoke'), faIcon: faCloud, color: '#aaaaaa' },
    { type: 'flash', label: t('tool.flash'), faIcon: faBolt, color: '#ffdd00' },
    { type: 'molotov', label: t('tool.molotov'), faIcon: faFire, color: '#ff4444' },
    { type: 'he', label: t('tool.he'), faIcon: faBomb, color: '#44cc44' },
    'divider',
    { type: 'freehand', label: t('tool.freehand'), faIcon: faPen },
    { type: 'eraser', label: t('tool.eraser'), faIcon: faEraser },
  ], [t]);
  return (
    <div className="toolbar">
      {tools.map((tool, i) => {
        if (tool === 'divider') {
          return <div key={`d-${i}`} className="toolbar-divider" />;
        }
        const isActive = activeTool === tool.type;
        let className = 'tool-btn';
        if (isActive) {
          className += tool.type === 'player-t' ? ' active active-t' : ' active';
        }

        const color = tool.color && !isActive ? tool.color : undefined;

        return (
          <button
            key={tool.type}
            className={className}
            style={color ? { color } : undefined}
            onClick={() => onToolChange(isActive ? null : tool.type)}
            title={tool.label}
          >
            {tool.faIcon ? <FontAwesomeIcon icon={tool.faIcon} size="lg" /> : tool.customIcon}
            <span className="tool-label">{tool.label}</span>
          </button>
        );
      })}
    </div>
  );
}
