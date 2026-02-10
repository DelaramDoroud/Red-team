import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChallengeStatus } from '#js/constants';
import { useAppDispatch, useAppSelector } from '#js/store/hooks';
import { setChallengeCountdown } from '#js/store/slices/ui';
import useChallenge from '#js/useChallenge';
import useJsonSchema from '#js/useJsonSchema';
import useSseEvent from '#js/useSseEvent';
import {
  buildPublishPayload,
  COUNTDOWN_DURATION,
  isActiveStatus,
  isEndedStatus,
  isPrivateStatus,
  isUpcomingStatus,
} from './listHelpers';
import useChallengeListActions from './useChallengeListActions';

export default function useChallengeListState(scope = 'main') {
  const { loading, getChallenges, getChallengeParticipants } = useChallenge();
  const { validate } = useJsonSchema();
  const [challenges, setChallenges] = useState([]);
  const [participantsMap, setParticipantsMap] = useState({});
  const [error, setError] = useState(null);
  const [publishEligibility, setPublishEligibility] = useState({});
  const [publishValidationError, setPublishValidationError] = useState(null);
  const [publishValidationLoading, setPublishValidationLoading] =
    useState(false);
  const isPrivateView = scope === 'private';
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth?.user?.id);
  const countdowns = useAppSelector((state) => {
    if (!userId) return {};
    return state.ui.challengeCountdowns?.[userId] || {};
  });
  const countdownsRef = useRef(countdowns);
  const getChallengeParticipantsRef = useRef(getChallengeParticipants);

  const actions = useChallengeListActions({ setChallenges, setError });

  useEffect(() => {
    getChallengeParticipantsRef.current = getChallengeParticipants;
  }, [getChallengeParticipants]);

  useEffect(() => {
    countdownsRef.current = countdowns;
  }, [countdowns]);

  const load = useCallback(async () => {
    setError(null);
    const result = await getChallenges();
    if (result?.success === false) {
      setError(result.message || 'Unable to load challenges');
      setChallenges([]);
      setParticipantsMap({});
      return;
    }

    let nextChallenges = [];
    if (Array.isArray(result)) nextChallenges = result;
    else if (Array.isArray(result?.data)) nextChallenges = result.data;
    setChallenges(nextChallenges);
    setParticipantsMap((prev) => {
      if (!nextChallenges.length) return {};
      const next = {};
      nextChallenges.forEach((challenge) => {
        const challengeId = challenge?.id;
        if (!challengeId) return;
        if (Object.prototype.hasOwnProperty.call(prev, challengeId)) {
          next[challengeId] = prev[challengeId];
        }
      });
      return next;
    });
  }, [getChallenges]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChallengeUpdated = useCallback(
    (payload) => {
      if (!payload?.challengeId) {
        load();
        return;
      }

      setChallenges((prev) =>
        prev.map((challenge) => {
          if (challenge.id !== payload.challengeId) return challenge;
          return {
            ...challenge,
            status: payload.status ?? challenge.status,
          };
        })
      );
      load();
    },
    [load]
  );

  const handleParticipantJoined = useCallback(async (payload) => {
    if (!payload?.challengeId) return;
    if (typeof payload?.count === 'number') {
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
  }, []);

  useSseEvent('challenge-updated', handleChallengeUpdated);
  useSseEvent('finalization-updated', handleChallengeUpdated);
  useSseEvent('challenge-participant-joined', handleParticipantJoined);

  const privateChallenges = useMemo(
    () =>
      challenges.filter((challenge) => isPrivateStatus(challenge.status ?? '')),
    [challenges]
  );
  const nonPrivateChallenges = useMemo(
    () =>
      challenges.filter(
        (challenge) => !isPrivateStatus(challenge.status ?? '')
      ),
    [challenges]
  );
  const nowMs = Date.now();
  const activeChallenges = useMemo(
    () =>
      nonPrivateChallenges.filter((challenge) =>
        isActiveStatus(challenge, nowMs)
      ),
    [nonPrivateChallenges, nowMs]
  );
  const upcomingChallenges = useMemo(
    () =>
      nonPrivateChallenges.filter((challenge) =>
        isUpcomingStatus(challenge, nowMs)
      ),
    [nonPrivateChallenges, nowMs]
  );
  const endedChallenges = useMemo(
    () =>
      nonPrivateChallenges.filter((challenge) =>
        isEndedStatus(challenge.status ?? '')
      ),
    [nonPrivateChallenges]
  );
  const visibleChallenges = useMemo(() => {
    if (isPrivateView) return privateChallenges;
    return [...activeChallenges, ...upcomingChallenges, ...endedChallenges];
  }, [
    activeChallenges,
    endedChallenges,
    isPrivateView,
    privateChallenges,
    upcomingChallenges,
  ]);
  const participantChallenges = useMemo(
    () => (isPrivateView ? privateChallenges : nonPrivateChallenges),
    [isPrivateView, nonPrivateChallenges, privateChallenges]
  );

  useEffect(() => {
    let isActive = true;
    if (!isPrivateView || !privateChallenges.length) {
      setPublishEligibility({});
      setPublishValidationError(null);
      setPublishValidationLoading(false);
      return () => {
        isActive = false;
      };
    }

    const validateForPublish = async () => {
      setPublishValidationLoading(true);
      setPublishValidationError(null);
      try {
        const results = await Promise.all(
          privateChallenges.map(async (challenge) => {
            const payload = buildPublishPayload(challenge);
            const outcome = await validate({
              itemTypeData: { type: 'challenge-public' },
              data: payload,
              kind: 'public',
            });
            return {
              id: challenge.id,
              valid: outcome.valid,
              errors: outcome.errors,
            };
          })
        );

        if (!isActive) return;
        const nextEligibility = {};
        results.forEach((result) => {
          if (!result?.id) return;
          nextEligibility[result.id] = {
            valid: result.valid,
            errors: result.errors,
          };
        });
        setPublishEligibility(nextEligibility);
      } catch (validationError) {
        if (!isActive) return;
        setPublishEligibility({});
        setPublishValidationError(
          validationError?.message ||
            'Unable to validate challenges for publishing.'
        );
      } finally {
        if (isActive) {
          setPublishValidationLoading(false);
        }
      }
    };

    validateForPublish();
    return () => {
      isActive = false;
    };
  }, [isPrivateView, privateChallenges, validate]);

  useEffect(() => {
    if (!participantChallenges.length) return;
    const fetchParticipantsForPage = async () => {
      const newCounts = {};
      await Promise.all(
        participantChallenges.map(async (challenge) => {
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
  }, [participantChallenges]);

  useEffect(() => {
    if (!userId) return undefined;
    const timers = {};

    visibleChallenges.forEach((challenge) => {
      if (challenge.status !== ChallengeStatus.STARTED_CODING_PHASE) return;

      const storedValue = countdownsRef.current?.[challenge.id];
      const initialValue =
        typeof storedValue === 'number' ? storedValue : COUNTDOWN_DURATION;
      if (storedValue == null) {
        dispatch(
          setChallengeCountdown({
            userId,
            challengeId: challenge.id,
            value: initialValue,
          })
        );
      }
      if (initialValue <= 0) return;

      timers[challenge.id] = setInterval(() => {
        const currentValue = countdownsRef.current?.[challenge.id];
        if (typeof currentValue !== 'number') return;
        if (currentValue <= 1) {
          clearInterval(timers[challenge.id]);
          dispatch(
            setChallengeCountdown({
              userId,
              challengeId: challenge.id,
              value: 0,
            })
          );
          return;
        }
        dispatch(
          setChallengeCountdown({
            userId,
            challengeId: challenge.id,
            value: currentValue - 1,
          })
        );
      }, 1000);
    });

    return () => Object.values(timers).forEach(clearInterval);
  }, [dispatch, userId, visibleChallenges]);

  return {
    loading,
    load,
    error,
    setError,
    isPrivateView,
    participantsMap,
    publishEligibility,
    publishValidationError,
    publishValidationLoading,
    activeChallenges,
    upcomingChallenges,
    endedChallenges,
    privateChallenges,
    challenges,
    ...actions,
  };
}
