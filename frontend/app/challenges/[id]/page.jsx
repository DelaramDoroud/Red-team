'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '#components/common/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import AlertDialog from '#components/common/AlertDialog';
import {
  API_REST_BASE,
  ChallengeStatus,
  getChallengeStatusLabel,
} from '#js/constants';
import useChallenge from '#js/useChallenge';
import { getApiErrorMessage } from '#js/apiError';
import useApiErrorRedirect from '#js/useApiErrorRedirect';
import { formatDateTime } from '#js/date';
import { useAppSelector } from '#js/store/hooks';

const statusTone = {
  [ChallengeStatus.PUBLIC]: 'bg-primary/10 text-primary ring-1 ring-primary/20',
  [ChallengeStatus.ASSIGNED]:
    'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-200',
  [ChallengeStatus.STARTED_PHASE_ONE]:
    'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-200',
  [ChallengeStatus.ENDED_PHASE_ONE]:
    'bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/25 dark:text-slate-200',
  [ChallengeStatus.STARTED_PHASE_TWO]:
    'bg-indigo-500/10 text-indigo-700 ring-1 ring-indigo-500/25 dark:text-indigo-200',
  [ChallengeStatus.ENDED_PHASE_TWO]:
    'bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/25 dark:text-slate-200',
  [ChallengeStatus.PRIVATE]:
    'bg-muted text-muted-foreground ring-1 ring-border',
};

const peerReviewTones = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  error: 'border-destructive/30 bg-destructive/5 text-destructive',
};

const formatTimer = (seconds) => {
  if (seconds == null) return '—';
  const safeSeconds = Math.max(0, seconds);
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(safeSeconds % 60).padStart(2, '0');
  return `${hours}:${mins}:${secs}`;
};

const COUNTDOWN_BUFFER_MS = 5000;

const getPhaseEndMs = (startValue, durationMinutes, explicitEndValue) => {
  if (explicitEndValue) {
    const explicitEnd = new Date(explicitEndValue).getTime();
    return Number.isNaN(explicitEnd) ? null : explicitEnd;
  }
  if (!startValue || !durationMinutes) return null;
  const startMs = new Date(startValue).getTime();
  if (Number.isNaN(startMs)) return null;
  return startMs + durationMinutes * 60 * 1000 + COUNTDOWN_BUFFER_MS;
};

const resolveEndDisplay = (explicitEndValue, computedEndMs) => {
  if (explicitEndValue) return explicitEndValue;
  if (computedEndMs) return new Date(computedEndMs);
  return null;
};

const getBufferedStartMs = (value) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return timestamp + COUNTDOWN_BUFFER_MS;
};

const normalizeNameValue = (value) =>
  typeof value === 'string' ? value.trim() : '';

