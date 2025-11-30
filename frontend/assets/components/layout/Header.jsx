'use client';

import Link from 'next/link';
import Image from 'next/image';
import logo from '#img/logo.jpg';
import { useEffect, useState } from 'react';
import { Button } from '#components/common/Button';
import styles from './Header.module.css';

export default function Header() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Initialize theme from localStorage or system preference
    const stored =
      typeof window !== 'undefined' && localStorage.getItem('theme');
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const enableDark = stored ? stored === 'dark' : prefersDark;
    setIsDark(enableDark);
    document.documentElement.classList.toggle('dark', enableDark);
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      try {
        localStorage.setItem('theme', next ? 'dark' : 'light');
      } catch (e) {
        // ignore write errors (private mode, etc.)
      }
      return next;
    });
  };

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
      <div className={styles.actions}>
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
          <Link href='/new-challenge' className={styles['nav-link']}>
            New Challenge
          </Link>
        </nav>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-label={isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
          title={isDark ? 'Tema chiaro' : 'Tema scuro'}
        >
          <span aria-hidden>{isDark ? '🌞' : '🌙'}</span>
          <span className='sr-only'>Toggle theme</span>
        </Button>
      </div>
    </header>
  );
}
