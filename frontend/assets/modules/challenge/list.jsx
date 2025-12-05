/* eslint-disable react-hooks/exhaustive-deps */

'use client';

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import useChallenge from '#js/useChallenge';
import { ChallengeStatus } from '#js/constants';
import ChallengeCard from '#components/challenge/ChallengeCard';
import Spinner from '#components/common/Spinner';
import Pagination from '#components/common/Pagination';
import { Button } from '#components/common/Button';
import styles from './list.module.css';

export default function ChallengeList() {
  const { loading, getChallenges, getChallengeParticipants, assignChallenge } =
    useChallenge();

  const [challenges, setChallenges] = useState([]);
  const [participantsMap, setParticipantsMap] = useState({});
  const [error, setError] = useState(null);
  const [pending, setPending] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.ceil(challenges.length / pageSize);

  // Store getChallengeParticipants in a ref to avoid infinite loops
  const getChallengeParticipantsRef = useRef(getChallengeParticipants);

  useEffect(() => {
    getChallengeParticipantsRef.current = getChallengeParticipants;
  }, [getChallengeParticipants]);

  const load = useCallback(async () => {
    setError(null);
    setParticipantsMap({});
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

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return challenges.slice(startIndex, endIndex);
  }, [challenges, currentPage]);

  useEffect(() => {
    if (!currentItems.length) return;

    const itemsToFetch = currentItems.filter(
      (c) => participantsMap[c.id] === undefined
    );

    if (itemsToFetch.length === 0) return;

    const fetchParticipantsForPage = async () => {
      const newCounts = {};

      await Promise.all(
        itemsToFetch.map(async (challenge) => {
          try {
            const res = await getChallengeParticipantsRef.current(challenge.id);
            if (res?.success && Array.isArray(res.data)) {
              newCounts[challenge.id] = res.data.length;
            } else {
              newCounts[challenge.id] = 0;
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            newCounts[challenge.id] = 0;
          }
        })
      );

      setParticipantsMap((prev) => ({ ...prev, ...newCounts }));
    };

    fetchParticipantsForPage();
    // participantsMap is intentionally excluded to prevent infinite loop:
    // - We read from it to filter items, but updating it would retrigger this effect
    // - The effect should only run when currentItems changes (new challenges to fetch)
  }, [currentItems]); // eslint-disable-line react-hooks/exhaustive-deps

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
        {currentItems.map((challenge) => {
          const studentCount = participantsMap[challenge.id] || 0;
          const hasStudents = studentCount > 0;
          const now = new Date();
          const canStartNow =
            challenge.startDatetime && new Date(challenge.startDatetime) <= now;
          return (
            <ChallengeCard
              key={challenge.id ?? challenge.title}
              challenge={{ ...challenge, participants: studentCount }}
              href={`/challenges/${challenge.id}`}
              actions={
                // eslint-disable-next-line no-nested-ternary
                challenge.status === ChallengeStatus.PUBLIC && canStartNow ? (
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      if (!hasStudents) {
                        setError('No students have joined this challenge yet.');
                        return;
                      }

                      if (!canStartNow) {
                        setError(
                          'The challenge start time has not been reached yet.'
                        );
                        return;
                      }
                      handleAssign(challenge.id);
                    }}
                    disabled={pending[challenge.id]?.assign}
                    size='sm'
                  >
                    {pending[challenge.id]?.assign
                      ? 'Assigning...'
                      : 'Assign students'}
                  </Button>
                ) : challenge.status === ChallengeStatus.ASSIGNED ? (
                  <Button variant='secondary' size='sm'>
                    Start
                  </Button>
                ) : null
              }
            />
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
