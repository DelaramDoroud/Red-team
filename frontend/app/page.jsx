'use client';

import ChallengeList from '#modules/challenge/list';
import { Button } from '../assets/components/common/Button';
import styles from './page.module.scss';

export default function HomePage() {
  return (
    <section className={styles.container}>
      <header className={styles.hero}>
        <h1>CodyMatch demo dashboard</h1>
        <p>
          This page shows how to wire a simple Challenge list to the backend
          using <code>useFetchData</code> and a dedicated{' '}
          <code>useChallenge</code> hook.
        </p>
      </header>
      <Button>hello</Button>
      <ChallengeList />
    </section>
  );
}
