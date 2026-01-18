'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '#components/common/card';
import useChallenge from '#js/useChallenge';

import { API_REST_BASE, ChallengeStatus } from '#js/constants';
import useRoleGuard from '#js/useRoleGuard';
import { getApiErrorMessage } from '#js/apiError';
import useApiErrorRedirect from '#js/useApiErrorRedirect';
import { DurationProvider } from './(context)/DurationContext';

// shared layout for both /match and /result
export default function ChallengeLayout({ children }) {
  const params = useParams();
  const challengeId = params?.challengeId;
  const {
    getChallengeForJoinedStudent,
    getStudentPeerReviewAssignments,
    getStudentVotes,
  } = useChallenge();
  const router = useRouter();
  const pathname = usePathname();
  const redirectOnError = useApiErrorRedirect();
  const [challengeData, setchallengeData] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const {
    user,
    isAuthorized,
    loading: authLoading,
  } = useRoleGuard({
    allowedRoles: ['student'],
  });
  const studentId = user?.id;

  useEffect(() => {
    if (!challengeId || !studentId || !isAuthorized) return () => {};

    let cancelled = false;

    async function loadStatus() {
      setLoading(true);
      setError(null);

      try {
        const res = await getChallengeForJoinedStudent(challengeId, studentId);
        if (!cancelled) {
          if (res?.success) {
            setchallengeData(res.data);
            const status = res.data?.status;
            const isPeerReviewRoute = pathname?.includes('/peer-review');
            const isResultRoute = pathname?.includes('/result');
            const shouldBeInPeerReview =
              status === ChallengeStatus.STARTED_PHASE_TWO ||
              status === ChallengeStatus.ENDED_PHASE_TWO;

            if (isResultRoute) return;

            if (isPeerReviewRoute && shouldBeInPeerReview) {
              try {
                const [assignmentsRes, votesRes] = await Promise.all([
                  getStudentPeerReviewAssignments(challengeId, studentId),
                  getStudentVotes(challengeId),
                ]);

                if (
                  assignmentsRes?.success &&
                  votesRes?.success &&
                  Array.isArray(assignmentsRes.assignments) &&
                  Array.isArray(votesRes.votes)
                ) {
                  const { assignments } = assignmentsRes;
                  const { votes } = votesRes;
                  const voteMap = new Map(
                    votes.map((v) => [v.submissionId, v])
                  );

                  const allAssignmentsHaveVotes = assignments.every(
                    (assignment) => voteMap.has(assignment.submissionId)
                  );

                  if (
                    allAssignmentsHaveVotes &&
                    assignments.length > 0 &&
                    status === ChallengeStatus.STARTED_PHASE_TWO
                  ) {
                    router.push(`/student/challenges/${challengeId}/result`);
                    return;
                  }
                }
              } catch (err) {
                // If check fails, allow normal flow
              }
            }

            if (shouldBeInPeerReview && !isPeerReviewRoute) {
              router.push(`/student/challenges/${challengeId}/peer-review`);
            } else if (!shouldBeInPeerReview && isPeerReviewRoute) {
              router.push(`/student/challenges/${challengeId}/match`);
            }
          } else {
            if (redirectOnError(res)) return;
            setError({
              message: getApiErrorMessage(
                res,
                'Unable to load challenge info.'
              ),
            });
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError({
            message:
              'Network error while loading challenge information. Please try again.',
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStatus();
    const source = new EventSource(`${API_REST_BASE}/events`, {
      withCredentials: true,
    });
    const handleUpdate = (event) => {
      if (!event?.data) {
        loadStatus();
        return;
      }
      try {
        const payload = JSON.parse(event.data);
        const payloadId = Number(payload?.challengeId);
        if (payloadId === Number(challengeId)) {
          loadStatus();
        }
      } catch {
        loadStatus();
      }
    };
    source.addEventListener('challenge-updated', handleUpdate);

    return () => {
      cancelled = true;
      source.close();
    };
  }, [
    challengeId,
    studentId,
    getChallengeForJoinedStudent,
    getStudentPeerReviewAssignments,
    getStudentVotes,
    isAuthorized,
    pathname,
    redirectOnError,
    router,
  ]);
  const {
    status,
    title,
    duration,
    durationPeerReview,
    startPhaseOneDateTime,
    startPhaseTwoDateTime,
    startDatetime,
  } = challengeData || {};
  const phaseLabel = () => {
    switch (status) {
      case ChallengeStatus.STARTED_PHASE_ONE:
        return 'Coding Phase';
      // here we can add also scoring phase and peer revirew phase(third sprint)
      case '':
        return '';

      default:
        return status || 'Unknown';
    }
  };
  return (
    <div className='max-w-7xl mx-auto px-3 py-2 space-y-2 sm:px-4'>
      <Card>
        <CardHeader>
          <CardTitle>
            {loading ? 'Loading challenge...' : title || 'Unknown'}-{' '}
            <span>{phaseLabel()}</span>
          </CardTitle>
        </CardHeader>

        {error && (
          <CardContent>
            <p className='text-sm text-red-600 dark:text-red-400'>
              {error.message}
            </p>
          </CardContent>
        )}
      </Card>
      {isAuthorized && !authLoading && (
        <DurationProvider
          value={{
            duration: Number(duration) || 0,
            durationPeerReview: Number(durationPeerReview) || 0,
            challengeId,
            startPhaseOneDateTime,
            startPhaseTwoDateTime,
            startDatetime,
            status,
          }}
        >
          {children}
        </DurationProvider>
      )}
    </div>
  );
}
