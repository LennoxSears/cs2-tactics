import { useState } from 'react';
import type { Playbook } from '../types';
import ConfirmDialog from './ConfirmDialog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faBook, faGlobe, faLock } from '@fortawesome/free-solid-svg-icons';

interface Props {
  playbooks: Playbook[];
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}

export default function PlaybookList({ playbooks, onSelect, onCreate, onDelete }: Props) {
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
        <h2>Playbooks</h2>
        <button className="new-strat-btn" onClick={() => setShowCreate(true)}>
          <FontAwesomeIcon icon={faPlus} /> New Playbook
        </button>
      </div>

      {showCreate && (
        <div className="new-strat-form">
          <input
            className="strat-input"
            placeholder="Playbook name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button className="create-btn confirm" onClick={handleCreate}>Create</button>
          <button className="create-btn cancel" onClick={() => { setShowCreate(false); setNewName(''); }}>Cancel</button>
        </div>
      )}

      <div className="pl-grid">
        {playbooks.length === 0 ? (
          <div className="strat-empty">
            No playbooks yet. Create a collection to organize your strategies.
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
          title="Delete Playbook?"
          message={`"${confirmDelete.name}" will be permanently deleted.`}
          onConfirm={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
