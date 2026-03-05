import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLayerGroup,
  faUsers,
  faShareNodes,
  faChessBoard,
} from '@fortawesome/free-solid-svg-icons';
import { faSteam } from '@fortawesome/free-brands-svg-icons';

interface Props {
  onLogin: () => void;
}

const features = [
  {
    icon: faLayerGroup,
    title: 'Multi-Phase Strategies',
    desc: 'Break plays into sequential phases — setup, utility, entry, post-plant. Step through them like a real playbook.',
  },
  {
    icon: faChessBoard,
    title: 'Playbook Organization',
    desc: 'Folders, tags, favorites, and 4-axis filtering. Find the right strat in seconds during a match.',
  },
  {
    icon: faUsers,
    title: 'Team Playbooks',
    desc: 'Share playbooks with your team. Assign roles, build scouting reports, prepare for match day.',
  },
  {
    icon: faShareNodes,
    title: 'Community Library',
    desc: 'Browse and import strategies from other players. Share your best strats with the community.',
  },
];

export default function Homepage({ onLogin }: Props) {
  return (
    <div className="homepage">
      <nav className="hp-nav">
        <div className="hp-nav-logo">StratCall</div>
        <button className="hp-nav-login" onClick={onLogin}>
          <FontAwesomeIcon icon={faSteam} /> Sign in with Steam
        </button>
      </nav>

      <section className="hp-hero">
        <h1 className="hp-hero-title">
          Your CS2 <span className="accent-gradient">Tactical Playbook</span>
        </h1>
        <p className="hp-hero-sub">
          Draw strategies, organize playbooks, share with your team.
          Built for IGLs and coaches who think in rounds.
        </p>
        <button className="hp-hero-cta" onClick={onLogin}>
          <FontAwesomeIcon icon={faSteam} /> Get Started with Steam
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
        <h2 className="hp-section-title">All Active Duty Maps</h2>
        <p className="hp-section-sub">
          Mirage · Inferno · Dust II · Nuke · Overpass · Ancient · Anubis · Vertigo · Train · Cache · Cobblestone
        </p>
      </section>

      <footer className="hp-footer">
        <span>StratCall</span>
        <span className="hp-footer-sep">·</span>
        <span>CS2 Tactical Platform</span>
      </footer>
    </div>
  );
}
