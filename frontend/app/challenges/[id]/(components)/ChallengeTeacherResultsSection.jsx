import PeerReviewVoteResultCard from '#components/challenge/PeerReviewVoteResultCard';
import { Button } from '#components/common/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import TestResultsSection from './TestResultsSection';

const buildVoteActionState = ({ voteItem, privateTestActions }) => {
  const actionKey = `assignment-${voteItem.assignmentId}`;
  const hasTestCase =
    Boolean(voteItem.testCaseInput) && Boolean(voteItem.expectedOutput);
  const showAddButton =
    voteItem.vote === 'incorrect' && hasTestCase && voteItem.matchSettingId;
  const expectedOutputStatus = voteItem.isExpectedOutputCorrect;

  let addButtonMessage = '';
  if (showAddButton && expectedOutputStatus === false) {
    addButtonMessage = 'Expected output does not match the reference solution.';
  } else if (showAddButton && expectedOutputStatus == null) {
    addButtonMessage = 'Expected output has not been validated yet.';
  }

  return {
    actionKey,
    actionState: privateTestActions[actionKey],
    addButtonMessage,
    canAddTest: showAddButton && expectedOutputStatus === true,
    showAddButton,
  };
};

const buildReviewerVotesByStudentId = ({
  group,
  buildStudentName,
  getEarnedCreditFromVote,
  getExpectedEvaluationFromSubmissionStatus,
}) => {
  const reviewerVotesByStudentId = new Map();
  const reviewedMatches = Array.isArray(group.matches) ? group.matches : [];

  reviewedMatches.forEach((reviewedMatch) => {
    const reviewedStudentName = buildStudentName(
      reviewedMatch.student,
      reviewedMatch.student?.id ?? reviewedMatch.id
    );
    const expectedEvaluation = getExpectedEvaluationFromSubmissionStatus(
      reviewedMatch.submission?.status
    );
    const assignmentsList = Array.isArray(reviewedMatch.peerReviewAssignments)
      ? reviewedMatch.peerReviewAssignments
      : [];

    assignmentsList.forEach((assignment) => {
      const reviewerId = assignment.reviewer?.id;
      if (!reviewerId) return;

      if (!reviewerVotesByStudentId.has(reviewerId)) {
        reviewerVotesByStudentId.set(reviewerId, []);
      }

      const voteRecord = assignment.vote || null;
      reviewerVotesByStudentId.get(reviewerId).push({
        id: assignment.id,
        assignmentId: assignment.id,
        title: `Vote for ${reviewedStudentName}`,
        vote: voteRecord?.vote || 'abstain',
        expectedEvaluation,
        isCorrect: getEarnedCreditFromVote(
          voteRecord,
          reviewedMatch.submission?.status
        ),
        testCaseInput: voteRecord?.testCaseInput || null,
        expectedOutput: voteRecord?.expectedOutput || null,
        referenceOutput: voteRecord?.referenceOutput || null,
        actualOutput: voteRecord?.actualOutput || null,
        isExpectedOutputCorrect: voteRecord?.isExpectedOutputCorrect,
        isVoteCorrect: voteRecord?.isVoteCorrect,
        evaluationStatus: voteRecord?.evaluationStatus,
        matchSettingId: group.matchSetting?.id,
      });
    });
  });

  reviewerVotesByStudentId.forEach((votes) => {
    votes.sort((leftVote, rightVote) => {
      if (leftVote.id === rightVote.id) return 0;
      return leftVote.id > rightVote.id ? 1 : -1;
    });
  });

  return reviewerVotesByStudentId;
};

