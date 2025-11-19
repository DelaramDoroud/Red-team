'use client';

import { useCallback, useEffect, useState } from 'react';
import useChallenge from '#js/useChallenge';
import ChallengeCard from '#components/challenge/ChallengeCard';
import Spinner from '#components/common/Spinner';
import styles from './list.module.scss';

export default function ChallengeList() {
  const { loading, getChallenges } = useChallenge();
  const [challenges, setChallenges] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    const result = await getChallenges();

    if (result?.success === false) {
      setError(result.message || 'Unable to load challenges');
      setChallenges([]);
      return;
    }

    if (Array.isArray(result)) {
      setChallenges(result);
    } else if (Array.isArray(result?.data)) {
      setChallenges(result.data);
    } else {
      setChallenges([]);
    }
  }, [getChallenges]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !challenges.length && !error) {
    return (
      <div className={styles.center}>
        <Spinner label='Loading challenges…' />
      </div>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2>Challenges</h2>
        <button type='button' onClick={load} className={styles.refresh}>
          Refresh
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {!error && !challenges.length && !loading && (
        <p className={styles.empty}>
          No challenges yet. Try creating one from the backend.
        </p>
      )}

      <div className={styles.grid}>
        {challenges.map((challenge) => (
          <ChallengeCard
            key={challenge.id ?? challenge.title}
            challenge={challenge}
          />
        ))}
      </div>
    </section>
  );
}
