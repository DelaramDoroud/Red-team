'use client';

import AlertDialog from '#components/common/AlertDialog';
import { Card, CardContent } from '#components/common/card';
import { ChallengeStatus } from '#js/constants';
import { formatDateTime } from '#js/date';
import ChallengeAssignmentsSection from './(components)/ChallengeAssignmentsSection';
import ChallengeDangerZoneSection from './(components)/ChallengeDangerZoneSection';
import ChallengeMessageSection from './(components)/ChallengeMessageSection';
import ChallengeOverviewSection from './(components)/ChallengeOverviewSection';
import ChallengeParticipantsSection from './(components)/ChallengeParticipantsSection';
import ChallengePhaseCardsSection from './(components)/ChallengePhaseCardsSection';
import ChallengeTeacherResultsSection from './(components)/ChallengeTeacherResultsSection';
import {
  buildStudentName,
  formatTimer,
  getEarnedCreditFromVote,
  getExpectedEvaluationFromSubmissionStatus,
  normalizeMultilineValue,
} from './challengeDetailUtils';
import useChallengeDetailPage from './useChallengeDetailPage';

export default function ChallengeDetailPage() {
  const {
    isTeacher,
    challenge,
    assignments,
    joinedStudents,
    showParticipantList,
    error,
    loading,
    assigning,
    assigningReviews,
    starting,
    startingPeerReview,
    statusBadge,
    detailItems,
    showStartButton,
    showAssignReviewsButton,
    showStartPeerReviewButton,
    showPeerReviewInProgress,
    phaseStatus,
    codingPhaseCardClass,
    peerReviewCardClass,
    codingPhaseStart,
    codingPhaseEndDisplay,
    codingPhaseCountdownSeconds,
    codingPhaseTimeLeft,
    isCodingPhaseActive,
    peerReviewStart,
    peerReviewEndDisplay,
    peerReviewCountdownSeconds,
    peerReviewTimeLeft,
    isPeerReviewActive,
    showPeerReviewSubmissionCount,
    totalMatches,
    finalSubmissionCount,
    pendingFinalCount,
    hasPendingFinalizations,
    peerReviewMessages,
    showDangerZone,
    showEndCodingPhaseButton,
    showEndPeerReviewButton,
    showEndChallengeButton,
    setDangerAction,
    dangerPending,
    activeDangerAction,
    handleConfirmDangerAction,
    handleCancelDangerAction,
    editDialogOpen,
    editPending,
    editDisabled,
    editTitle,
    handleEditClick,
    handleConfirmUnpublish,
    handleEditCancel,
    load,
    handleAssign,
    handleStart,
    handleAssignReviews,
    handleStartPeerReview,
    canShowTeacherResults,
    teacherResultsOpen,
    teacherResultsLoading,
    teacherResultsError,
    teacherMatchSettings,
    privateTestActions,
    handleAddPrivateTest,
    handleToggleTeacherResults,
  } = useChallengeDetailPage();

  return (
    <div className='max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6'>
      <ChallengeOverviewSection
        assigning={assigning}
        assigningReviews={assigningReviews}
        challenge={challenge}
        detailItems={detailItems}
        editDisabled={editDisabled}
        editPending={editPending}
        editTitle={editTitle}
        formatTimer={formatTimer}
        handleAssign={handleAssign}
        handleAssignReviews={handleAssignReviews}
        handleEditClick={handleEditClick}
        handleStart={handleStart}
        handleStartPeerReview={handleStartPeerReview}
        isTeacher={isTeacher}
        load={load}
        loading={loading}
        peerReviewTimeLeft={peerReviewTimeLeft}
        showAssignReviewsButton={showAssignReviewsButton}
        showAssignStudentsButton={challenge?.status === ChallengeStatus.PUBLIC}
        showPeerReviewInProgress={showPeerReviewInProgress}
        showStartButton={showStartButton}
        showStartPeerReviewButton={showStartPeerReviewButton}
        starting={starting}
        startingPeerReview={startingPeerReview}
        statusBadge={statusBadge}
      />

      <ChallengePhaseCardsSection
        challenge={challenge}
        finalSubmissionCount={finalSubmissionCount}
        hasPendingFinalizations={hasPendingFinalizations}
        isCodingPhaseActive={isCodingPhaseActive}
        isPeerReviewActive={isPeerReviewActive}
        pendingFinalCount={pendingFinalCount}
        codingPhaseCardClass={codingPhaseCardClass}
        codingPhaseCountdownSeconds={codingPhaseCountdownSeconds}
        codingPhaseEndDisplay={codingPhaseEndDisplay}
        codingPhaseStart={codingPhaseStart}
        codingPhaseTimeLeft={codingPhaseTimeLeft}
        phaseStatus={phaseStatus}
        peerReviewCardClass={peerReviewCardClass}
        peerReviewCountdownSeconds={peerReviewCountdownSeconds}
        peerReviewEndDisplay={peerReviewEndDisplay}
        peerReviewStart={peerReviewStart}
        peerReviewTimeLeft={peerReviewTimeLeft}
        showPeerReviewSubmissionCount={showPeerReviewSubmissionCount}
        totalMatches={totalMatches}
        formatTimer={formatTimer}
      />

      <ChallengeMessageSection
        error={error}
        peerReviewMessages={peerReviewMessages}
        showStartPeerReviewButton={showStartPeerReviewButton}
      />

      <ChallengeDangerZoneSection
        dangerPending={dangerPending}
        loading={loading}
        setDangerAction={setDangerAction}
        showDangerZone={showDangerZone}
        showEndChallengeButton={showEndChallengeButton}
        showEndCodingPhaseButton={showEndCodingPhaseButton}
        showEndPeerReviewButton={showEndPeerReviewButton}
      />

      {!assignments.length && !error ? (
        <Card className='border border-dashed border-border bg-card text-card-foreground shadow-sm'>
          <CardContent className='py-6'>
            <p className='text-muted-foreground text-sm'>
              No matches have been assigned yet for this challenge.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <ChallengeParticipantsSection
        joinedStudents={joinedStudents}
        showParticipantList={showParticipantList}
      />

      <ChallengeAssignmentsSection assignments={assignments} />

      <ChallengeTeacherResultsSection
        buildStudentName={buildStudentName}
        canShowTeacherResults={canShowTeacherResults}
        formatDateTime={formatDateTime}
        getEarnedCreditFromVote={getEarnedCreditFromVote}
        getExpectedEvaluationFromSubmissionStatus={
          getExpectedEvaluationFromSubmissionStatus
        }
        handleAddPrivateTest={handleAddPrivateTest}
        handleToggleTeacherResults={handleToggleTeacherResults}
        normalizeMultilineValue={normalizeMultilineValue}
        privateTestActions={privateTestActions}
        teacherMatchSettings={teacherMatchSettings}
        teacherResultsError={teacherResultsError}
        teacherResultsLoading={teacherResultsLoading}
        teacherResultsOpen={teacherResultsOpen}
      />

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
