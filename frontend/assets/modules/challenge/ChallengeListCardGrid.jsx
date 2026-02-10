import ChallengeCard from '#components/challenge/ChallengeCard';
import { Button } from '#components/common/Button';
import Timer from '#components/common/Timer';
import { ChallengeStatus } from '#js/constants';

const hasPendingFinalizations = (challenge) => {
  if (typeof challenge.pendingFinalCount === 'number') {
    return challenge.pendingFinalCount > 0;
  }
  if (
    typeof challenge.totalMatches === 'number' &&
    typeof challenge.finalSubmissionCount === 'number'
  ) {
    return challenge.totalMatches > challenge.finalSubmissionCount;
  }
  return false;
};

const buildPublishButtonMeta = ({
  eligibility,
  isPublishing,
  isChecking,
  publishValidationError,
}) => {
  let label = 'Publish';
  if (isPublishing) label = 'Publishing...';
  if (!isPublishing && isChecking) label = 'Checking...';

  let title = 'Publish this challenge';
  if (publishValidationError) {
    title = publishValidationError;
  } else if (!eligibility?.valid) {
    if (eligibility?.errors?.length) {
      title = `Complete required fields: ${eligibility.errors.join(' | ')}`;
    } else {
      title = 'Complete required fields before publishing.';
    }
  }

  return { label, title };
};

const renderTimeLeft = (challenge) => {
  if (challenge.status === ChallengeStatus.STARTED_CODING_PHASE) {
    return (
      <Timer
        duration={challenge.duration}
        challengeId={challenge.id}
        startTime={
          challenge.startCodingPhaseDateTime || challenge.startDatetime
        }
        label='Time left'
      />
    );
  }
  if (challenge.status === ChallengeStatus.STARTED_PEER_REVIEW) {
    return (
      <Timer
        duration={challenge.durationPeerReview}
        challengeId={`${challenge.id}-peer-review`}
        startTime={challenge.startPeerReviewDateTime}
        label='Time left'
      />
    );
  }
  return null;
};

export default function ChallengeListCardGrid({
  styles,
  items,
  isPrivateView,
  participantsMap,
  pending,
  reviewErrors,
  publishEligibility,
  publishValidationLoading,
  publishValidationError,
  onPublish,
  onAssignWithValidation,
  onStartWithValidation,
  onAssignReviews,
  onStartPeerReview,
  onAllowedNumberChange,
}) {
  const renderActions = (challenge, studentCount) => {
    if (isPrivateView) {
      const eligibility = publishEligibility[challenge.id];
      const isPublishing = pending[challenge.id]?.publish;
      const isValid = Boolean(eligibility?.valid);
      const isChecking = publishValidationLoading && !eligibility;
      const { label, title } = buildPublishButtonMeta({
        eligibility,
        isPublishing,
        isChecking,
        publishValidationError,
      });

      return (
        <Button
          size='sm'
          onClick={(event) => {
            event.preventDefault();
            onPublish(challenge);
          }}
          disabled={
            isPublishing ||
            !isValid ||
            Boolean(publishValidationError) ||
            isChecking
          }
          title={title}
        >
          {label}
        </Button>
      );
    }

    const hasStudents = studentCount > 0;
    const now = new Date();
    const canStartNow =
      challenge.startDatetime && new Date(challenge.startDatetime) <= now;

    if (challenge.status === ChallengeStatus.PUBLIC && canStartNow) {
      return (
        <Button
          onClick={(event) => {
            event.preventDefault();
            onAssignWithValidation(challenge.id, hasStudents);
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
          onClick={(event) => {
            event.preventDefault();
            onStartWithValidation(challenge.id, hasStudents);
          }}
          disabled={pending[challenge.id]?.start}
          title='Start this challenge'
        >
          {pending[challenge.id]?.start ? 'Starting...' : 'Start'}
        </Button>
      );
    }

    if (challenge.status === ChallengeStatus.STARTED_CODING_PHASE) {
      return null;
    }

    if (challenge.status === ChallengeStatus.ENDED_CODING_PHASE) {
      if (hasPendingFinalizations(challenge)) return null;
      if (challenge.peerReviewReady) {
        return (
          <Button
            size='sm'
            onClick={(event) => {
              event.preventDefault();
              onStartPeerReview(challenge.id);
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
            onAssignReviews(challenge.id, challenge.allowedNumberOfReview);
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

  return (
    <div className={styles.grid}>
      {items.map((challenge) => {
        const studentCount = participantsMap[challenge.id] || 0;
        return (
          <ChallengeCard
            key={challenge.id ?? challenge.title}
            challenge={{ ...challenge, participants: studentCount }}
            href={`/challenges/${challenge.id}`}
            actions={renderActions(challenge, studentCount)}
            extraInfo={renderTimeLeft(challenge)}
            onAllowedNumberChange={onAllowedNumberChange}
            allowedNumberError={reviewErrors[challenge.id]}
          />
        );
      })}
    </div>
  );
}
