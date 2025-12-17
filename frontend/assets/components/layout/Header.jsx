'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import logo from '#img/logo.jpg';
import { Button } from '#components/common/Button';
import { useAppDispatch, useAppSelector } from '#js/store/hooks';
import { fetchUserInfo, logoutUser } from '#js/store/slices/auth';
import styles from './Header.module.css';

export default function Header() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isDark, setIsDark] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, isLoggedIn, loading } = useAppSelector((state) => state.auth);
  const fetchedUserRef = useRef(false);

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

  useEffect(() => {
    if (fetchedUserRef.current || loading || isLoggedIn || user) return;
    fetchedUserRef.current = true;
    dispatch(fetchUserInfo());
  }, [dispatch, isLoggedIn, loading, user]);

  const navLinks = useMemo(() => {
    if (isLoggedIn && user?.role === 'student') {
      return [{ href: '/student/challenges', label: 'Students' }];
    }
    if (isLoggedIn) {
      return [
        { href: '/', label: 'Dashboard' },
        { href: '/challenges', label: 'Challenges' },
        { href: '/new-challenge', label: 'New Challenge' },
      ];
    }
    return [];
  }, [isLoggedIn, user]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await dispatch(logoutUser()).unwrap();
      router.push('/login');
    } catch (err) {
      setIsLoggingOut(false);
      return;
    }
    setIsLoggingOut(false);
  };

  const handleLogin = () => {
    router.push('/login');
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
        {navLinks.length > 0 && (
          <nav className={styles.nav}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={styles['nav-link']}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

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
        {isLoggedIn && user ? (
          <div className={styles.user}>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{user.username}</span>
              <span className={styles.userRole}>{user.role}</span>
            </div>
            <Button
              variant='ghost'
              size='sm'
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Logout…' : 'Logout'}
            </Button>
          </div>
        ) : (
          <Button variant='secondary' size='sm' onClick={handleLogin}>
            Login
          </Button>
        )}
      </div>
    </header>
  );
}