export default function ChallengeTeacherResultsSection({
  buildStudentName,
  canShowTeacherResults,
  formatDateTime,
  getEarnedCreditFromVote,
  getExpectedEvaluationFromSubmissionStatus,
  handleAddPrivateTest,
  handleToggleTeacherResults,
  normalizeMultilineValue,
  privateTestActions,
  teacherMatchSettings,
  teacherResultsError,
  teacherResultsLoading,
  teacherResultsOpen,
}) {
  if (!canShowTeacherResults) return null;

  return (
    <Card className='border border-border bg-card text-card-foreground shadow-sm'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-lg font-semibold text-foreground'>
          Student results
        </CardTitle>
        <CardDescription className='text-sm text-muted-foreground'>
          Review submissions and peer review outcomes by match setting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type='button'
          variant='outline'
          onClick={handleToggleTeacherResults}
          aria-expanded={teacherResultsOpen}
        >
          {teacherResultsOpen ? 'Hide student results' : 'View student results'}
        </Button>

        {teacherResultsOpen ? (
          <div className='mt-4 space-y-4'>
            {teacherResultsLoading ? (
              <p className='text-sm text-muted-foreground'>
                Loading student results...
              </p>
            ) : null}
            {teacherResultsError ? (
              <p className='text-sm text-destructive'>{teacherResultsError}</p>
            ) : null}
            {!teacherResultsLoading &&
            !teacherResultsError &&
            teacherMatchSettings.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                No student results available yet.
              </p>
            ) : null}
            {!teacherResultsLoading &&
            !teacherResultsError &&
            teacherMatchSettings.length > 0 ? (
              <div className='space-y-3'>
                {teacherMatchSettings.map((group) => {
                  const reviewerVotesByStudentId =
                    buildReviewerVotesByStudentId({
                      group,
                      buildStudentName,
                      getEarnedCreditFromVote,
                      getExpectedEvaluationFromSubmissionStatus,
                    });

                  return (
                    <details
                      key={group.challengeMatchSettingId}
                      className='rounded-xl border border-border/60 bg-muted/30 p-3'
                    >
                      <summary className='cursor-pointer text-sm font-semibold text-foreground'>
                        {group.matchSetting?.problemTitle ||
                          'Match setting results'}
                      </summary>
                      <div className='mt-3 space-y-3'>
                        {group.matches?.map((match) => {
                          const studentName = buildStudentName(
                            match.student,
                            match.student?.id ?? match.id
                          );
                          const { submission } = match;
                          const studentVotes =
                            reviewerVotesByStudentId.get(match.student?.id) ||
                            [];

                          return (
                            <details
                              key={match.id}
                              className='rounded-lg border border-border/60 bg-background/80 p-3'
                            >
                              <summary className='cursor-pointer text-sm font-semibold text-foreground'>
                                {studentName}
                              </summary>
                              <div className='mt-3 space-y-3'>
                                <details className='rounded-lg border border-border/60 bg-muted/40 p-3'>
                                  <summary className='cursor-pointer text-sm font-semibold text-foreground'>
                                    Coding phase
                                  </summary>
                                  <div className='mt-3 space-y-3'>
                                    {!submission ? (
                                      <p className='text-sm text-muted-foreground'>
                                        No submission was recorded for this
                                        student.
                                      </p>
                                    ) : (
                                      <>
                                        <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground'>
                                          <span>
                                            Status: {submission.status || '—'}
                                          </span>
                                          <span>
                                            Submitted:{' '}
                                            {submission.updatedAt
                                              ? formatDateTime(
                                                  submission.updatedAt
                                                )
                                              : '—'}
                                          </span>
                                        </div>
                                        <pre className='w-full overflow-auto rounded-lg border border-slate-900/80 bg-slate-900 p-3 text-xs text-slate-100 shadow-inner whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-950'>
                                          {normalizeMultilineValue(
                                            submission.code || ''
                                          )}
                                        </pre>
                                        <div className='grid gap-3 lg:grid-cols-2'>
                                          <TestResultsSection
                                            title='Public tests'
                                            results={
                                              submission.publicTestResults
                                            }
                                            emptyMessage='No public test results.'
                                          />
                                          <TestResultsSection
                                            title='Private tests'
                                            results={
                                              submission.privateTestResults
                                            }
                                            emptyMessage='No private test results.'
                                          />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </details>

                                <details className='rounded-lg border border-border/60 bg-muted/40 p-3'>
                                  <summary className='cursor-pointer text-sm font-semibold text-foreground'>
                                    Peer review
                                  </summary>
                                  <div className='mt-3 space-y-3'>
                                    {studentVotes.length === 0 ? (
                                      <p className='text-sm text-muted-foreground'>
                                        No peer review votes were recorded for
                                        this student.
                                      </p>
                                    ) : (
                                      studentVotes.map((voteItem) => {
                                        const {
                                          actionState,
                                          addButtonMessage,
                                          canAddTest,
                                          showAddButton,
                                        } = buildVoteActionState({
                                          voteItem,
                                          privateTestActions,
                                        });

                                        const voteActions = showAddButton ? (
                                          <div className='space-y-1'>
                                            <Button
                                              type='button'
                                              variant='outline'
                                              size='sm'
                                              onClick={() =>
                                                handleAddPrivateTest({
                                                  matchSettingId:
                                                    voteItem.matchSettingId,
                                                  assignmentId:
                                                    voteItem.assignmentId,
                                                  testCaseInput:
                                                    voteItem.testCaseInput,
                                                  expectedOutput:
                                                    voteItem.expectedOutput,
                                                })
                                              }
                                              disabled={
                                                actionState?.status ===
                                                  'saving' ||
                                                actionState?.status ===
                                                  'saved' ||
                                                !canAddTest
                                              }
                                            >
                                              {actionState?.status === 'saving'
                                                ? 'Adding...'
                                                : 'Add to private tests'}
                                            </Button>
                                            {addButtonMessage ? (
                                              <p className='text-[0.7rem] text-muted-foreground'>
                                                {addButtonMessage}
                                              </p>
                                            ) : null}
                                            {actionState?.message ? (
                                              <p
                                                className={`text-[0.7rem] ${
                                                  actionState.status === 'error'
                                                    ? 'text-rose-700 dark:text-rose-200'
                                                    : 'text-emerald-700 dark:text-emerald-200'
                                                }`}
                                              >
                                                {actionState.message}
                                              </p>
                                            ) : null}
                                          </div>
                                        ) : null;

                                        return (
                                          <PeerReviewVoteResultCard
                                            key={voteItem.id}
                                            title={voteItem.title}
                                            vote={voteItem.vote}
                                            expectedEvaluation={
                                              voteItem.expectedEvaluation
                                            }
                                            isCorrect={voteItem.isCorrect}
                                            testCaseInput={
                                              voteItem.testCaseInput
                                            }
                                            expectedOutput={
                                              voteItem.expectedOutput
                                            }
                                            referenceOutput={
                                              voteItem.referenceOutput
                                            }
                                            actualOutput={voteItem.actualOutput}
                                            isExpectedOutputCorrect={
                                              voteItem.isExpectedOutputCorrect
                                            }
                                            isVoteCorrect={
                                              voteItem.isVoteCorrect
                                            }
                                            evaluationStatus={
                                              voteItem.evaluationStatus
                                            }
                                            voteLabelText='Student vote'
                                            actions={voteActions}
                                          />
                                        );
                                      })
                                    )}
                                  </div>
                                </details>
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
