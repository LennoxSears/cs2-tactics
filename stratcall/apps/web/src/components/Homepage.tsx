import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLayerGroup,
  faUsers,
  faShareNodes,
  faChessBoard,
  faDesktop,
} from '@fortawesome/free-solid-svg-icons';
import { faSteam } from '@fortawesome/free-brands-svg-icons';
import { useLocale } from '../lib/i18n';
import { isDesktop } from '../lib/demoParser';
import LanguageSwitcher from './LanguageSwitcher';

interface Props {
  onLogin: () => void;
  onDownload: () => void;
}

export default function Homepage({ onLogin, onDownload }: Props) {
  const { t } = useLocale();

  const features = [
    { icon: faLayerGroup, title: t('hp.featureMultiPhaseTitle'), desc: t('hp.featureMultiPhaseDesc') },
    { icon: faChessBoard, title: t('hp.featurePlaybookTitle'), desc: t('hp.featurePlaybookDesc') },
    { icon: faUsers, title: t('hp.featureTeamTitle'), desc: t('hp.featureTeamDesc') },
    { icon: faShareNodes, title: t('hp.featureCommunityTitle'), desc: t('hp.featureCommunityDesc') },
  ];

  return (
    <div className="homepage">
      <nav className="hp-nav">
        <div className="hp-nav-logo">StratCall</div>
        <div className="hp-nav-right">
          {!isDesktop() && (
            <button className="hp-nav-link" onClick={onDownload}>
              <FontAwesomeIcon icon={faDesktop} /> <span>{t('dl.navDownload')}</span>
            </button>
          )}
          <LanguageSwitcher />
          <button className="hp-nav-login" onClick={onLogin}>
            <FontAwesomeIcon icon={faSteam} /> {t('hp.signInSteam')}
          </button>
        </div>
      </nav>

      <section className="hp-hero">
        <h1 className="hp-hero-title">
          {t('hp.heroTitle', { accent: '' })}<span className="accent-gradient">{t('hp.heroAccent')}</span>
        </h1>
        <p className="hp-hero-sub">{t('hp.heroSub')}</p>
        <button className="hp-hero-cta" onClick={onLogin}>
          <FontAwesomeIcon icon={faSteam} /> {t('hp.getStarted')}
        </button>
      </section>

      <section className="hp-features">
        {features.map((f, i) => (
          <div key={i} className="hp-feature-card">
            <div className="hp-feature-icon">
              <FontAwesomeIcon icon={f.icon} />
            </div>
            <h3 className="hp-feature-title">{f.title}</h3>
            <p className="hp-feature-desc">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="hp-maps">
        <h2 className="hp-section-title">{t('hp.allMaps')}</h2>
        <p className="hp-section-sub">{t('hp.mapList')}</p>
      </section>

      <footer className="hp-footer">
        <span>StratCall</span>
        <span className="hp-footer-sep">·</span>
        <span>{t('hp.footer')}</span>
      </footer>
    </div>
  );
}
