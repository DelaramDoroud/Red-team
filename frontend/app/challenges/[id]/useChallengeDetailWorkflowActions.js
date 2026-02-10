import { useCallback } from 'react';
import { getApiErrorMessage } from '#js/apiError';
import { parseJsonValue } from './challengeDetailUtils';

const PEER_REVIEW_STARTED_MESSAGE = 'Peer review started successfully.';

const parseExpectedReviews = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 2) {
    return null;
  }
  return parsed;
};

const buildPeerReviewMessages = ({ assignments, results }) => {
  const assignmentMap = new Map(
    assignments.map((group) => [
      group.challengeMatchSettingId,
      group.matchSetting?.problemTitle || null,
    ])
  );

  const messages = [];
  let assignedCount = 0;

  results.forEach((result) => {
    const label = assignmentMap.get(result.challengeMatchSettingId);
    const prefix = label
      ? `${label}: `
      : `Match setting ${result.challengeMatchSettingId}: `;

    if (result.status === 'assigned') {
      assignedCount += 1;
      if (result.teacherMessage) {
        messages.push({
          tone: 'warning',
          text: `${prefix}${result.teacherMessage}`,
        });
      }
      return;
    }

    if (result.status === 'insufficient_valid_submissions') {
      messages.push({
        tone: 'warning',
        text: `${prefix}Not enough valid submissions to assign peer reviews.`,
      });
      return;
    }

    if (result.teacherMessage) {
      messages.push({
        tone: 'error',
        text: `${prefix}${result.teacherMessage}`,
      });
      return;
    }

    messages.push({
      tone: 'error',
      text: `${prefix}Unable to assign peer reviews.`,
    });
  });

  if (assignedCount > 0) {
    messages.unshift({
      tone: 'success',
      text: `Peer reviews assigned for ${assignedCount} match setting${
        assignedCount === 1 ? '' : 's'
      }.`,
    });
  }

  return messages;
};

