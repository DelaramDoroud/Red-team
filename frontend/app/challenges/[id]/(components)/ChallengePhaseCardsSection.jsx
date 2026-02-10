import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import { ChallengeStatus } from '#js/constants';
import { formatDateTime } from '#js/date';

export default function ChallengePhaseCardsSection({
  challenge,
  finalSubmissionCount,
  hasPendingFinalizations,
  isCodingPhaseActive,
  isPeerReviewActive,
  pendingFinalCount,
  codingPhaseCardClass,
  codingPhaseCountdownSeconds,
  codingPhaseEndDisplay,
  codingPhaseStart,
  codingPhaseTimeLeft,
  phaseStatus,
  peerReviewCardClass,
  peerReviewCountdownSeconds,
  peerReviewEndDisplay,
  peerReviewStart,
  peerReviewTimeLeft,
  showPeerReviewSubmissionCount,
  totalMatches,
  formatTimer,
}) {
  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      <Card className={`border ${codingPhaseCardClass}`}>
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
              <span className='font-semibold text-muted-foreground'>Start</span>
              <span>{formatDateTime(codingPhaseStart)}</span>
            </div>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span className='font-semibold text-muted-foreground'>End</span>
              <span>{formatDateTime(codingPhaseEndDisplay)}</span>
            </div>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span className='font-semibold text-muted-foreground'>
                Duration
              </span>
              <span>
                {challenge?.duration ? `${challenge.duration} min` : '—'}
              </span>
            </div>
            {isCodingPhaseActive ? (
              <div className='space-y-1 mt-3'>
                <div className='flex items-center gap-2'>
                  <span className='h-2 w-2 rounded-full bg-emerald-500' />
                  <span className='text-sm font-semibold text-emerald-700'>
                    Challenge in progress
                  </span>
                </div>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-sm text-muted-foreground'>
                    {codingPhaseCountdownSeconds > 0
                      ? 'Starting soon'
                      : 'Ongoing'}
                  </span>
                  <span className='font-mono text-emerald-700'>
                    {codingPhaseCountdownSeconds > 0
                      ? `Starting in ${codingPhaseCountdownSeconds}s`
                      : `Time left ${formatTimer(codingPhaseTimeLeft)}`}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className={`border ${peerReviewCardClass}`}>
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
              <span className='font-semibold text-muted-foreground'>Start</span>
              <span>{formatDateTime(peerReviewStart)}</span>
            </div>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span className='font-semibold text-muted-foreground'>End</span>
              <span>{formatDateTime(peerReviewEndDisplay)}</span>
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
            {showPeerReviewSubmissionCount ? (
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>
                  Submissions for peer review
                </span>
                <span>{challenge?.validSubmissionsCount ?? 0}</span>
              </div>
            ) : null}
            {showPeerReviewSubmissionCount ? (
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>
                  Number of submissions
                </span>
                <span>{challenge?.totalSubmissionsCount ?? 0}</span>
              </div>
            ) : null}
            {typeof finalSubmissionCount === 'number' &&
            typeof totalMatches === 'number' ? (
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>
                  Finalized submissions
                </span>
                <span>
                  {finalSubmissionCount} / {totalMatches}
                </span>
              </div>
            ) : null}
            {typeof pendingFinalCount === 'number' && pendingFinalCount > 0 ? (
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>
                  Pending finalizations
                </span>
                <span>{pendingFinalCount}</span>
              </div>
            ) : null}
            {hasPendingFinalizations &&
            phaseStatus === ChallengeStatus.ENDED_CODING_PHASE ? (
              <p className='text-sm text-amber-700'>
                Finalizing submissions. You can assign peer reviews once all
                submissions are ready.
              </p>
            ) : null}
            {isPeerReviewActive ? (
              <div className='space-y-1 mt-3'>
                <div className='flex items-center gap-2'>
                  <span className='h-2 w-2 rounded-full bg-indigo-500' />
                  <span className='text-sm font-semibold text-indigo-700'>
                    Challenge in progress
                  </span>
                </div>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-sm text-muted-foreground'>
                    {peerReviewCountdownSeconds > 0
                      ? 'Starting soon'
                      : 'Ongoing'}
                  </span>
                  <span className='font-mono text-indigo-700'>
                    {peerReviewCountdownSeconds > 0
                      ? `Starting in ${peerReviewCountdownSeconds}s`
                      : `Time left ${formatTimer(peerReviewTimeLeft)}`}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
