'use client';

import Link from 'next/link';
import Image from 'next/image';
import logo from '#img/logo.jpg';
import styles from './Header.module.scss';

export default function Header() {
  return (
    <header className={styles.header}>
      <Link href='/' className={styles.logo}>
        <span className={styles['logo-mark']}>
          {' '}
          <Image
            src={logo}
            alt='CodyMatch Logo'
            fill
            sizes='32px'
            className={styles['logo-image']}
          />
        </span>
        <span className={styles['logo-text']}>CodyMatch</span>
      </Link>
      <nav className={styles.nav}>
        <Link href='/' className={styles['nav-link']}>
          Dashboard
        </Link>
        <Link href='/challenges' className={styles['nav-link']}>
          Challenges
        </Link>
        <Link href='/student/challenges' className={styles['nav-link']}>
          Students
        </Link>
        <Link href='/newChallenge' className={styles['nav-link']}>
          New Challenge
        </Link>
      </nav>
    </header>
  );
}
