import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWindows,
} from '@fortawesome/free-brands-svg-icons';
import {
  faDesktop,
  faFilm,
  faLayerGroup,
  faBook,
  faArrowLeft,
} from '@fortawesome/free-solid-svg-icons';
import { useLocale } from '../lib/i18n';

interface Props {
  onBack: () => void;
}

const DOWNLOAD_URL = '/downloads/stratcall-win-x64.zip';
const VERSION = '1.0.0';
const FILE_SIZE = '31 MB';

export default function DownloadPage({ onBack }: Props) {
  const { t } = useLocale();

  const features = [
    {
      icon: faLayerGroup,
      title: t('dl.featureStrats'),
      desc: t('dl.featureStratsDesc'),
    },
    {
      icon: faBook,
      title: t('dl.featurePlaybooks'),
      desc: t('dl.featurePlaybooksDesc'),
    },
    {
      icon: faFilm,
      title: t('dl.featureDemo'),
      desc: t('dl.featureDemoDesc'),
    },
  ];

  return (
    <div className="download-page">
      <nav className="hp-nav">
        <div className="hp-nav-logo" style={{ cursor: 'pointer' }} onClick={onBack}>
          StratCall
        </div>
        <button className="hp-nav-login" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} /> {t('back')}
        </button>
      </nav>

      <section className="dl-hero">
        <div className="dl-icon">
          <FontAwesomeIcon icon={faDesktop} />
        </div>
        <h1 className="dl-title">{t('dl.title')}</h1>
        <p className="dl-subtitle">{t('dl.subtitle')}</p>

        <a href={DOWNLOAD_URL} className="dl-btn dl-btn-primary" download>
          <FontAwesomeIcon icon={faWindows} />
          {t('dl.downloadWin')}
          <span className="dl-btn-meta">{VERSION} · {FILE_SIZE}</span>
        </a>


      </section>

      <section className="dl-features">
        <h2 className="dl-section-title">{t('dl.whyDesktop')}</h2>
        <div className="dl-feature-grid">
          {features.map((f, i) => (
            <div key={i} className="dl-feature-card">
              <div className="dl-feature-icon">
                <FontAwesomeIcon icon={f.icon} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="dl-instructions">
        <h2 className="dl-section-title">{t('dl.howToInstall')}</h2>
        <ol className="dl-steps">
          <li>
            <span className="dl-step-num">1</span>
            <div>
              <strong>{t('dl.step1Title')}</strong>
              <p>{t('dl.step1Desc')}</p>
            </div>
          </li>
          <li>
            <span className="dl-step-num">2</span>
            <div>
              <strong>{t('dl.step2Title')}</strong>
              <p>{t('dl.step2Desc')}</p>
            </div>
          </li>
          <li>
            <span className="dl-step-num">3</span>
            <div>
              <strong>{t('dl.step3Title')}</strong>
              <p>{t('dl.step3Desc')}</p>
            </div>
          </li>
        </ol>
      </section>

      <footer className="hp-footer">
        <span>StratCall</span>
        <span className="hp-footer-sep">·</span>
        <span>{t('hp.footer')}</span>
      </footer>
    </div>
  );
}
