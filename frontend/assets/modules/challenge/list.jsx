'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import useChallenge from '#js/useChallenge';
import ChallengeCard from '#components/challenge/ChallengeCard';
import Spinner from '#components/common/Spinner';
import Pagination from '#components/common/Pagination';
import { Button } from '#components/common/Button';
import styles from './list.module.css';

export default function ChallengeList() {
  const { loading, getChallenges } = useChallenge();
  const [challenges, setChallenges] = useState([]);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.ceil(challenges.length / pageSize);

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

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentItems = challenges.slice(startIndex, endIndex);

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
        <Button variant='outline' onClick={load}>
          Refresh
        </Button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {!error && !challenges.length && !loading && (
        <p className={styles.empty}>
          No challenges yet. Try creating one from the backend.
        </p>
      )}
      <div className={styles.grid}>
        {currentItems.map((challenge, index) => {
          const hasId = challenge?.id !== undefined && challenge?.id !== null;
          const key =
            challenge.id ?? challenge.title ?? `challenge-${index + startIndex}`;
          const card = <ChallengeCard challenge={challenge} />;

          if (!hasId) {
            return (
              <div
                key={key}
                className={styles.cardLink}
                aria-disabled='true'
              >
                {card}
              </div>
            );
          }

          return (
            <Link
              key={key}
              href={`/challenges/${challenge.id}`}
              className={styles.cardLink}
            >
              {card}
            </Link>
          );
        })}
      </div>
      {challenges.length > pageSize && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </section>
  );
}
