'use client';

import styles from './Footer.module.scss';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p>
        CodyMatch demo frontend ·{' '}
        <span className={styles.muted}>built for the capstone project</span>
      </p>
    </footer>
  );
}
