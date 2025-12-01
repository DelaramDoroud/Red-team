'use client';

import styles from './ChallengeCard.module.css';

export default function ChallengeCard({ challenge, actions }) {
  const { title, duration, startDatetime, status } = challenge;

  const start = startDatetime ? new Date(startDatetime) : null;
  const readableDate = start ? start.toLocaleString() : 'TBD';

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {status && (
          <span className={`${styles.status} ${styles[`status-${status}`]}`}>
            {status}
          </span>
        )}
      </header>
      <dl className={styles.meta}>
        <div>
          <dt>Duration</dt>
          <dd>{duration ? `${duration} min` : '—'}</dd>
        </div>
        <div>
          <dt>Start</dt>
          <dd>{readableDate}</dd>
        </div>
      </dl>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </article>
  );
}
