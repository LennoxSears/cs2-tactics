import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faArrowLeft, faComments } from '@fortawesome/free-solid-svg-icons';
import RichEditor, { RichViewer } from './RichEditor';
import CommentThread from './CommentThread';
import { api } from '../lib/api';
import { useLocale } from '../lib/i18n';
import type { Discussion } from '../types';

function timeAgo(ts: number | string): string {
  const time = typeof ts === 'string' ? new Date(ts).getTime() : ts;
  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(time).toLocaleDateString();
}

interface Props {
  strategyId: string;
}

export default function DiscussionsPage({ strategyId }: Props) {
  const { t } = useLocale();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [activeDiscussion, setActiveDiscussion] = useState<Discussion | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchDiscussions = useCallback(async () => {
    try {
      const data = await api.get<Discussion[]>(`/strategies/${strategyId}/discussions`);
      setDiscussions(data);
    } catch {
      setDiscussions([]);
    } finally {
      setLoading(false);
    }
  }, [strategyId]);

  useEffect(() => {
    fetchDiscussions();
  }, [fetchDiscussions]);

  const createDiscussion = useCallback(async () => {
    if (!newTitle.trim()) return;
    try {
      const created = await api.post<Discussion>(`/strategies/${strategyId}/discussions`, {
        title: newTitle.trim(),
        body: newBody,
      });
      setDiscussions(prev => [created, ...prev]);
      setNewTitle('');
      setNewBody('');
      setShowNewForm(false);
      setActiveDiscussion(created);
    } catch (err) {
      console.error('Failed to create discussion:', err);
    }
  }, [strategyId, newTitle, newBody]);

  const deleteDiscussion = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/discussions/${id}`);
      setDiscussions(prev => prev.filter(d => d.id !== id));
      if (activeDiscussion?.id === id) setActiveDiscussion(null);
    } catch (err) {
      console.error('Failed to delete discussion:', err);
    }
  }, [activeDiscussion]);

  // Thread view
  if (activeDiscussion) {
    return (
      <div className="discussions-page">
        <div className="discussions-page-header">
          <button className="disc-back-btn" onClick={() => { setActiveDiscussion(null); fetchDiscussions(); }}>
            <FontAwesomeIcon icon={faArrowLeft} /> {t('disc.allDiscussions')}
          </button>
        </div>
        <div className="disc-thread">
          <h2 className="disc-thread-title">{activeDiscussion.title}</h2>
          <div className="disc-thread-meta">
            <span>{activeDiscussion.createdBy}</span>
            <span>{timeAgo(activeDiscussion.createdAt)}</span>
          </div>
          {activeDiscussion.body && (
            <div className="disc-thread-body">
              <RichViewer content={activeDiscussion.body} />
            </div>
          )}
          <div className="disc-thread-comments">
            <CommentThread
              strategyId={strategyId}
              targetType="discussion"
              targetId={activeDiscussion.id}
            />
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="discussions-page">
      <div className="discussions-page-header">
        <h2 className="discussions-page-title">
          <FontAwesomeIcon icon={faComments} /> {t('disc.title')}
        </h2>
        <button className="disc-new-btn" onClick={() => setShowNewForm(true)}>
          <FontAwesomeIcon icon={faPlus} /> {t('disc.new')}
        </button>
      </div>

      {showNewForm && (
        <div className="disc-new-form">
          <input
            className="disc-title-input"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder={t('disc.titlePlaceholder')}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && newTitle.trim()) createDiscussion(); }}
          />
          <RichEditor
            content={newBody}
            onChange={setNewBody}
            placeholder={t('disc.bodyPlaceholder')}
            compact
          />
          <div className="disc-form-actions">
            <button className="disc-cancel-btn" onClick={() => { setShowNewForm(false); setNewTitle(''); setNewBody(''); }}>
              {t('cancel')}
            </button>
            <button className="disc-create-btn" onClick={createDiscussion} disabled={!newTitle.trim()}>
              {t('disc.createDiscussion')}
            </button>
          </div>
        </div>
      )}

      <div className="disc-list">
        {loading ? (
          <div className="disc-empty">{t('loading')}</div>
        ) : discussions.length === 0 ? (
          <div className="disc-empty">
            {t('disc.empty')}
          </div>
        ) : (
          discussions.map(d => (
            <div key={d.id} className="disc-item" onClick={() => setActiveDiscussion(d)}>
              <div className="disc-item-title">{d.title}</div>
              <div className="disc-item-meta">
                <span className="disc-item-author">{d.createdBy}</span>
                <span className="disc-item-time">{timeAgo(d.createdAt)}</span>
                <span className="disc-item-count">{t('disc.replyCount', { count: d.commentCount })}</span>
                <button className="disc-item-delete" onClick={e => deleteDiscussion(d.id, e)} title={t('delete')}>
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
