import { Button } from '#components/common/Button';
import Link from '#components/common/RouterLink';

export default function ChallengeOverviewSection({
  assigning,
  assigningReviews,
  challenge,
  detailItems,
  editDisabled,
  editPending,
  editTitle,
  formatTimer,
  handleAssign,
  handleAssignReviews,
  handleEditClick,
  handleStart,
  handleStartPeerReview,
  isTeacher,
  load,
  loading,
  peerReviewTimeLeft,
  showAssignReviewsButton,
  showAssignStudentsButton,
  showPeerReviewInProgress,
  showStartButton,
  showStartPeerReviewButton,
  starting,
  startingPeerReview,
  statusBadge,
}) {
  return (
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
          {showAssignStudentsButton ? (
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
              {formatTimer(peerReviewTimeLeft)}
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
  );
}
