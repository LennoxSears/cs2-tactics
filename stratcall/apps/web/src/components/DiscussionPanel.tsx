import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown, faChevronUp, faPlus, faTrash, faComments, faArrowLeft,
} from '@fortawesome/free-solid-svg-icons';
import RichEditor, { RichViewer } from './RichEditor';
import CommentThread from './CommentThread';
import { api } from '../lib/api';
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
  return new Date(ts).toLocaleDateString();
}

interface Props {
  strategyId: string;
}

export default function DiscussionPanel({ strategyId }: Props) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [activeDiscussion, setActiveDiscussion] = useState<Discussion | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const fetchDiscussions = useCallback(async () => {
    try {
      const data = await api.get<Discussion[]>(`/strategies/${strategyId}/discussions`);
      setDiscussions(data);
    } catch {
      setDiscussions([]);
    }
  }, [strategyId]);

  useEffect(() => {
    if (expanded) fetchDiscussions();
  }, [expanded, fetchDiscussions]);

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

  const deleteDiscussion = useCallback(async (id: string) => {
    try {
      await api.delete(`/discussions/${id}`);
      setDiscussions(prev => prev.filter(d => d.id !== id));
      if (activeDiscussion?.id === id) setActiveDiscussion(null);
    } catch (err) {
      console.error('Failed to delete discussion:', err);
    }
  }, [activeDiscussion]);

  return (
    <div className={`comment-panel ${expanded ? 'expanded' : ''}`}>
      <button className="comment-panel-toggle" onClick={() => setExpanded(!expanded)}>
        <span><FontAwesomeIcon icon={faComments} /> Discussions ({discussions.length})</span>
        <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronUp} />
      </button>

      {expanded && (
        <div className="discussion-content">
          {activeDiscussion ? (
            // Thread view — show discussion body + comments
            <div className="discussion-thread-view">
              <div className="discussion-thread-header">
                <button className="discussion-back-btn" onClick={() => setActiveDiscussion(null)}>
                  <FontAwesomeIcon icon={faArrowLeft} /> Back
                </button>
                <h4 className="discussion-thread-title">{activeDiscussion.title}</h4>
              </div>
              {activeDiscussion.body && (
                <div className="discussion-thread-body">
                  <RichViewer content={activeDiscussion.body} />
                </div>
              )}
              <CommentThread
                strategyId={strategyId}
                targetType="discussion"
                targetId={activeDiscussion.id}
              />
            </div>
          ) : (
            // List view — show all discussions
            <>
              <div className="discussion-list">
                {discussions.length === 0 && !showNewForm ? (
                  <div className="comment-empty">No discussions yet. Start one!</div>
                ) : (
                  discussions.map(d => (
                    <div key={d.id} className="discussion-item" onClick={() => setActiveDiscussion(d)}>
                      <div className="discussion-item-title">{d.title}</div>
                      <div className="discussion-item-meta">
                        <span>{d.createdBy}</span>
                        <span>{timeAgo(d.createdAt)}</span>
                        <span>{d.commentCount} {d.commentCount === 1 ? 'reply' : 'replies'}</span>
                        <button
                          className="comment-delete"
                          onClick={e => { e.stopPropagation(); deleteDiscussion(d.id); }}
                          title="Delete"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {showNewForm ? (
                <div className="discussion-new-form">
                  <input
                    className="discussion-title-input"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Discussion title..."
                    autoFocus
                  />
                  <RichEditor
                    content={newBody}
                    onChange={setNewBody}
                    placeholder="Optional description..."
                    compact
                  />
                  <div className="discussion-form-actions">
                    <button className="discussion-cancel-btn" onClick={() => { setShowNewForm(false); setNewTitle(''); setNewBody(''); }}>
                      Cancel
                    </button>
                    <button className="comment-send-btn" onClick={createDiscussion} disabled={!newTitle.trim()}>
                      Create
                    </button>
                  </div>
                </div>
              ) : (
                <div className="discussion-new-bar">
                  <button className="discussion-new-btn" onClick={() => setShowNewForm(true)}>
                    <FontAwesomeIcon icon={faPlus} /> New Discussion
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
