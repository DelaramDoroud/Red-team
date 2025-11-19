'use client';

import styles from './Spinner.module.scss';

export default function Spinner({ label = 'Loading…' }) {
  return (
    <div
      className={styles.wrapper}
      role='status'
      aria-live='polite'
      aria-busy='true'
    >
      <span className={styles.spinner} />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
