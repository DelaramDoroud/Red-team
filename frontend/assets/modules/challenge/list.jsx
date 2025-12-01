'use client';

import { useCallback, useEffect, useState } from 'react';
import useChallenge from '#js/useChallenge';
import { ChallengeStatus } from '#js/constants';
import ChallengeCard from '#components/challenge/ChallengeCard';
import Spinner from '#components/common/Spinner';
import Pagination from '#components/common/Pagination';
import { Button } from '#components/common/Button';
import styles from './list.module.css';

export default function ChallengeList() {
  const { loading, getChallenges, assignChallenge } = useChallenge();
  const [challenges, setChallenges] = useState([]);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState({});

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

  const setPendingAction = (id, key, value) => {
    setPending((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [key]: value },
    }));
  };

  const handleAssign = async (challengeId) => {
    setError(null);
    setPendingAction(challengeId, 'assign', true);
    try {
      const res = await assignChallenge(challengeId);
      if (res?.success) {
        setChallenges((prev) =>
          prev.map((item) =>
            item.id === challengeId
              ? { ...item, status: ChallengeStatus.ASSIGNED }
              : item
          )
        );
      } else {
        setError(
          res?.error || res?.message || 'Unable to assign students to challenge'
        );
      }
    } catch (_err) {
      setError('Unable to assign students to challenge');
    } finally {
      setPendingAction(challengeId, 'assign', false);
    }
  };

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
        {currentItems.map((challenge) => (
          <ChallengeCard
            key={challenge.id ?? challenge.title}
            challenge={challenge}
            actions={
              // eslint-disable-next-line no-nested-ternary
              challenge.status === ChallengeStatus.PUBLIC ? (
                <Button
                  onClick={() => handleAssign(challenge.id)}
                  disabled={pending[challenge.id]?.assign}
                >
                  {pending[challenge.id]?.assign
                    ? 'Assigning...'
                    : 'Assign students'}
                </Button>
              ) : challenge.status === ChallengeStatus.ASSIGNED ? (
                <Button variant='secondary' disabled>
                  Start
                </Button>
              ) : null
            }
          />
        ))}
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
