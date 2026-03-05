import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";

interface Props {
  workItemId: string;
}

export default function Sidebar({ workItemId }: Props) {
  const base = `/workitem/${workItemId}`;

  function linkClass({ isActive }: { isActive: boolean }) {
    return isActive ? `${styles.link} ${styles.active}` : styles.link;
  }

  return (
    <nav className={styles.sidebar} aria-label="Work item navigation">
      <NavLink to="/" className={styles.backLink}>
        &larr; Back
      </NavLink>

      <NavLink to={`${base}/overview`} className={linkClass} end>
        Overview
      </NavLink>

      <div className={styles.group}>
        <span className={styles.groupLabel}>Requirements</span>
        <NavLink to={`${base}/doc/functional`} className={linkClass}>
          Functional
        </NavLink>
        <NavLink to={`${base}/doc/acceptance-criteria`} className={linkClass}>
          Acceptance Criteria
        </NavLink>
        <NavLink to={`${base}/doc/technical-design`} className={linkClass}>
          Technical Design
        </NavLink>
      </div>

      <NavLink to={`${base}/questions`} className={linkClass}>
        Questions
      </NavLink>
      <NavLink to={`${base}/decisions`} className={linkClass}>
        Decisions
      </NavLink>
      <NavLink to={`${base}/sessions`} className={linkClass}>
        Sessions
      </NavLink>
    </nav>
  );
}
