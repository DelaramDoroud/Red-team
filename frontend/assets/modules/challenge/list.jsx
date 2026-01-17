'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useChallenge from '#js/useChallenge';
import { API_REST_BASE, ChallengeStatus } from '#js/constants';
import ChallengeCard from '#components/challenge/ChallengeCard';
import Spinner from '#components/common/Spinner';
import Pagination from '#components/common/Pagination';
import { Button } from '#components/common/Button';
import Timer from '#components/common/Timer';
import styles from './list.module.css';

export default function ChallengeList() {
  const {
    loading,
    getChallenges,
    getChallengeParticipants,
    assignChallenge,
    startChallenge,
    assignPeerReviews,
    startPeerReview,
  } = useChallenge();

  const [challenges, setChallenges] = useState([]);
  const [participantsMap, setParticipantsMap] = useState({});
  const [error, setError] = useState(null);
  const [pending, setPending] = useState({});
  const [countdowns, setCountdowns] = useState({});
  const [reviewErrors, setReviewErrors] = useState({});
  const [assignNotice, setAssignNotice] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.ceil(challenges.length / pageSize);

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
    if (Array.isArray(result)) setChallenges(result);
    else if (Array.isArray(result?.data)) setChallenges(result.data);
    else setChallenges([]);
  }, [getChallenges]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const source = new EventSource(`${API_REST_BASE}/events`, {
      withCredentials: true,
    });

    const handleChallengeUpdated = (event) => {
      let payload = null;
      if (event?.data) {
        try {
          payload = JSON.parse(event.data);
        } catch {
          payload = null;
        }
      }
      if (!payload?.challengeId) {
        load();
        return;
      }

      let found = false;
      setChallenges((prev) => {
        found = prev.some((challenge) => challenge.id === payload.challengeId);
        if (!found) return prev;
        return prev.map((challenge) => {
          if (challenge.id !== payload.challengeId) return challenge;
          return {
            ...challenge,
            status: payload.status ?? challenge.status,
          };
        });
      });

      if (!found) {
        load();
      }
    };

    const handleParticipantJoined = async (event) => {
      let payload = null;
      if (event?.data) {
        try {
          payload = JSON.parse(event.data);
        } catch {
          payload = null;
        }
      }
      if (!payload?.challengeId) return;

      if (typeof payload.count === 'number') {
        setParticipantsMap((prev) => ({
          ...prev,
          [payload.challengeId]: payload.count,
        }));
        return;
      }

      try {
        const res = await getChallengeParticipantsRef.current(
          payload.challengeId
        );
        const count =
          res?.success && Array.isArray(res.data) ? res.data.length : 0;
        setParticipantsMap((prev) => ({
          ...prev,
          [payload.challengeId]: count,
        }));
      } catch {
        setParticipantsMap((prev) => ({
          ...prev,
          [payload.challengeId]: 0,
        }));
      }
    };

    source.addEventListener('challenge-updated', handleChallengeUpdated);
    source.addEventListener(
      'challenge-participant-joined',
      handleParticipantJoined
    );

    return () => {
      source.close();
    };
  }, [load]);

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return challenges.slice(startIndex, endIndex);
  }, [challenges, currentPage]);

  useEffect(() => {
    if (!currentItems.length) return;
    const fetchParticipantsForPage = async () => {
      const newCounts = {};
      await Promise.all(
        currentItems.map(async (challenge) => {
          try {
            const res = await getChallengeParticipantsRef.current(challenge.id);
            newCounts[challenge.id] =
              res?.success && Array.isArray(res.data) ? res.data.length : 0;
          } catch {
            newCounts[challenge.id] = 0;
          }
        })
      );
      setParticipantsMap((prev) => ({ ...prev, ...newCounts }));
    };
    fetchParticipantsForPage();
  }, [currentItems]);

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
      if (res?.success)
        setChallenges((prev) =>
          prev.map((c) =>
            c.id === challengeId
              ? { ...c, status: ChallengeStatus.ASSIGNED }
              : c
          )
        );
      else setError(res?.message || 'Unable to assign students to challenge');
    } catch {
      setError('Unable to assign students to challenge');
    } finally {
      setPendingAction(challengeId, 'assign', false);
    }
  };

  const handleStart = async (challengeId) => {
    setError(null);
    setPendingAction(challengeId, 'start', true);
    try {
      const res = await startChallenge(challengeId);
      if (res?.success)
        setChallenges((prev) =>
          prev.map((c) =>
            c.id === challengeId
              ? { ...c, status: ChallengeStatus.STARTED_PHASE_ONE }
              : c
          )
        );
      else setError(res?.message || 'Unable to start challenge');
    } catch {
      setError('Unable to start challenge');
    } finally {
      setPendingAction(challengeId, 'start', false);
    }
  };

  const handleAllowedNumberChange = (challengeId, value) => {
    setChallenges((prev) =>
      prev.map((challenge) =>
        challenge.id === challengeId
          ? { ...challenge, allowedNumberOfReview: value }
          : challenge
      )
    );
    setReviewErrors((prev) => {
      if (!prev[challengeId]) return prev;
      const next = { ...prev };
      delete next[challengeId];
      return next;
    });
  };

  const parseExpectedReviews = (value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 2) {
      return null;
    }
    return parsed;
  };

  const handleAssignReviews = async (challengeId, expectedValue) => {
    const parsed = parseExpectedReviews(expectedValue);
    if (!parsed) {
      setReviewErrors((prev) => ({
        ...prev,
        [challengeId]:
          'Enter a whole number greater than or equal to 2 before assigning.',
      }));
      return;
    }
    setAssignNotice(null);
    setReviewErrors((prev) => {
      if (!prev[challengeId]) return prev;
      const next = { ...prev };
      delete next[challengeId];
      return next;
    });
    setPendingAction(challengeId, 'assignReviews', true);
    setError(null);
    try {
      const res = await assignPeerReviews(challengeId, parsed);
      if (res?.success === false) {
        setError(res?.message || 'Unable to assign peer reviews');
        return;
      }
      if (Array.isArray(res?.results)) {
        const assignedCount = res.results.filter(
          (result) => result.status === 'assigned'
        ).length;
        const insufficient = res.results.find(
          (result) => result.status === 'insufficient_valid_submissions'
        );
        const failed = res.results.find(
          (result) =>
            result.status !== 'assigned' &&
            result.status !== 'insufficient_valid_submissions'
        );
        const reduced = res.results.find(
          (result) => result.status === 'assigned' && result.teacherMessage
        );
        const allAssignableAssigned = res.results.every(
          (result) =>
            result.status === 'assigned' ||
            result.status === 'insufficient_valid_submissions'
        );
        if (assignedCount > 0) {
          setAssignNotice({
            tone: reduced ? 'warning' : 'success',
            text: reduced
              ? 'Peer reviews assigned, but expected reviews per submission were reduced.'
              : 'Peer reviews assigned successfully.',
          });
          if (allAssignableAssigned) {
            setChallenges((prev) =>
              prev.map((challenge) =>
                challenge.id === challengeId
                  ? { ...challenge, peerReviewReady: true }
                  : challenge
              )
            );
          }
        } else if (failed) {
          setAssignNotice({
            tone: 'error',
            text: failed.teacherMessage || 'Unable to assign peer reviews.',
          });
        } else if (insufficient) {
          setAssignNotice({
            tone: 'warning',
            text: 'Peer review could not be assigned because there are not enough valid submissions.',
          });
        }
      }
    } catch {
      setError('Unable to assign peer reviews');
    } finally {
      setPendingAction(challengeId, 'assignReviews', false);
    }
  };

  const handleStartPeerReview = async (challengeId) => {
    setAssignNotice(null);
    setPendingAction(challengeId, 'startPeerReview', true);
    setError(null);
    try {
      const res = await startPeerReview(challengeId);
      if (res?.success === false) {
        setError(res?.message || 'Unable to start peer review');
        return;
      }
      setAssignNotice({
        tone: 'success',
        text: 'Peer review started successfully.',
      });
      setChallenges((prev) =>
        prev.map((challenge) =>
          challenge.id === challengeId
            ? { ...challenge, status: ChallengeStatus.STARTED_PHASE_TWO }
            : challenge
        )
      );
    } catch {
      setError('Unable to start peer review');
    } finally {
      setPendingAction(challengeId, 'startPeerReview', false);
    }
  };

  const renderTimeLeft = (challenge) => {
    if (challenge.status === ChallengeStatus.STARTED_PHASE_ONE) {
      return (
        <Timer
          duration={challenge.duration}
          challengeId={challenge.id}
          startTime={challenge.startPhaseOneDateTime || challenge.startDatetime}
          label='Time left'
        />
      );
    }
    if (challenge.status === ChallengeStatus.STARTED_PHASE_TWO) {
      return (
        <Timer
          duration={challenge.durationPeerReview}
          challengeId={`${challenge.id}-phase-two`}
          startTime={challenge.startPhaseTwoDateTime}
          label='Time left'
        />
      );
    }
    return null;
  };

  // Countdown with persistence
  useEffect(() => {
    const timers = {};
    currentItems.forEach((challenge) => {
      if (challenge.status === ChallengeStatus.STARTED_PHASE_ONE) {
        const storageKey = `challenge-countdown-${challenge.id}`;
        let countdownValue = parseInt(localStorage.getItem(storageKey), 10);

        if (!countdownValue || countdownValue <= 0) countdownValue = 3;

        if (countdowns[challenge.id] == null)
          setCountdowns((prev) => ({
            ...prev,
            [challenge.id]: countdownValue,
          }));

        timers[challenge.id] = setInterval(() => {
          setCountdowns((prev) => {
            const current = prev[challenge.id];
            if (current <= 1) {
              clearInterval(timers[challenge.id]);
              localStorage.setItem(storageKey, 0);
              return { ...prev, [challenge.id]: 0 };
            }
            localStorage.setItem(storageKey, current - 1);
            return { ...prev, [challenge.id]: current - 1 };
          });
        }, 1000);
      }
    });
    return () => Object.values(timers).forEach(clearInterval);
  }, [currentItems, countdowns]);

  const renderActions = (challenge, studentCount) => {
    const hasStudents = studentCount > 0;
    const now = new Date();
    const canStartNow =
      challenge.startDatetime && new Date(challenge.startDatetime) <= now;

    if (challenge.status === ChallengeStatus.PUBLIC && canStartNow) {
      return (
        <Button
          onClick={(e) => {
            e.preventDefault();
            if (!hasStudents) {
              setError('No students have joined this challenge yet.');
              return;
            }
            handleAssign(challenge.id);
          }}
          disabled={pending[challenge.id]?.assign}
          size='sm'
          title='Assign students to this challenge'
        >
          {pending[challenge.id]?.assign ? 'Assigning...' : 'Assign students'}
        </Button>
      );
    }

    if (challenge.status === ChallengeStatus.ASSIGNED) {
      return (
        <Button
          variant='secondary'
          size='sm'
          onClick={(e) => {
            e.preventDefault();
            if (!hasStudents) {
              setError('No students have joined this challenge yet.');
              return;
            }
            handleStart(challenge.id);
          }}
          disabled={pending[challenge.id]?.start}
          title='Start this challenge'
        >
          {pending[challenge.id]?.start ? 'Starting...' : 'Start'}
        </Button>
      );
    }

    if (challenge.status === ChallengeStatus.STARTED_PHASE_ONE) {
      return null;
    }

    if (challenge.status === ChallengeStatus.ENDED_PHASE_ONE) {
      if (challenge.peerReviewReady) {
        return (
          <Button
            size='sm'
            onClick={(event) => {
              event.preventDefault();
              handleStartPeerReview(challenge.id);
            }}
            disabled={pending[challenge.id]?.startPeerReview}
            title='Start the peer review phase'
          >
            {pending[challenge.id]?.startPeerReview
              ? 'Starting...'
              : 'Start Peer Review'}
          </Button>
        );
      }
      return (
        <Button
          size='sm'
          onClick={(event) => {
            event.preventDefault();
            handleAssignReviews(challenge.id, challenge.allowedNumberOfReview);
          }}
          disabled={pending[challenge.id]?.assignReviews}
          title='Assign peer reviews for this challenge'
        >
          {pending[challenge.id]?.assignReviews ? 'Assigning...' : 'Assign'}
        </Button>
      );
    }

    return null;
  };

  const getNoticeClassName = (tone) => {
    if (tone === 'success') return styles.noticeSuccess;
    if (tone === 'warning') return styles.noticeWarning;
    return styles.noticeError;
  };

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
        <Button variant='outline' onClick={load} title='Refresh challenges'>
          Refresh
        </Button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {assignNotice && (
        <p
          className={`${styles.notice} ${getNoticeClassName(assignNotice.tone)}`}
        >
          {assignNotice.text}
        </p>
      )}
      {!error && !challenges.length && !loading && (
        <p className={styles.empty}>
          No challenges yet. Try creating one from the backend.
        </p>
      )}
      <div className={styles.grid}>
        {currentItems.map((challenge) => {
          const studentCount = participantsMap[challenge.id] || 0;

          return (
            <ChallengeCard
              key={challenge.id ?? challenge.title}
              challenge={{ ...challenge, participants: studentCount }}
              href={`/challenges/${challenge.id}`}
              actions={renderActions(challenge, studentCount)}
              extraInfo={renderTimeLeft(challenge)}
              onAllowedNumberChange={handleAllowedNumberChange}
              allowedNumberError={reviewErrors[challenge.id]}
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