export default function useChallengeDetailWorkflowActions({
  addMatchSettingPrivateTest,
  assignChallenge,
  assignPeerReviews,
  assignments,
  challenge,
  challengeId,
  expectedReviews,
  expectedReviewsLocked,
  load,
  privateTestActions,
  setAssigning,
  setAssigningReviews,
  setError,
  setExpectedReviews,
  setExpectedReviewsError,
  setExpectedReviewsSaved,
  setPeerReviewMessages,
  setPrivateTestActions,
  setSavingExpectedReviews,
  setStarting,
  setStartingPeerReview,
  startChallenge,
  startPeerReview,
  studentCount,
  updateExpectedReviews,
}) {
  const handleAddPrivateTest = useCallback(
    async ({ matchSettingId, assignmentId, testCaseInput, expectedOutput }) => {
      if (!challengeId || !matchSettingId || !assignmentId) return;
      const actionKey = `assignment-${assignmentId}`;
      if (privateTestActions[actionKey]?.status === 'saving') return;

      const parsedInput = parseJsonValue(testCaseInput);
      const parsedOutput = parseJsonValue(expectedOutput);
      if (!parsedInput.ok || !parsedOutput.ok) {
        setPrivateTestActions((prev) => ({
          ...prev,
          [actionKey]: {
            status: 'error',
            message: 'Input and output must be valid JSON values.',
          },
        }));
        return;
      }

      setPrivateTestActions((prev) => ({
        ...prev,
        [actionKey]: { status: 'saving', message: '' },
      }));

      try {
        const res = await addMatchSettingPrivateTest({
          challengeId,
          matchSettingId,
          assignmentId,
          input: parsedInput.value,
          output: parsedOutput.value,
        });

        if (res?.success) {
          setPrivateTestActions((prev) => ({
            ...prev,
            [actionKey]: {
              status: 'saved',
              message: res?.data?.added
                ? 'Added to private tests.'
                : 'Already in private tests.',
            },
          }));
          return;
        }

        setPrivateTestActions((prev) => ({
          ...prev,
          [actionKey]: {
            status: 'error',
            message: getApiErrorMessage(
              res,
              'Unable to add this test to private tests.'
            ),
          },
        }));
      } catch (err) {
        setPrivateTestActions((prev) => ({
          ...prev,
          [actionKey]: {
            status: 'error',
            message: getApiErrorMessage(
              err,
              'Unable to add this test to private tests.'
            ),
          },
        }));
      }
    },
    [
      addMatchSettingPrivateTest,
      challengeId,
      privateTestActions,
      setPrivateTestActions,
    ]
  );

  const handleAssign = useCallback(async () => {
    if (!challengeId) return;
    const now = Date.now();
    const canStartNow =
      challenge?.startDatetime &&
      new Date(challenge.startDatetime).getTime() <= now;

    if (!canStartNow) {
      setError('The challenge start time has not been reached yet.');
      return;
    }
    if (!studentCount) {
      setError('No students have joined this challenge yet.');
      return;
    }

    setAssigning(true);
    setError(null);
    try {
      const res = await assignChallenge(challengeId);
      if (res?.success === false) {
        setError(getApiErrorMessage(res, 'Unable to assign students'));
      }
      await load();
    } catch {
      setError('Unable to assign students');
    } finally {
      setAssigning(false);
    }
  }, [
    assignChallenge,
    challenge?.startDatetime,
    challengeId,
    load,
    setAssigning,
    setError,
    studentCount,
  ]);

  const handleStart = useCallback(async () => {
    if (!challengeId) return;
    setStarting(true);
    setError(null);
    try {
      const res = await startChallenge(challengeId);
      if (res?.success === false) {
        setError(getApiErrorMessage(res, 'Unable to start challenge'));
      }
      await load();
    } catch {
      setError('Unable to start challenge');
    } finally {
      setStarting(false);
    }
  }, [challengeId, load, setError, setStarting, startChallenge]);

  const handleAssignReviews = useCallback(async () => {
    if (!challengeId) return;
    const parsed = parseExpectedReviews(expectedReviews);
    if (!parsed) {
      setExpectedReviewsError(
        'Enter a whole number greater than or equal to 2.'
      );
      return;
    }

    setExpectedReviewsError('');
    setAssigningReviews(true);
    setError(null);
    setPeerReviewMessages([]);

    try {
      const res = await assignPeerReviews(challengeId, parsed);
      if (res?.success === false) {
        setError(getApiErrorMessage(res, 'Unable to assign peer reviews'));
        return;
      }

      if (Array.isArray(res?.results)) {
        setPeerReviewMessages(
          buildPeerReviewMessages({
            assignments,
            results: res.results,
          })
        );
      }
      await load();
    } catch {
      setError('Unable to assign peer reviews');
    } finally {
      setAssigningReviews(false);
    }
  }, [
    assignPeerReviews,
    assignments,
    challengeId,
    expectedReviews,
    load,
    setAssigningReviews,
    setError,
    setExpectedReviewsError,
    setPeerReviewMessages,
  ]);

  const handleStartPeerReview = useCallback(async () => {
    if (!challengeId) return;
    setStartingPeerReview(true);
    setError(null);
    try {
      const res = await startPeerReview(challengeId);
      if (res?.success === false) {
        setError(getApiErrorMessage(res, 'Unable to start peer review'));
        return;
      }
      setPeerReviewMessages([
        {
          tone: 'success',
          text: PEER_REVIEW_STARTED_MESSAGE,
        },
      ]);
      await load();
    } catch {
      setError('Unable to start peer review');
    } finally {
      setStartingPeerReview(false);
    }
  }, [
    challengeId,
    load,
    setError,
    setPeerReviewMessages,
    setStartingPeerReview,
    startPeerReview,
  ]);

  const handleSaveExpectedReviews = useCallback(async () => {
    if (!challengeId || expectedReviewsLocked) return;

    const parsed = parseExpectedReviews(expectedReviews);
    if (!parsed) {
      setExpectedReviewsError(
        'Enter a whole number greater than or equal to 2.'
      );
      setExpectedReviewsSaved('');
      return;
    }

    setExpectedReviewsError('');
    setExpectedReviewsSaved('');
    setSavingExpectedReviews(true);
    setError(null);

    try {
      const res = await updateExpectedReviews(challengeId, parsed);
      if (res?.success === false) {
        setExpectedReviewsError(
          getApiErrorMessage(res, 'Unable to save expected reviews.')
        );
        return;
      }

      setExpectedReviews(String(parsed));
      setExpectedReviewsSaved('Saved.');
      await load();
    } catch {
      setExpectedReviewsError('Unable to save expected reviews.');
    } finally {
      setSavingExpectedReviews(false);
    }
  }, [
    challengeId,
    expectedReviews,
    expectedReviewsLocked,
    load,
    setError,
    setExpectedReviews,
    setExpectedReviewsError,
    setExpectedReviewsSaved,
    setSavingExpectedReviews,
    updateExpectedReviews,
  ]);

  return {
    handleAddPrivateTest,
    handleAssign,
    handleStart,
    handleAssignReviews,
    handleStartPeerReview,
    handleSaveExpectedReviews,
  };
}
