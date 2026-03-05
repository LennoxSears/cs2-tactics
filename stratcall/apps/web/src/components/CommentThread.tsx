import { useState, useEffect, useCallback, useRef } from 'react';
import RichEditor, { RichViewer } from './RichEditor';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faReply, faTrash } from '@fortawesome/free-solid-svg-icons';
import { api } from '../lib/api';
import type { Comment, CommentTargetType } from '../types';

interface Props {
  strategyId: string;
  targetType: CommentTargetType;
  targetId: string;
  compact?: boolean; // smaller layout for token notes
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

export default function CommentThread({ strategyId, targetType, targetId, compact }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    try {
      const data = await api.get<Comment[]>(
        `/comments?strategyId=${strategyId}&targetType=${targetType}&targetId=${targetId}`
      );
      setComments(data);
    } catch {
      // API may not be reachable in local dev — fall back silently
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [strategyId, targetType, targetId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [comments.length]);

  const addComment = useCallback(async () => {
    if (isContentEmpty(draft)) return;
    try {
      const created = await api.post<Comment>('/comments', {
        strategyId,
        targetType,
        targetId,
        parentId: replyTo,
        body: draft,
      });
      setComments(prev => [...prev, created]);
      setDraft('');
      setReplyTo(null);
    } catch (err) {
      console.error('Failed to post comment:', err);
    }
  }, [draft, replyTo, strategyId, targetType, targetId]);

  const deleteComment = useCallback(async (id: string) => {
    try {
      const result = await api.delete<{ ok: boolean; deleted: number }>(`/comments/${id}`);
      if (result.ok) {
        // Re-fetch to get accurate state after recursive delete
        fetchComments();
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
    if (replyTo === id) setReplyTo(null);
  }, [fetchComments, replyTo]);

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

  if (loading) {
    return <div className="comment-empty">Loading...</div>;
  }

  return (
    <div className={`comment-thread${compact ? ' compact' : ''}`}>
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
    </div>
  );
}
