'use client';

import ChallengeList from '#modules/challenge/list';
import useRoleGuard from '#js/useRoleGuard';
import styles from './page.module.css';

export default function ChallengesPage() {
  const { isAuthorized } = useRoleGuard({
    allowedRoles: ['teacher', 'admin'],
  });

  if (!isAuthorized) return null;

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <h1>Challenges</h1>
        <p>
          This page lists all challenges coming from the backend. It uses{' '}
          <code>useChallenge</code> and <code>useFetchData</code> to keep the
          data logic separated from the UI.
        </p>
      </header>

      <ChallengeList />
    </section>
  );
}
