import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { useLocale } from '../lib/i18n';
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

const TYPE_LABEL_KEY = {
  follow: 'notif.followedYou' as const,
  star: 'notif.starred' as const,
  fork: 'notif.forked' as const,
  comment: 'notif.commentedOn' as const,
  reply: 'notif.repliedOn' as const,
};

export default function NotificationBell({ onViewUser }: Props) {
  const { t } = useLocale();

  const timeAgo = (ts: number): string => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('time.justNow');
    if (mins < 60) return t('time.minsAgo', { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('time.hoursAgo', { count: hrs });
    const days = Math.floor(hrs / 24);
    return t('time.daysAgo', { count: days });
  };

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
      <button className="notif-bell-btn" onClick={handleOpen} title={t('notif.title')}>
        <FontAwesomeIcon icon={faBell} />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-title">{t('notif.title')}</span>
            {unreadCount > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAllRead}>
                <FontAwesomeIcon icon={faCheck} /> {t('notif.markAllRead')}
              </button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 && (
              <div className="notif-empty">{t('notif.empty')}</div>
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
                    <strong>{n.actor.displayName}</strong> {t(TYPE_LABEL_KEY[n.type])}
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
