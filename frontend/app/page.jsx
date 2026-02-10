'use client';

import useRoleGuard from '#js/useRoleGuard';
import ChallengeList from '#modules/challenge/list';

import styles from './page.module.css';

export default function HomePage() {
  const { isAuthorized } = useRoleGuard({
    allowedRoles: ['teacher', 'admin'],
  });

  if (!isAuthorized) return null;

  return (
    <section className={styles.container}>
      <ChallengeList />
    </section>
  );
}
