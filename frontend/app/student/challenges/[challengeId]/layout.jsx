'use client';

import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import { getApiErrorMessage } from '#js/apiError';
import { ChallengeStatus, getChallengeStatusLabel } from '#js/constants';
import { useParams, usePathname, useRouter } from '#js/router';
import { useAppSelector } from '#js/store/hooks';
import useApiErrorRedirect from '#js/useApiErrorRedirect';
import useChallenge from '#js/useChallenge';
import useRoleGuard from '#js/useRoleGuard';
import useSseEvent from '#js/useSseEvent';
import { DurationProvider } from './(context)/DurationContext';

// shared layout for match, peer review, and results
export default function ChallengeLayout({ children = null }) {
  const params = useParams();
  const challengeId = params?.challengeId;
  const { getChallengeForJoinedStudent } = useChallenge();
  const router = useRouter();
  const pathname = usePathname();
  const redirectOnError = useApiErrorRedirect();
  const [challengeData, setchallengeData] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const authState = useAppSelector((state) => state.auth);
  const authUser = authState?.user;
  const authLoading = authState?.loading;
  const isLoggedIn = authState?.isLoggedIn;
  const peerReviewExitMap = useAppSelector((state) => state.ui.peerReviewExits);
  const { user: guardUser, isAuthorized } = useRoleGuard({
    allowedRoles: ['student'],
  });
  const effectiveUser = authUser || guardUser;
  const studentId = effectiveUser?.id;
  const isStudentUser = effectiveUser?.role === 'student';
  const peerReviewExitKey = challengeId ? String(challengeId) : null;
  const hasExitedPeerReview = Boolean(
    studentId &&
      peerReviewExitKey &&
      peerReviewExitMap?.[studentId]?.[peerReviewExitKey]
  );

  const loadStatus = useCallback(async () => {
    if (!challengeId || !studentId || !isStudentUser) return;
    setLoading(true);
    setError(null);

    try {
      const res = await getChallengeForJoinedStudent(challengeId, studentId);
      if (res?.success) {
        setchallengeData(res.data);
        const status = res.data?.status;
        const isPeerReviewRoute = pathname?.includes('/peer-review');
        const isResultRoute = pathname?.includes('/result');
        const isMatchRoute = pathname?.includes('/match');
        const isPeerReviewActive =
          status === ChallengeStatus.STARTED_PEER_REVIEW;
        const isEndedPeerReview = status === ChallengeStatus.ENDED_PEER_REVIEW;
        const isEndedCodingPhase =
          status === ChallengeStatus.ENDED_CODING_PHASE;
        let expectedSegment = 'match';
        if (isEndedPeerReview) {
          expectedSegment = 'result';
        } else if (isEndedCodingPhase) {
          expectedSegment = 'peer-review';
        } else if (isPeerReviewActive) {
          expectedSegment = hasExitedPeerReview ? 'result' : 'peer-review';
        }
        if (
          expectedSegment === 'result' &&
          !isEndedPeerReview &&
          !hasExitedPeerReview
        ) {
          expectedSegment = 'peer-review';
        }

        let shouldRedirect = false;
        if (expectedSegment === 'result' && !isResultRoute) {
          shouldRedirect = true;
        } else if (expectedSegment === 'peer-review' && !isPeerReviewRoute) {
          shouldRedirect = true;
        } else if (expectedSegment === 'match' && !isMatchRoute) {
          shouldRedirect = true;
        }

        if (shouldRedirect) {
          router.push(`/student/challenges/${challengeId}/${expectedSegment}`);
        }
      } else {
        if (redirectOnError(res)) return;
        setError({
          message: getApiErrorMessage(res, 'Unable to load challenge info.'),
        });
      }
    } catch (_error) {
      setError({
        message:
          'Network error while loading challenge information. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [
    challengeId,
    studentId,
    getChallengeForJoinedStudent,
    isStudentUser,
    hasExitedPeerReview,
    pathname,
    redirectOnError,
    router,
  ]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleChallengeUpdated = useCallback(
    (payload) => {
      const payloadId = Number(payload?.challengeId);
      if (!payloadId || payloadId === Number(challengeId)) {
        loadStatus();
      }
    },
    [challengeId, loadStatus]
  );

  useSseEvent('challenge-updated', handleChallengeUpdated);
  const {
    status,
    title,
    duration,
    durationPeerReview,
    startCodingPhaseDateTime,
    startPeerReviewDateTime,
    startDatetime,
  } = challengeData || {};
  const phaseLabel = () => {
    switch (status) {
      case ChallengeStatus.STARTED_CODING_PHASE:
        return 'Coding Phase';
      // here we can add also scoring phase and peer revirew phase(third sprint)
      case '':
        return '';

      default:
        return getChallengeStatusLabel(status);
    }
  };
  const titleText = loading ? 'Loading challenge...' : title || 'Unknown';
  const phaseText = loading ? '' : phaseLabel();
  const showAuthLoading = authLoading && !effectiveUser;
  const canRenderChildren = isStudentUser && (isAuthorized || isLoggedIn);
  const content = children || <Outlet />;

  return (
    <div className='max-w-7xl mx-auto px-3 py-2 space-y-2 sm:px-4'>
      <Card>
        <CardHeader>
          <CardTitle>
            {titleText}
            {phaseText ? ` - ${phaseText}` : ''}
          </CardTitle>
        </CardHeader>

        {error && (
          <CardContent>
            <p className='text-sm text-red-600 dark:text-red-400'>
              {error.message}
            </p>
          </CardContent>
        )}
        {showAuthLoading && (
          <CardContent>
            <p className='text-sm text-muted-foreground'>
              Loading your profile...
            </p>
          </CardContent>
        )}
      </Card>
      {canRenderChildren && (
        <DurationProvider
          value={{
            duration: Number(duration) || 0,
            durationPeerReview: Number(durationPeerReview) || 0,
            challengeId,
            startCodingPhaseDateTime,
            startPeerReviewDateTime,
            startDatetime,
            status,
          }}
        >
          {content}
        </DurationProvider>
      )}
    </div>
  );
}
