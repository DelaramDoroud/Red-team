'use client';

import BadgeModal from '#components/badge/BadgeModal';
import SubmissionScoreCard from '#components/challenge/SubmissionScoreCard';
import { Button } from '#components/common/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import SnakeGame from '#components/common/SnakeGame';
import Spinner from '#components/common/Spinner';
import SkillTitleModal from '#components/skillTitle/skillTitleModal';
import { useRouter } from '#js/router';
import styles from './peer-review-votes.module.css';
import ResultOtherSubmissionsSection from './ResultOtherSubmissionsSection';
import ResultPeerReviewSection from './ResultPeerReviewSection';
import ResultSolutionFeedbackSection from './ResultSolutionFeedbackSection';
import useChallengeResultPage from './useChallengeResultPage';

export default function ChallengeResultPage() {
  const router = useRouter();
  const {
    authLoading,
    isLoggedIn,
    studentId,
    durationContext,
    hasChallengeStatus,
    loading,
    error,
    resultData,
    isFinalizationPending,
    finalization,
    isWaitingForResults,
    challenge,
    matchSetting,
    scoreBreakdown,
    studentSubmission,
    publicResults,
    privateResults,
    isFullyEnded,
    peerReviewTests,
    otherSubmissions,
    hasPeerReviewTests,
    feedbackSectionId,
    peerReviewSectionId,
    isSolutionFeedbackOpen,
    isCodeReviewVotesOpen,
    handleToggleSolutionFeedback,
    handleTogglePeerReviewVotes,
    voteItems,
    reviewVotesLoading,
    reviewVotesError,
    showBadge,
    activeBadge,
    handleBadgeClose,
    newTitle,
    setNewTitle,
  } = useChallengeResultPage();

  if (authLoading) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-10'>
        <Card>
          <CardContent className='py-8 text-sm text-muted-foreground'>
            Loading your profile...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isLoggedIn || !studentId) return null;

  if (durationContext && !hasChallengeStatus && loading) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-10'>
        <Card>
          <CardContent className='py-8 text-sm text-muted-foreground'>
            Loading challenge status...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isFinalizationPending) {
    const totalMatches = finalization?.totalMatches;
    const finalizedCount = finalization?.finalSubmissionCount;
    const pendingCount = finalization?.pendingFinalCount;
    const progressText =
      typeof totalMatches === 'number' && typeof finalizedCount === 'number'
        ? `${finalizedCount} / ${totalMatches}`
        : null;
    const pendingText =
      typeof pendingCount === 'number' ? `${pendingCount}` : null;

    return (
      <div className='max-w-5xl mx-auto px-4 py-10 space-y-6'>
        <Card>
          <CardHeader>
            <div className='flex items-center gap-3'>
              <Spinner className='h-6 w-6 text-primary animate-spin' />
              <CardTitle>Scoring is not available yet</CardTitle>
            </div>
            <CardDescription>
              Please wait until scoring is computed.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-muted-foreground'>
            {progressText && (
              <p>
                Finalized submissions:{' '}
                <span className='font-semibold'>{progressText}</span>
              </p>
            )}
            {pendingText && (
              <p>
                Pending calculations:{' '}
                <span className='font-semibold'>{pendingText}</span>
              </p>
            )}
            {error && (
              <p className='text-amber-700'>
                Having trouble refreshing results. Retrying automatically...
              </p>
            )}
          </CardContent>
        </Card>
        <SnakeGame />
        {showBadge && (
          <BadgeModal badge={activeBadge} onClose={handleBadgeClose} />
        )}
      </div>
    );
  }

  if (isWaitingForResults) {
    return (
      <div className='max-w-5xl mx-auto px-4 py-10 space-y-6'>
        <Card className='border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/50'>
          <CardHeader>
            <CardTitle>Scoring is not available yet</CardTitle>
            <CardDescription className='text-amber-800 dark:text-amber-200'>
              Please wait until the peer review phase has ended.
            </CardDescription>
          </CardHeader>
          <CardContent className='text-sm text-muted-foreground'>
            You can play a quick round of Snake while you wait.
          </CardContent>
        </Card>
        <SnakeGame />
      </div>
    );
  }

  if (loading) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-10'>
        <Card>
          <CardContent className='py-8 text-sm text-muted-foreground'>
            Loading results...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-10 space-y-4'>
        <Card className='border border-destructive/30 bg-destructive/5 text-destructive'>
          <CardContent className='py-4'>
            <p className='text-sm'>{error}</p>
          </CardContent>
        </Card>
        <Button
          variant='outline'
          onClick={() => router.push('/student/challenges')}
        >
          Back to challenges
        </Button>
      </div>
    );
  }

  if (!resultData) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-10'>
        <Card>
          <CardContent className='py-8 text-sm text-muted-foreground'>
            No results available yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='max-w-6xl mx-auto px-4 py-8 space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>{challenge?.title || 'Challenge results'}</CardTitle>
          <CardDescription>
            {matchSetting?.problemTitle
              ? `Problem: ${matchSetting.problemTitle}`
              : 'Review the outcome of your challenge.'}
          </CardDescription>
        </CardHeader>
      </Card>

      {scoreBreakdown && <SubmissionScoreCard scoreData={scoreBreakdown} />}

      <div className='flex flex-col sm:flex-row gap-4'>
        <Button
          onClick={handleToggleSolutionFeedback}
          aria-expanded={isSolutionFeedbackOpen}
          aria-controls={feedbackSectionId}
          className='flex-1'
        >
          {isSolutionFeedbackOpen
            ? 'Hide Your Solution & Feedback'
            : 'View Your Solution & Feedback'}
        </Button>
        <Button
          variant='secondary'
          onClick={handleTogglePeerReviewVotes}
          aria-expanded={isCodeReviewVotesOpen}
          aria-controls={peerReviewSectionId}
          className='flex-1'
        >
          {isCodeReviewVotesOpen
            ? 'Hide Your Peer Review Votes'
            : 'View Your Peer Review Votes'}
        </Button>
      </div>

      {isSolutionFeedbackOpen && (
        <ResultSolutionFeedbackSection
          feedbackSectionId={feedbackSectionId}
          studentSubmission={studentSubmission}
          matchSetting={matchSetting}
          publicResults={publicResults}
          privateResults={privateResults}
        />
      )}

      {isFullyEnded && isCodeReviewVotesOpen && (
        <ResultPeerReviewSection
          peerReviewSectionId={peerReviewSectionId}
          styles={styles}
          reviewVotesLoading={reviewVotesLoading}
          reviewVotesError={reviewVotesError}
          voteItems={voteItems}
          hasPeerReviewTests={hasPeerReviewTests}
          peerReviewTests={peerReviewTests}
        />
      )}

      {isFullyEnded && (
        <ResultOtherSubmissionsSection otherSubmissions={otherSubmissions} />
      )}

      <Button
        variant='outline'
        onClick={() => router.push('/student/challenges')}
      >
        Back to challenges
      </Button>

      {showBadge && (
        <BadgeModal badge={activeBadge} onClose={handleBadgeClose} />
      )}
      {newTitle && (
        <SkillTitleModal title={newTitle} onClose={() => setNewTitle(null)} />
      )}
    </div>
  );
}
