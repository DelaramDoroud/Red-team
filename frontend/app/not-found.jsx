'use client';

import Link from 'next/link';
import styles from './not-found.module.scss';

export default function NotFound() {
  return (
    <div className={styles.container}>
      <h1>404 – Page not found</h1>
      <p>The page you are looking for does not exist in this demo app.</p>
      <Link href='/' className={styles.link}>
        Go back to dashboard
      </Link>
    </div>
  );
}
