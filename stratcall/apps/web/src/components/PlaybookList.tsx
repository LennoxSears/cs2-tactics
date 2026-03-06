import { useState } from 'react';
import type { Playbook } from '../types';
import ConfirmDialog from './ConfirmDialog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faBook, faGlobe, faLock } from '@fortawesome/free-solid-svg-icons';
import { useLocale } from '../lib/i18n';

interface Props {
  playbooks: Playbook[];
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}

export default function PlaybookList({ playbooks, onSelect, onCreate, onDelete }: Props) {
  const { t } = useLocale();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName('');
    setShowCreate(false);
  };

  return (
    <div className="playbook-list">
      <div className="pl-header">
        <h2>{t('pb.title')}</h2>
        <button className="new-strat-btn" onClick={() => setShowCreate(true)}>
          <FontAwesomeIcon icon={faPlus} /> {t('pb.newPlaybook')}
        </button>
      </div>

      {showCreate && (
        <div className="new-strat-form">
          <input
            className="strat-input"
            placeholder={t('pb.namePlaceholder')}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button className="create-btn confirm" onClick={handleCreate}>{t('create')}</button>
          <button className="create-btn cancel" onClick={() => { setShowCreate(false); setNewName(''); }}>{t('cancel')}</button>
        </div>
      )}

      <div className="pl-grid">
        {playbooks.length === 0 ? (
          <div className="strat-empty">
            {t('pb.empty')}
          </div>
        ) : (
          playbooks.map(pb => (
            <div key={pb.id} className="pl-card" onClick={() => onSelect(pb.id)}>
              <div className="pl-card-icon">
                <FontAwesomeIcon icon={faBook} />
              </div>
              <div className="pl-card-body">
                <div className="pl-card-name">
                  {pb.name}
                  <span className="visibility-icon">
                    <FontAwesomeIcon icon={pb.isPublic ? faGlobe : faLock} />
                  </span>
                </div>
                {pb.description && <div className="pl-card-desc">{pb.description}</div>}
              </div>
              <button
                className="strat-card-delete"
                onClick={e => { e.stopPropagation(); setConfirmDelete({ id: pb.id, name: pb.name }); }}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t('pb.deleteTitle')}
          message={t('pb.deleteMsg', { name: confirmDelete.name })}
          onConfirm={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
