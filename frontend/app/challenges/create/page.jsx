'use client';

import ChallengeForm from '#components/challenge/ChallengeForm';
import styles from './page.module.scss';

export default function CreateChallengePage() {
  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <h1>Create New Challenge</h1>
        <p>
          Fill in the details below to create a new challenge. Select one or
          more ready match settings to include in this challenge.
          {/* TODO */}
        </p>
      </header>

      <ChallengeForm />
    </section>
  );
}
