import { useState, useEffect } from 'react';
import type { Strategy } from '../types';
import type { Session } from '../lib/auth';
import { api } from '../lib/api';
import { useLocale } from '../lib/i18n';
import { maps } from '../maps';
import { mapImages } from '../assets/mapImages';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faUserPlus, faUserMinus, faStar, faCodeFork } from '@fortawesome/free-solid-svg-icons';

interface UserData {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
}

interface ProfileData {
  user: UserData;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  strategies: Strategy[];
}

interface Props {
  userId: string;
  session: Session | null;
  onBack: () => void;
  onOpenStrategy?: (id: string) => void;
}

export default function UserProfile({ userId, session, onBack, onOpenStrategy }: Props) {
  const { t } = useLocale();
  const [data, setData] = useState<ProfileData | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [tab, setTab] = useState<'strategies' | 'followers' | 'following'>('strategies');
  const [followers, setFollowers] = useState<UserData[]>([]);
  const [following, setFollowing] = useState<UserData[]>([]);

  useEffect(() => {
    api.get<ProfileData>(`/community/users/${userId}`).then(setData).catch(() => {});
  }, [userId]);

  const handleFollow = async () => {
    if (!data) return;
    setFollowLoading(true);
    try {
      if (data.isFollowing) {
        await api.delete(`/community/users/${userId}/follow`);
        setData(d => d ? { ...d, isFollowing: false, followerCount: d.followerCount - 1 } : d);
      } else {
        await api.post(`/community/users/${userId}/follow`, {});
        setData(d => d ? { ...d, isFollowing: true, followerCount: d.followerCount + 1 } : d);
      }
    } catch {}
    setFollowLoading(false);
  };

  const loadFollowers = async () => {
    setTab('followers');
    const rows = await api.get<UserData[]>(`/community/users/${userId}/followers`);
    setFollowers(rows);
  };

  const loadFollowing = async () => {
    setTab('following');
    const rows = await api.get<UserData[]>(`/community/users/${userId}/following`);
    setFollowing(rows);
  };

  if (!data) return <div className="user-profile-loading">{t('loading')}</div>;

  const isOwnProfile = session?.userId === userId;

  return (
    <div className="user-profile">
      <div className="user-profile-header">
        <button className="back-btn" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} /> {t('back')}
        </button>
      </div>

      <div className="user-profile-info">
        {data.user.avatarUrl && (
          <img className="user-profile-avatar" src={data.user.avatarUrl} alt="" />
        )}
        <div className="user-profile-details">
          <h2 className="user-profile-name">{data.user.displayName}</h2>
          {data.user.bio && <p className="user-profile-bio">{data.user.bio}</p>}
          <div className="user-profile-stats">
            <button className="stat-btn" onClick={loadFollowers}>
              <strong>{data.followerCount}</strong> {t('userProfile.followers')}
            </button>
            <button className="stat-btn" onClick={loadFollowing}>
              <strong>{data.followingCount}</strong> {t('userProfile.following')}
            </button>
            <span className="stat-item">
              <strong>{data.strategies.length}</strong> {t('userProfile.publicStrategies')}
            </span>
          </div>
        </div>
        {!isOwnProfile && session && (
          <button
            className={`follow-btn ${data.isFollowing ? 'following' : ''}`}
            onClick={handleFollow}
            disabled={followLoading}
          >
            <FontAwesomeIcon icon={data.isFollowing ? faUserMinus : faUserPlus} />
            {data.isFollowing ? t('userProfile.unfollow') : t('userProfile.follow')}
          </button>
        )}
      </div>

      <div className="user-profile-tabs">
        <button className={`up-tab ${tab === 'strategies' ? 'active' : ''}`} onClick={() => setTab('strategies')}>
          {t('userProfile.tabStrategies')}
        </button>
        <button className={`up-tab ${tab === 'followers' ? 'active' : ''}`} onClick={loadFollowers}>
          {t('userProfile.tabFollowers')}
        </button>
        <button className={`up-tab ${tab === 'following' ? 'active' : ''}`} onClick={loadFollowing}>
          {t('userProfile.tabFollowing')}
        </button>
      </div>

      <div className="user-profile-content">
        {tab === 'strategies' && (
          <div className="up-strat-grid">
            {data.strategies.map(s => {
              const mapInfo = maps.find(m => m.name === s.map);
              return (
                <div key={s.id} className="up-strat-card" onClick={() => onOpenStrategy?.(s.id)}>
                  <img className="up-strat-map" src={mapImages[s.map as keyof typeof mapImages]} alt={s.map} />
                  <div className="up-strat-info">
                    <span className="up-strat-name">{s.name}</span>
                    <span className="up-strat-meta">
                      {mapInfo?.displayName} &middot; {s.side.toUpperCase()}
                    </span>
                    <span className="up-strat-social">
                      <FontAwesomeIcon icon={faStar} /> {s.starCount}
                      <FontAwesomeIcon icon={faCodeFork} /> {s.forkCount}
                    </span>
                  </div>
                </div>
              );
            })}
            {data.strategies.length === 0 && (
              <p className="up-empty">{t('userProfile.noStrategies')}</p>
            )}
          </div>
        )}

        {tab === 'followers' && (
          <div className="up-user-list">
            {followers.map(u => (
              <div key={u.id} className="up-user-item">
                {u.avatarUrl && <img className="up-user-avatar" src={u.avatarUrl} alt="" />}
                <span className="up-user-name">{u.displayName}</span>
              </div>
            ))}
            {followers.length === 0 && <p className="up-empty">{t('userProfile.noFollowers')}</p>}
          </div>
        )}

        {tab === 'following' && (
          <div className="up-user-list">
            {following.map(u => (
              <div key={u.id} className="up-user-item">
                {u.avatarUrl && <img className="up-user-avatar" src={u.avatarUrl} alt="" />}
                <span className="up-user-name">{u.displayName}</span>
              </div>
            ))}
            {following.length === 0 && <p className="up-empty">{t('userProfile.noFollowing')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
