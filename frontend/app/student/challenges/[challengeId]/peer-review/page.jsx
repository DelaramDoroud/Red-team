'use client';

import { Button } from '#components/common/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import dynamic from '#js/dynamic';
import FinalizationWaitCard from './FinalizationWaitCard';
import PeerReviewContent from './PeerReviewContent';
import { formatCodeWithNewlines } from './peerReviewHelpers';
import usePeerReviewBaseState from './usePeerReviewBaseState';
import usePeerReviewVotingActions from './usePeerReviewVotingActions';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
});

export default function PeerReviewPage() {
  const base = usePeerReviewBaseState();
  const {
    handleCloseSummaryDialog,
    handleVoteChange,
    handleIncorrectDetailsChange,
    handleContinue,
    handleExit,
    handlePrev,
    handleNext,
    showSummaryToast,
  } = usePeerReviewVotingActions({
    challengeId: base.challengeId,
    studentId: base.studentId,
    assignments: base.assignments,
    setSelectedIndex: base.setSelectedIndex,
    selectedAssignment: base.selectedAssignment,
    voteMap: base.voteMap,
    setVoteMap: base.setVoteMap,
    setValidationErrors: base.setValidationErrors,
    hasExited: base.hasExited,
    setHasExited: base.setHasExited,
    isExiting: base.isExiting,
    setIsExiting: base.setIsExiting,
    setExitDialogOpen: base.setExitDialogOpen,
    setShowSummaryDialog: base.setShowSummaryDialog,
    setFinalSummary: base.setFinalSummary,
    showSummaryDialog: base.showSummaryDialog,
    voteAutosaveTimeoutRef: base.voteAutosaveTimeoutRef,
    redirectTimeoutRef: base.redirectTimeoutRef,
    submitPeerReviewVote: base.submitPeerReviewVote,
    exitPeerReview: base.exitPeerReview,
    getPeerReviewSummary: base.getPeerReviewSummary,
    dispatch: base.dispatch,
    router: base.router,
  });

  if (base.authLoading && !base.studentId) {
    return (
      <div className='max-w-3xl mx-auto px-4 py-8'>
        <Card>
          <CardContent className='py-8 text-sm text-muted-foreground'>
            Loading your profile...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (
    (!base.isLoggedIn && !base.isAuthorized) ||
    !base.studentId ||
    !base.isStudentUser
  ) {
    return null;
  }

  if (base.isCodingPhaseComplete && !base.isPeerReviewActive) {
    const showFinalizationPending =
      base.isFinalizationPending || base.finalization === null;
    const progressText =
      typeof base.finalization?.totalMatches === 'number' &&
      typeof base.finalization?.finalSubmissionCount === 'number'
        ? `${base.finalization.finalSubmissionCount} / ${base.finalization.totalMatches}`
        : null;
    const pendingText =
      typeof base.finalization?.pendingFinalCount === 'number'
        ? `${base.finalization.pendingFinalCount}`
        : null;

    if (showFinalizationPending) {
      return (
        <FinalizationWaitCard
          progressText={progressText}
          pendingText={pendingText}
          errorText={base.finalizationError}
        />
      );
    }

    return (
      <div className='max-w-5xl mx-auto px-4 py-8 space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Coding phase complete</CardTitle>
            <CardDescription>
              Wait for your teacher to start the peer review phase.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-muted-foreground'>
            <p>{base.codingPhaseMessage}</p>
            <p>{base.messagePeerReviewWait}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!base.loading && !base.isPeerReviewActive) {
    return (
      <div className='max-w-3xl mx-auto px-4 py-8 space-y-4'>
        <Card>
          <CardHeader>
            <CardTitle>Peer Review</CardTitle>
            <CardDescription>
              Wait for your teacher to start the peer review phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant='outline'
              onClick={() => base.router.push('/student/challenges')}
            >
              Back to challenges
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PeerReviewContent
      assignments={base.assignments}
      challengeId={base.challengeId}
      challengeInfo={base.challengeInfo}
      completedCount={base.completedCount}
      currentVote={base.currentVote}
      error={base.error}
      exitDialogOpen={base.exitDialogOpen}
      finalSummary={base.finalSummary}
      formatCodeWithNewlines={formatCodeWithNewlines}
      handleCloseSummaryDialog={handleCloseSummaryDialog}
      handleContinue={handleContinue}
      handleExit={handleExit}
      handleIncorrectDetailsChange={handleIncorrectDetailsChange}
      handleNext={handleNext}
      handlePrev={handlePrev}
      handleVoteChange={handleVoteChange}
      hasExplicitVote={base.hasExplicitVote}
      hasExited={base.hasExited}
      isExiting={base.isExiting}
      isFirst={base.isFirst}
      isLast={base.isLast}
      isVotingDisabled={base.isVotingDisabled}
      loading={base.loading}
      MonacoEditor={MonacoEditor}
      monacoTheme={base.monacoTheme}
      onEditorMount={base.handleEditorMount}
      progressValue={base.progressValue}
      selectedAssignment={base.selectedAssignment}
      selectedIndex={base.selectedIndex}
      selectedSubmissionId={base.selectedSubmissionId}
      setExitDialogOpen={base.setExitDialogOpen}
      setSelectedIndex={base.setSelectedIndex}
      showSummaryDialog={base.showSummaryDialog}
      showSummaryToast={showSummaryToast}
      timeLeft={base.timeLeft}
      validationErrors={base.validationErrors}
      voteMap={base.voteMap}
    />
  );
}
