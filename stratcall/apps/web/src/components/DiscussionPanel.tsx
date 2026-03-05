import { useState, useRef, useEffect, useCallback } from 'react';
import RichEditor, { RichViewer } from './RichEditor';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faTrash, faPaperPlane, faReply } from '@fortawesome/free-solid-svg-icons';

interface Comment {
  id: string;
  parentId: string | null;
  body: string;
  createdBy: string;
  createdAt: number;
}

const COMMENTS_KEY = 'stratcall-comments';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadComments(strategyId: string): Comment[] {
  try {
    const data = localStorage.getItem(COMMENTS_KEY);
    const all: Record<string, Comment[]> = data ? JSON.parse(data) : {};
    return (all[strategyId] || []).map(c => ({ ...c, parentId: c.parentId ?? null }));
  } catch { return []; }
}

function saveComments(strategyId: string, comments: Comment[]): void {
  try {
    const data = localStorage.getItem(COMMENTS_KEY);
    const all: Record<string, Comment[]> = data ? JSON.parse(data) : {};
    all[strategyId] = comments;
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function isContentEmpty(content: string): boolean {
  if (!content) return true;
  try {
    const parsed = JSON.parse(content);
    if (parsed?.type === 'doc') {
      if (!parsed.content || parsed.content.length === 0) return true;
      if (parsed.content.length === 1 && parsed.content[0].type === 'paragraph' && !parsed.content[0].content) return true;
    }
    return false;
  } catch {
    return !content.trim();
  }
}

interface Props {
  strategyId: string;
}

export default function DiscussionPanel({ strategyId }: Props) {
  const [comments, setComments] = useState<Comment[]>(() => loadComments(strategyId));
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setComments(loadComments(strategyId));
  }, [strategyId]);

  useEffect(() => {
    if (expanded && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [comments.length, expanded]);

  const addComment = useCallback(() => {
    if (isContentEmpty(draft)) return;
    const comment: Comment = {
      id: generateId(),
      parentId: replyTo,
      body: draft,
      createdBy: 'You',
      createdAt: Date.now(),
    };
    const updated = [...comments, comment];
    setComments(updated);
    saveComments(strategyId, updated);
    setDraft('');
    setReplyTo(null);
  }, [draft, replyTo, comments, strategyId]);

  const deleteComment = useCallback((id: string) => {
    const toDelete = new Set<string>();
    const collect = (pid: string) => {
      toDelete.add(pid);
      comments.filter(c => c.parentId === pid).forEach(c => collect(c.id));
    };
    collect(id);
    const updated = comments.filter(c => !toDelete.has(c.id));
    setComments(updated);
    saveComments(strategyId, updated);
    if (replyTo && toDelete.has(replyTo)) setReplyTo(null);
  }, [comments, strategyId, replyTo]);

  const cancelReply = useCallback(() => {
    setReplyTo(null);
    setDraft('');
  }, []);

  const topLevel = comments.filter(c => !c.parentId);
  const getReplies = (parentId: string): Comment[] =>
    comments.filter(c => c.parentId === parentId);

  const replyTarget = replyTo ? comments.find(c => c.id === replyTo) : null;

  const renderComment = (c: Comment, depth: number) => {
    const replies = getReplies(c.id);
    return (
      <div key={c.id}>
        <div
          className={`comment-item${depth > 0 ? ' comment-reply' : ''}`}
          style={depth > 0 ? { marginLeft: Math.min(depth * 16, 48) } : undefined}
        >
          <div className="comment-header">
            <span className="comment-author">{c.createdBy}</span>
            <span className="comment-time">{timeAgo(c.createdAt)}</span>
            <button className="comment-action-btn" onClick={() => setReplyTo(c.id)} title="Reply">
              <FontAwesomeIcon icon={faReply} />
            </button>
            <button className="comment-delete" onClick={() => deleteComment(c.id)} title="Delete">
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
          <div className="comment-body">
            <RichViewer content={c.body} />
          </div>
        </div>
        {replies.map(r => renderComment(r, depth + 1))}
      </div>
    );
  };

  return (
    <div className={`comment-panel ${expanded ? 'expanded' : ''}`}>
      <button className="comment-panel-toggle" onClick={() => setExpanded(!expanded)}>
        <span>Comments ({comments.length})</span>
        <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronUp} />
      </button>

      {expanded && (
        <>
          <div className="comment-list" ref={listRef}>
            {comments.length === 0 ? (
              <div className="comment-empty">No comments yet.</div>
            ) : (
              topLevel.map(c => renderComment(c, 0))
            )}
          </div>
          <div className="comment-compose">
            {replyTarget && (
              <div className="comment-reply-banner">
                <FontAwesomeIcon icon={faReply} />
                <span>Replying to <strong>{replyTarget.createdBy}</strong></span>
                <button className="comment-reply-cancel" onClick={cancelReply}>✕</button>
              </div>
            )}
            <RichEditor
              content={draft}
              onChange={setDraft}
              placeholder={replyTo ? 'Write a reply...' : 'Write a comment...'}
              compact
            />
            <button
              className="comment-send-btn"
              onClick={addComment}
              disabled={isContentEmpty(draft)}
            >
              <FontAwesomeIcon icon={faPaperPlane} /> {replyTo ? 'Reply' : 'Post'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