const titleizeValue = (value) => {
  const normalized = normalizeNameValue(value);
  if (!normalized) return '';
  const base = normalized.split('@')[0];
  const cleaned = base.replace(/[_\-.]+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ');
};

const buildStudentName = (student, fallbackId) => {
  const directFirst = normalizeNameValue(student?.firstName);
  const directLast = normalizeNameValue(student?.lastName);
  if (directFirst || directLast) {
    return `${directFirst} ${directLast}`.trim();
  }

  const settings = student?.settings || {};
  const settingsFirst = normalizeNameValue(
    settings.firstName || settings.first_name || settings.givenName
  );
  const settingsLast = normalizeNameValue(
    settings.lastName || settings.last_name || settings.surname
  );
  if (settingsFirst || settingsLast) {
    return `${settingsFirst} ${settingsLast}`.trim();
  }

  const settingsFull = normalizeNameValue(
    settings.fullName || settings.full_name || settings.name
  );
  if (settingsFull) return settingsFull;

  const username = titleizeValue(student?.username);
  if (username) return username;

  const email = titleizeValue(student?.email);
  if (email) return email;

  if (Number.isInteger(fallbackId)) {
    return `Student ${fallbackId}`;
  }

  return 'Student';
};

export default function ChallengeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const {
    getChallengeMatches,
    assignChallenge,
    getChallengeParticipants,
    startChallenge,
    endCodingPhase,
    assignPeerReviews,
    updateExpectedReviews,
    startPeerReview,
    endPeerReview,
    unpublishChallenge,
    endChallenge,
  } = useChallenge();
  const challengeId = params?.id;
  const redirectOnError = useApiErrorRedirect();
  const authUser = useAppSelector((state) => state.auth.user);
  const isTeacher = authUser?.role === 'teacher';

  const [challenge, setChallenge] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assigningReviews, setAssigningReviews] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startingPeerReview, setStartingPeerReview] = useState(false);
  const [studentCount, setStudentCount] = useState(0);
  const [expectedReviews, setExpectedReviews] = useState('');
  const [expectedReviewsError, setExpectedReviewsError] = useState('');
  const [expectedReviewsSaved, setExpectedReviewsSaved] = useState('');
  const [savingExpectedReviews, setSavingExpectedReviews] = useState(false);
  const [peerReviewMessages, setPeerReviewMessages] = useState([]);
  const [phaseNow, setPhaseNow] = useState(Date.now());
  const [dangerAction, setDangerAction] = useState(null);
  const [dangerPending, setDangerPending] = useState(false);
  const getChallengeParticipantsRef = useRef(getChallengeParticipants);

  useEffect(() => {
    getChallengeParticipantsRef.current = getChallengeParticipants;
  }, [getChallengeParticipants]);

  const load = useCallback(async () => {
    if (!challengeId) return;
    setError(null);
    setLoading(true);
    try {
      const [matchesRes, participantsRes] = await Promise.all([
        getChallengeMatches(challengeId),
        getChallengeParticipants(challengeId),
      ]);

      if (matchesRes?.success) {
        setChallenge(matchesRes.challenge);
        setAssignments(matchesRes.assignments || []);
        setExpectedReviews(
          matchesRes.challenge?.allowedNumberOfReview != null
            ? String(matchesRes.challenge.allowedNumberOfReview)
            : ''
        );
        setExpectedReviewsSaved('');
      } else {
        if (redirectOnError(matchesRes)) return;
        const errorMessage = getApiErrorMessage(
          matchesRes,
          'Unable to load matches'
        );
        setError(errorMessage);
        setAssignments([]);
      }

      if (participantsRes?.success && Array.isArray(participantsRes.data)) {
        setStudentCount(participantsRes.data.length);
        setParticipants(participantsRes.data);
      } else {
        setStudentCount(0);
        setParticipants([]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load matches'));
      setAssignments([]);
      setStudentCount(0);
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  }, [
    challengeId,
    getChallengeMatches,
    getChallengeParticipants,
    redirectOnError,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!challengeId || typeof EventSource === 'undefined') return undefined;
    const source = new EventSource(`${API_REST_BASE}/events`, {
      withCredentials: true,
    });
    const handleParticipantJoined = async (event) => {
      let payload = null;
      if (event?.data) {
        try {
          payload = JSON.parse(event.data);
        } catch {
          payload = null;
        }
      }
      const payloadId = Number(payload?.challengeId);
      if (!payloadId || payloadId !== Number(challengeId)) return;
      if (typeof payload?.count === 'number') {
        setStudentCount(payload?.count);
      }
      try {
        const res = await getChallengeParticipantsRef.current(payloadId);
        if (res?.success && Array.isArray(res.data)) {
          setStudentCount(res.data.length);
          setParticipants(res.data);
        }
      } catch {
        // Keep the last known list if refresh fails.
      }
    };

    source.addEventListener(
      'challenge-participant-joined',
      handleParticipantJoined
    );

    return () => {
      source.close();
    };
  }, [challengeId]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return undefined;
    const id = setInterval(() => {
      setPhaseNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

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
    } catch (_err) {
      setError('Unable to assign students');
    } finally {
      setAssigning(false);
    }
  }, [
    assignChallenge,
    challengeId,
    load,
    studentCount,
    challenge?.startDatetime,
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
    } catch (_err) {
      setError('Unable to start challenge');
    } finally {
      setStarting(false);
    }
  }, [challengeId, load, startChallenge]);

  const parseExpectedReviews = useCallback((value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 2) {
      return null;
    }
    return parsed;
  }, []);

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
        const assignmentMap = new Map(
          assignments.map((group) => [
            group.challengeMatchSettingId,
            group.matchSetting?.problemTitle || null,
          ])
        );
        const messages = [];
        let assignedCount = 0;
        res.results.forEach((result) => {
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
          } else if (result.status === 'insufficient_valid_submissions') {
            messages.push({
              tone: 'warning',
              text: `${prefix}Not enough valid submissions to assign peer reviews.`,
            });
          } else if (result.teacherMessage) {
            messages.push({
              tone: 'error',
              text: `${prefix}${result.teacherMessage}`,
            });
          } else {
            messages.push({
              tone: 'error',
              text: `${prefix}Unable to assign peer reviews.`,
            });
          }
        });
        if (assignedCount > 0) {
          messages.unshift({
            tone: 'success',
            text: `Peer reviews assigned for ${assignedCount} match setting${
              assignedCount === 1 ? '' : 's'
            }.`,
          });
        }
        setPeerReviewMessages(messages);
      }
      await load();
    } catch (_err) {
      setError('Unable to assign peer reviews');
    } finally {
      setAssigningReviews(false);
    }
  }, [
    assignPeerReviews,
    challengeId,
    expectedReviews,
    load,
    parseExpectedReviews,
    assignments,
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
          text: 'Peer review started successfully.',
        },
      ]);
      await load();
    } catch (_err) {
      setError('Unable to start peer review');
    } finally {
      setStartingPeerReview(false);
    }
  }, [challengeId, load, startPeerReview]);

  const dangerActions = useMemo(
    () => ({
      endCoding: {
        key: 'endCoding',
        label: 'End coding phase',
        title: 'End coding phase?',
        description:
          'This will immediately stop the coding phase for all students.',
        confirmLabel: 'End coding phase',
        pendingLabel: 'Ending coding phase...',
        errorMessage: 'Unable to end the coding phase.',
        run: endCodingPhase,
      },
      endPeerReview: {
        key: 'endPeerReview',
        label: 'End peer review',
        title: 'End peer review?',
        description:
          'This will finalize peer review and lock in the current results.',
        confirmLabel: 'End peer review',
        pendingLabel: 'Ending peer review...',
        errorMessage: 'Unable to end peer review.',
        run: endPeerReview,
      },
      endChallenge: {
        key: 'endChallenge',
        label: 'End challenge',
        title: 'End challenge?',
        description:
          'This will immediately complete the challenge without starting peer review.',
        confirmLabel: 'End challenge',
        pendingLabel: 'Ending challenge...',
        errorMessage: 'Unable to end the challenge.',
        run: endChallenge,
      },
    }),
    [endChallenge, endCodingPhase, endPeerReview]
  );

  const activeDangerAction = dangerAction ? dangerActions[dangerAction] : null;

  const handleConfirmDangerAction = useCallback(async () => {
    if (!challengeId || !dangerAction) return;
    const actionConfig = dangerActions[dangerAction];
    if (!actionConfig) return;
    setDangerPending(true);
    setError(null);
    try {
      const res = await actionConfig.run(challengeId);
      if (res?.success === false) {
        setError(getApiErrorMessage(res, actionConfig.errorMessage));
        return;
      }
      setDangerAction(null);
      await load();
    } catch (_err) {
      setError(actionConfig.errorMessage);
    } finally {
      setDangerPending(false);
    }
  }, [challengeId, dangerAction, dangerActions, load]);

  const handleCancelDangerAction = useCallback(() => {
    if (dangerPending) return;
    setDangerAction(null);
  }, [dangerPending]);

  const handleEditClick = () => {
    if (!challengeId) return;
    if (challenge?.status === ChallengeStatus.PUBLIC) {
      setEditDialogOpen(true);
      return;
    }
    router.push(`/challenges/${challengeId}/edit`);
  };

  const handleEditCancel = () => {
    setEditDialogOpen(false);
  };

  const handleConfirmUnpublish = async () => {
    if (!challengeId) return;
    setEditPending(true);
    setError(null);
    try {
      const result = await unpublishChallenge(challengeId);
      if (!result?.success) {
        setError(
          getApiErrorMessage(result, 'Unable to unpublish this challenge.')
        );
        setEditPending(false);
        return;
      }
      setEditDialogOpen(false);
      router.push(`/challenges/${challengeId}/edit`);
    } catch {
      setError('Unable to unpublish this challenge.');
    } finally {
      setEditPending(false);
    }
  };

  const hasStudents = studentCount > 0;
  const hasMatches = assignments.some((group) => group.matches?.length);
  const canStartNow = useMemo(() => {
    if (!challenge?.startDatetime) return true;
    return new Date(challenge.startDatetime).getTime() <= phaseNow;
  }, [challenge?.startDatetime, phaseNow]);
  const showStartButton =
    challenge?.status === ChallengeStatus.ASSIGNED &&
    hasStudents &&
    hasMatches &&
    canStartNow;
  const peerReviewReady = Boolean(challenge?.peerReviewReady);
  const showAssignReviewsButton =
    challenge?.status === ChallengeStatus.ENDED_PHASE_ONE && !peerReviewReady;
  const showStartPeerReviewButton =
    challenge?.status === ChallengeStatus.ENDED_PHASE_ONE && peerReviewReady;
  const showPeerReviewInProgress =
    challenge?.status === ChallengeStatus.STARTED_PHASE_TWO;
  const showEndCodingPhaseButton =
    isTeacher && challenge?.status === ChallengeStatus.STARTED_PHASE_ONE;
  const showEndPeerReviewButton =
    isTeacher && challenge?.status === ChallengeStatus.STARTED_PHASE_TWO;
  const showEndChallengeButton =
    isTeacher && challenge?.status === ChallengeStatus.ENDED_PHASE_ONE;
  const showDangerZone =
    showEndCodingPhaseButton ||
    showEndPeerReviewButton ||
    showEndChallengeButton;
  const isEditableStatus =
    challenge?.status === ChallengeStatus.PRIVATE ||
    challenge?.status === ChallengeStatus.PUBLIC;
  const requiresUnpublish = challenge?.status === ChallengeStatus.PUBLIC;
  const editDisabled =
    !isTeacher || !isEditableStatus || loading || editPending;
  const editTitle = (() => {
    if (!isTeacher) return 'Only teachers can edit challenges.';
    if (!isEditableStatus)
      return 'Challenges can only be edited before they start.';
    if (requiresUnpublish) return 'Unpublish this challenge to edit it.';
    return 'Edit this challenge.';
  })();

  const phaseStatus = challenge?.status;
  const isPhaseOneActive = phaseStatus === ChallengeStatus.STARTED_PHASE_ONE;
  const isPhaseTwoActive = phaseStatus === ChallengeStatus.STARTED_PHASE_TWO;
  const isPhaseOneComplete = useMemo(
    () =>
      phaseStatus === ChallengeStatus.ENDED_PHASE_ONE ||
      phaseStatus === ChallengeStatus.STARTED_PHASE_TWO ||
      phaseStatus === ChallengeStatus.ENDED_PHASE_TWO,
    [phaseStatus]
  );
  const isPhaseTwoComplete = phaseStatus === ChallengeStatus.ENDED_PHASE_TWO;

  const phaseOneStart =
    challenge?.startPhaseOneDateTime || challenge?.startDatetime;
  const phaseOneEndMs = getPhaseEndMs(
    phaseOneStart,
    challenge?.duration,
    challenge?.endPhaseOneDateTime
  );
  const phaseOneEndDisplay = resolveEndDisplay(
    challenge?.endPhaseOneDateTime,
    phaseOneEndMs
  );
  const phaseTwoStart = challenge?.startPhaseTwoDateTime;
  const phaseTwoEndMs = getPhaseEndMs(
    phaseTwoStart,
    challenge?.durationPeerReview,
    challenge?.endPhaseTwoDateTime
  );
  const phaseTwoEndDisplay = resolveEndDisplay(
    challenge?.endPhaseTwoDateTime,
    phaseTwoEndMs
  );

  const phaseOneTimeLeft =
    isPhaseOneActive && phaseOneEndMs
      ? Math.max(0, Math.floor((phaseOneEndMs - phaseNow) / 1000))
      : null;
  const phaseTwoTimeLeft =
    isPhaseTwoActive && phaseTwoEndMs
      ? Math.max(0, Math.floor((phaseTwoEndMs - phaseNow) / 1000))
      : null;

  const phaseOneCountdownSeconds = (() => {
    if (!isPhaseOneActive) return null;
    const bufferedStart = getBufferedStartMs(phaseOneStart);
    if (!bufferedStart) return null;
    return Math.max(0, Math.ceil((bufferedStart - phaseNow) / 1000));
  })();

  const phaseTwoCountdownSeconds = (() => {
    if (!isPhaseTwoActive) return null;
    const bufferedStart = getBufferedStartMs(phaseTwoStart);
    if (!bufferedStart) return null;
    return Math.max(0, Math.ceil((bufferedStart - phaseNow) / 1000));
  })();

  const phaseOneCardClass = useMemo(() => {
    if (isPhaseOneActive) {
      return 'border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/30';
    }
    if (isPhaseOneComplete) {
      return 'border-border/60 bg-muted/40';
    }
    return 'border-border/60 bg-card';
  }, [isPhaseOneActive, isPhaseOneComplete]);

  const phaseTwoCardClass = useMemo(() => {
    if (isPhaseTwoActive) {
      return 'border-indigo-500/40 bg-indigo-500/10 ring-1 ring-indigo-500/30';
    }
    if (isPhaseTwoComplete) {
      return 'border-border/60 bg-muted/40';
    }
    return 'border-border/60 bg-card';
  }, [isPhaseTwoActive, isPhaseTwoComplete]);

  const showPhaseTwoSubmissionCount = useMemo(
    () =>
      phaseStatus === ChallengeStatus.ENDED_PHASE_ONE ||
      phaseStatus === ChallengeStatus.STARTED_PHASE_TWO ||
      phaseStatus === ChallengeStatus.ENDED_PHASE_TWO,
    [phaseStatus]
  );
  const expectedReviewsLocked =
    phaseStatus === ChallengeStatus.STARTED_PHASE_TWO ||
    phaseStatus === ChallengeStatus.ENDED_PHASE_TWO;
  const expectedReviewsDirty =
    String(challenge?.allowedNumberOfReview ?? '') !== expectedReviews;

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
      setChallenge((prev) =>
        prev ? { ...prev, allowedNumberOfReview: parsed } : prev
      );
      setExpectedReviews(String(parsed));
      setExpectedReviewsSaved('Saved.');
    } catch (_err) {
      setExpectedReviewsError('Unable to save expected reviews.');
    } finally {
      setSavingExpectedReviews(false);
    }
  }, [
    challengeId,
    expectedReviews,
    expectedReviewsLocked,
    parseExpectedReviews,
    updateExpectedReviews,
  ]);

  const statusBadge = useMemo(() => {
    const tone =
      statusTone[challenge?.status] || statusTone[ChallengeStatus.PRIVATE];
    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${tone}`}
      >
        {getChallengeStatusLabel(challenge?.status) || '—'}
      </span>
    );
  }, [challenge?.status]);

  const expectedReviewsInput = (
    <div className='space-y-1'>
      <div className='flex flex-wrap items-center gap-2'>
        <input
          type='number'
          min='2'
          disabled={expectedReviewsLocked}
          className='h-9 w-full max-w-35 rounded-md border border-border/60 bg-background px-2 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:bg-muted/40'
          value={expectedReviews}
          onChange={(event) => {
            setExpectedReviews(event.target.value);
            setExpectedReviewsError('');
            setExpectedReviewsSaved('');
          }}
        />
        {!expectedReviewsLocked ? (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleSaveExpectedReviews}
            disabled={savingExpectedReviews || !expectedReviewsDirty}
            title='Save expected reviews per submission'
          >
            {savingExpectedReviews ? 'Saving...' : 'Save'}
          </Button>
        ) : null}
      </div>
      {expectedReviewsError ? (
        <p className='text-xs font-medium text-destructive'>
          {expectedReviewsError}
        </p>
      ) : null}
      {!expectedReviewsError && expectedReviewsSaved ? (
        <p className='text-xs font-medium text-emerald-700'>
          {expectedReviewsSaved}
        </p>
      ) : null}
    </div>
  );

  const detailItems = [
    {
      label: 'Start',
      value: formatDateTime(challenge?.startDatetime),
    },
    {
      label: 'Expected reviews / submission',
      value: expectedReviewsInput,
    },
    {
      label: 'Number of students',
      value: studentCount,
    },
  ];
  const joinedStudents = participants.map((participant) => ({
    id: participant.id,
    name: buildStudentName(
      participant.student,
      participant.studentId ?? participant.id
    ),
  }));
  const showParticipantList = !assignments.length && !error && isTeacher;

  return (
    <div className='max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6'>
      <div className='space-y-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='space-y-2'>
            <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
              Challenge overview
            </p>
            <div className='flex flex-wrap items-center gap-3'>
              <h1 className='text-3xl font-bold text-foreground'>
                {challenge?.title || 'Challenge'}
              </h1>
              {statusBadge}
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
            <Button variant='outline' asChild>
              <Link href='/challenges' title='Back to challenges list'>
                Back
              </Link>
            </Button>
            <Button
              variant='outline'
              onClick={load}
              disabled={loading}
              title='Refresh challenge details'
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
            {isTeacher ? (
              <Button
                variant='outline'
                onClick={handleEditClick}
                disabled={editDisabled}
                title={editTitle}
              >
                {editPending ? 'Unpublishing...' : 'Edit'}
              </Button>
            ) : null}
            {challenge?.status === ChallengeStatus.PUBLIC ? (
              <Button
                onClick={handleAssign}
                disabled={assigning || loading}
                title='Assign students to this challenge'
              >
                {assigning ? 'Assigning...' : 'Assign students'}
              </Button>
            ) : null}
            {showStartButton ? (
              <Button
                onClick={handleStart}
                disabled={starting || loading}
                title='Start the challenge for assigned students'
              >
                {starting ? 'Starting...' : 'Start'}
              </Button>
            ) : null}
            {showAssignReviewsButton ? (
              <Button
                onClick={handleAssignReviews}
                disabled={assigningReviews || loading}
                title='Assign peer reviews for this challenge'
              >
                {assigningReviews ? 'Assigning...' : 'Assign'}
              </Button>
            ) : null}
            {showStartPeerReviewButton ? (
              <Button
                onClick={handleStartPeerReview}
                disabled={startingPeerReview || loading}
                title='Start the peer review phase'
              >
                {startingPeerReview ? 'Starting...' : 'Start Peer Review'}
              </Button>
            ) : null}
            {showPeerReviewInProgress ? (
              <div className='flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700'>
                <span className='h-2 w-2 rounded-full bg-indigo-500' />
                Peer review is in progress. Time left:{' '}
                {formatTimer(phaseTwoTimeLeft)}
              </div>
            ) : null}
          </div>
        </div>
        <dl className='flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center'>
          {detailItems.map((item) => (
            <div
              key={item.label}
              className='w-full rounded-lg border border-border/60 bg-muted/60 px-3 py-2 sm:min-w-42.5 sm:w-auto'
            >
              <dt className='text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground'>
                {item.label}
              </dt>
              <dd className='text-sm font-semibold text-foreground'>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Card className={`border ${phaseOneCardClass}`}>
          <CardHeader className='pb-2'>
            <CardTitle className='text-lg font-semibold text-foreground'>
              Coding phase
            </CardTitle>
            <CardDescription className='text-sm text-muted-foreground'>
              Write and validate solutions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-2 text-sm text-foreground'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>
                  Start
                </span>
                <span>{formatDateTime(phaseOneStart)}</span>
              </div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>End</span>
                <span>{formatDateTime(phaseOneEndDisplay)}</span>
              </div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>
                  Duration
                </span>
                <span>
                  {challenge?.duration ? `${challenge.duration} min` : '—'}
                </span>
              </div>
              {isPhaseOneActive ? (
                <div className='space-y-1 mt-3'>
                  <div className='flex items-center gap-2'>
                    <span className='h-2 w-2 rounded-full bg-emerald-500' />
                    <span className='text-sm font-semibold text-emerald-700'>
                      Challenge in progress
                    </span>
                  </div>
                  <div className='flex items-center justify-between gap-2'>
                    <span className='text-sm text-muted-foreground'>
                      {phaseOneCountdownSeconds > 0
                        ? 'Starting soon'
                        : 'Ongoing'}
                    </span>
                    <span className='font-mono text-emerald-700'>
                      {phaseOneCountdownSeconds > 0
                        ? `Starting in ${phaseOneCountdownSeconds}s`
                        : `Time left ${formatTimer(phaseOneTimeLeft)}`}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${phaseTwoCardClass}`}>
          <CardHeader className='pb-2'>
            <CardTitle className='text-lg font-semibold text-foreground'>
              Peer review
            </CardTitle>
            <CardDescription className='text-sm text-muted-foreground'>
              Review classmates&apos; submissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-2 text-sm text-foreground'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>
                  Start
                </span>
                <span>{formatDateTime(phaseTwoStart)}</span>
              </div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>End</span>
                <span>{formatDateTime(phaseTwoEndDisplay)}</span>
              </div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>
                  Duration
                </span>
                <span>
                  {challenge?.durationPeerReview
                    ? `${challenge.durationPeerReview} min`
                    : '—'}
                </span>
              </div>
              {showPhaseTwoSubmissionCount ? (
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className='font-semibold text-muted-foreground'>
                    Submissions for peer review
                  </span>
                  <span>{challenge?.validSubmissionsCount ?? 0}</span>
                </div>
              ) : null}
              {showPhaseTwoSubmissionCount ? (
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className='font-semibold text-muted-foreground'>
                    Number of submissions
                  </span>
                  <span>{challenge?.totalSubmissionsCount ?? 0}</span>
                </div>
              ) : null}
              {isPhaseTwoActive ? (
                <div className='space-y-1 mt-3'>
                  <div className='flex items-center gap-2'>
                    <span className='h-2 w-2 rounded-full bg-indigo-500' />
                    <span className='text-sm font-semibold text-indigo-700'>
                      Challenge in progress
                    </span>
                  </div>
                  <div className='flex items-center justify-between gap-2'>
                    <span className='text-sm text-muted-foreground'>
                      {phaseTwoCountdownSeconds > 0
                        ? 'Starting soon'
                        : 'Ongoing'}
                    </span>
                    <span className='font-mono text-indigo-700'>
                      {phaseTwoCountdownSeconds > 0
                        ? `Starting in ${phaseTwoCountdownSeconds}s`
                        : `Time left ${formatTimer(phaseTwoTimeLeft)}`}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className='border border-destructive/30 bg-destructive/5 text-destructive'>
          <CardContent className='py-4'>
            <p className='text-sm'>{error}</p>
          </CardContent>
        </Card>
      )}

      {showStartPeerReviewButton ? (
        <Card className='border border-emerald-500/30 bg-emerald-500/10 text-emerald-700'>
          <CardContent className='py-4'>
            <p className='text-sm font-medium'>
              Peer review assignments are ready. You can start the peer review
              phase when you are ready.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {peerReviewMessages.length > 0 && (
        <div className='space-y-2'>
          {peerReviewMessages.map((message) => (
            <Card
              key={`${message.tone}-${message.text}`}
              className={`border ${peerReviewTones[message.tone] || peerReviewTones.error}`}
            >
              <CardContent className='py-3'>
                <p className='text-sm font-medium'>{message.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showDangerZone ? (
        <Card className='border border-destructive/40 bg-destructive/5'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-semibold text-destructive'>
              Danger zone
            </CardTitle>
            <CardDescription className='text-sm text-destructive/80'>
              These actions end phases early and cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-2'>
            {showEndCodingPhaseButton ? (
              <Button
                type='button'
                variant='destructive'
                onClick={() => setDangerAction('endCoding')}
                disabled={loading || dangerPending}
              >
                End coding phase
              </Button>
            ) : null}
            {showEndPeerReviewButton ? (
              <Button
                type='button'
                variant='destructive'
                onClick={() => setDangerAction('endPeerReview')}
                disabled={loading || dangerPending}
              >
                End peer review
              </Button>
            ) : null}
            {showEndChallengeButton ? (
              <Button
                type='button'
                variant='destructive'
                onClick={() => setDangerAction('endChallenge')}
                disabled={loading || dangerPending}
              >
                End challenge
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!assignments.length && !error ? (
        <Card className='border border-dashed border-border bg-card text-card-foreground shadow-sm'>
          <CardContent className='py-6'>
            <p className='text-muted-foreground text-sm'>
              No matches have been assigned yet for this challenge.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {showParticipantList ? (
        <Card className='border border-border bg-card text-card-foreground shadow-sm'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-semibold text-foreground'>
              Joined students
            </CardTitle>
            <CardDescription className='text-xs text-muted-foreground'>
              {joinedStudents.length} joined
            </CardDescription>
          </CardHeader>
          <CardContent>
            {joinedStudents.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                No students have joined yet.
              </p>
            ) : (
              <ul className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                {joinedStudents.map((student) => (
                  <li
                    key={student.id}
                    className='rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm font-medium text-foreground'
                  >
                    {student.name}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className='space-y-4'>
        {assignments.map((group) => (
          <Card
            key={group.challengeMatchSettingId}
            className='border border-border bg-card text-card-foreground shadow-sm'
          >
            <CardHeader className='pb-2'>
              <CardTitle className='text-lg font-semibold text-foreground'>
                {group.matchSetting?.problemTitle || 'Match setting'}
              </CardTitle>
              <CardDescription className='text-sm text-muted-foreground space-y-1'>
                <span className='block'>
                  Match setting ID:{' '}
                  {group.matchSetting?.id ?? group.challengeMatchSettingId}
                </span>
                <span className='block'>
                  Valid submissions: {group.validSubmissionsCount ?? 0}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='overflow-auto rounded-lg border border-border'>
                <table className='min-w-full table-auto text-sm'>
                  <thead className='bg-muted'>
                    <tr className='text-left text-muted-foreground'>
                      <th className='px-4 py-3 font-semibold'>Match ID</th>
                      <th className='px-4 py-3 font-semibold'>Student</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.matches.map((match) => (
                      <tr key={match.id} className='border-t border-border/60'>
                        <td className='px-4 py-3 font-medium text-foreground'>
                          {match.id}
                        </td>
                        <td className='px-4 py-3 text-foreground'>
                          {match.student?.username || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {group.peerReviewAssignments?.length ? (
                <details className='mt-4 rounded-lg border border-border/60 bg-muted/40 p-3'>
                  <summary className='cursor-pointer text-sm font-semibold text-foreground'>
                    Peer review assignments
                  </summary>
                  <div className='mt-3 space-y-3'>
                    {group.peerReviewAssignments.map((assignment) => {
                      const revieweeNames = assignment.reviewees
                        .map((reviewee) => reviewee.username)
                        .join(', ');
                      return (
                        <div
                          key={assignment.reviewer.participantId}
                          className='text-sm'
                        >
                          <p className='font-semibold text-foreground'>
                            {assignment.reviewer.username}
                          </p>
                          <p className='text-muted-foreground wrap-break-word'>
                            Reviews: {revieweeNames || '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      <AlertDialog
        open={editDialogOpen}
        title='Unpublish to edit'
        description='This challenge will be set to private so you can edit it. Continue?'
        confirmLabel='Unpublish & edit'
        cancelLabel='Cancel'
        confirmVariant='primary'
        cancelVariant='outline'
        confirmDisabled={editPending}
        cancelDisabled={editPending}
        onConfirm={handleConfirmUnpublish}
        onCancel={handleEditCancel}
      />
      <AlertDialog
        open={Boolean(activeDangerAction)}
        title={activeDangerAction?.title}
        description={activeDangerAction?.description}
        confirmLabel={
          dangerPending
            ? activeDangerAction?.pendingLabel
            : activeDangerAction?.confirmLabel
        }
        cancelLabel='Cancel'
        confirmVariant='destructive'
        cancelVariant='outline'
        confirmDisabled={dangerPending}
        cancelDisabled={dangerPending}
        onConfirm={handleConfirmDangerAction}
        onCancel={handleCancelDangerAction}
      />
    </div>
  );
}
