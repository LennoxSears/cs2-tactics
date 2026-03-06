import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faStar, faCodeFork, faUserPlus, faComment, faReply, faCheck } from '@fortawesome/free-solid-svg-icons';

interface Notification {
  id: string;
  recipientId: string;
  actorId: string;
  type: 'follow' | 'star' | 'fork' | 'comment' | 'reply';
  targetId: string | null;
  targetName: string | null;
  isRead: boolean;
  createdAt: number;
  actor: {
    displayName: string;
    avatarUrl: string | null;
  };
}

interface Props {
  onViewUser?: (userId: string) => void;
}

const TYPE_ICON = {
  follow: faUserPlus,
  star: faStar,
  fork: faCodeFork,
  comment: faComment,
  reply: faReply,
};

const TYPE_LABEL = {
  follow: 'followed you',
  star: 'starred',
  fork: 'forked',
  comment: 'commented on',
  reply: 'replied on',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationBell({ onViewUser }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchUnread = useCallback(() => {
    api.get<{ count: number }>('/notifications/unread-count')
      .then(r => setUnreadCount(r.count))
      .catch(() => {});
  }, []);

  const fetchNotifications = useCallback(() => {
    api.get<Notification[]>('/notifications')
      .then(setNotifications)
      .catch(() => {});
  }, []);

  // Poll unread count every 30s
  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(!open);
    if (!open) fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    await api.patch('/notifications/read-all', {});
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleClick = async (n: Notification) => {
    if (!n.isRead) {
      await api.patch(`/notifications/${n.id}/read`, {});
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
      setUnreadCount(c => Math.max(0, c - 1));
    }
    if (n.type === 'follow' && onViewUser) {
      onViewUser(n.actorId);
      setOpen(false);
    }
  };

  return (
    <div className="notif-bell" ref={ref}>
      <button className="notif-bell-btn" onClick={handleOpen} title="Notifications">
        <FontAwesomeIcon icon={faBell} />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-title">Notifications</span>
            {unreadCount > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAllRead}>
                <FontAwesomeIcon icon={faCheck} /> Mark all read
              </button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 && (
              <div className="notif-empty">No notifications yet</div>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                className={`notif-item ${n.isRead ? '' : 'unread'}`}
                onClick={() => handleClick(n)}
              >
                <div className="notif-icon-wrap">
                  <FontAwesomeIcon icon={TYPE_ICON[n.type]} className={`notif-type-icon ${n.type}`} />
                </div>
                <div className="notif-body">
                  <span className="notif-text">
                    <strong>{n.actor.displayName}</strong> {TYPE_LABEL[n.type]}
                    {n.targetName && n.type !== 'follow' && <> <em>{n.targetName}</em></>}
                  </span>
                  <span className="notif-time">{timeAgo(n.createdAt)}</span>
                </div>
                {!n.isRead && <span className="notif-dot" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
