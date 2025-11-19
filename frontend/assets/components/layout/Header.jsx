'use client';

import Link from 'next/link';
import styles from './Header.module.scss';

export default function Header() {
  return (
    <header className={styles.header}>
      <Link href='/' className={styles.logo}>
        <span className={styles['logo-mark']}>{'<'}</span>
        <span className={styles['logo-text']}>CodyMatch</span>
      </Link>
      <nav className={styles.nav}>
        <Link href='/' className={styles['nav-link']}>
          Dashboard
        </Link>
        <Link href='/challenges' className={styles['nav-link']}>
          Challenges
        </Link>
        <Link href='/students' className={styles['nav-link']}>
          Students
        </Link>
      </nav>
    </header>
  );
}
