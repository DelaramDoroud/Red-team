import { useCallback, useState } from 'react';
import { ChallengeStatus } from '#js/constants';
import useChallenge from '#js/useChallenge';

const parseExpectedReviews = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 2) {
    return null;
  }
  return parsed;
};

export default function useChallengeListActions({ setChallenges, setError }) {
  const {
    publishChallenge,
    assignChallenge,
    startChallenge,
    assignPeerReviews,
    startPeerReview,
  } = useChallenge();
  const [pending, setPending] = useState({});
  const [reviewErrors, setReviewErrors] = useState({});
  const [assignNotice, setAssignNotice] = useState(null);

  const setPendingAction = useCallback((id, key, value) => {
    setPending((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [key]: value },
    }));
  }, []);

  const handleAssign = useCallback(
    async (challengeId) => {
      setError(null);
      setPendingAction(challengeId, 'assign', true);
      try {
        const res = await assignChallenge(challengeId);
        if (res?.success) {
          setChallenges((prev) =>
            prev.map((challenge) =>
              challenge.id === challengeId
                ? { ...challenge, status: ChallengeStatus.ASSIGNED }
                : challenge
            )
          );
        } else {
          setError(res?.message || 'Unable to assign students to challenge');
        }
      } catch {
        setError('Unable to assign students to challenge');
      } finally {
        setPendingAction(challengeId, 'assign', false);
      }
    },
    [assignChallenge, setChallenges, setError, setPendingAction]
  );

  const handleStart = useCallback(
    async (challengeId) => {
      setError(null);
      setPendingAction(challengeId, 'start', true);
      try {
        const res = await startChallenge(challengeId);
        if (res?.success) {
          setChallenges((prev) =>
            prev.map((challenge) =>
              challenge.id === challengeId
                ? { ...challenge, status: ChallengeStatus.STARTED_CODING_PHASE }
                : challenge
            )
          );
        } else {
          setError(res?.message || 'Unable to start challenge');
        }
      } catch {
        setError('Unable to start challenge');
      } finally {
        setPendingAction(challengeId, 'start', false);
      }
    },
    [setPendingAction, setChallenges, setError, startChallenge]
  );

  const handleAllowedNumberChange = useCallback(
    (challengeId, value) => {
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
    },
    [setChallenges]
  );

  const handleAssignReviews = useCallback(
    async (challengeId, expectedValue) => {
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
    },
    [assignPeerReviews, setChallenges, setError, setPendingAction]
  );

  const handleStartPeerReview = useCallback(
    async (challengeId) => {
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
              ? { ...challenge, status: ChallengeStatus.STARTED_PEER_REVIEW }
              : challenge
          )
        );
      } catch {
        setError('Unable to start peer review');
      } finally {
        setPendingAction(challengeId, 'startPeerReview', false);
      }
    },
    [setPendingAction, setChallenges, setError, startPeerReview]
  );

  const handlePublish = useCallback(
    async (challenge) => {
      if (!challenge?.id) return;
      setAssignNotice(null);
      setError(null);
      setPendingAction(challenge.id, 'publish', true);
      try {
        const res = await publishChallenge(challenge.id);
        if (res?.success) {
          setAssignNotice({
            tone: 'success',
            text: 'Challenge published successfully.',
          });
          setChallenges((prev) =>
            prev.map((item) =>
              item.id === challenge.id
                ? { ...item, status: ChallengeStatus.PUBLIC }
                : item
            )
          );
          return;
        }
        setError(
          res?.error?.message || res?.message || 'Unable to publish challenge'
        );
      } catch {
        setError('Unable to publish challenge');
      } finally {
        setPendingAction(challenge.id, 'publish', false);
      }
    },
    [publishChallenge, setChallenges, setError, setPendingAction]
  );

  const handleAssignWithValidation = useCallback(
    (challengeId, hasStudents) => {
      if (!hasStudents) {
        setError('No students have joined this challenge yet.');
        return;
      }
      handleAssign(challengeId);
    },
    [handleAssign, setError]
  );

  const handleStartWithValidation = useCallback(
    (challengeId, hasStudents) => {
      if (!hasStudents) {
        setError('No students have joined this challenge yet.');
        return;
      }
      handleStart(challengeId);
    },
    [handleStart, setError]
  );

  return {
    pending,
    reviewErrors,
    assignNotice,
    handlePublish,
    handleAssignWithValidation,
    handleStartWithValidation,
    handleAssignReviews,
    handleStartPeerReview,
    handleAllowedNumberChange,
  };
}
