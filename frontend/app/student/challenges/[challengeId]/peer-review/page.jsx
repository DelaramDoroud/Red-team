'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { Button } from '#components/common/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import PeerReviewSummaryDialog from '#components/peerReview/PeerReviewSummaryDialog';
import useChallenge from '#js/useChallenge';
import useRoleGuard from '#js/useRoleGuard';
import { ChallengeStatus } from '#js/constants';
import { getApiErrorMessage } from '#js/apiError';
import useApiErrorRedirect from '#js/useApiErrorRedirect';
import { useAppSelector } from '#js/store/hooks';
import { validateIncorrectInput } from '#js/utils';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
});

const formatTimer = (seconds) => {
  if (seconds == null) return '--:--:--';
  const safeSeconds = Math.max(0, seconds);
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(safeSeconds % 60).padStart(2, '0');
  return `${hours}:${mins}:${secs}`;
};

const buildTimeLeft = (startValue, durationMinutes) => {
  if (!startValue || !durationMinutes) return null;
  const startMs = new Date(startValue).getTime();
  if (Number.isNaN(startMs)) return null;
  const endMs = startMs + durationMinutes * 60 * 1000;
  return Math.max(0, Math.floor((endMs - Date.now()) / 1000));
};

const formatCodeWithNewlines = (code) => {
  if (!code || typeof code !== 'string') return code;
  if (code.includes('\n')) return code;

  let formatted = code;
  formatted = formatted.replace(/(#include\s+<[^>]+>)/g, '$1\n');
  formatted = formatted.replace(/(\/\/[^\n]*)/g, '$1\n');
  formatted = formatted.replace(/(using\s+namespace\s+\w+;)/g, '$1\n\n');
  formatted = formatted.replace(/{/g, '{\n');
  formatted = formatted.replace(/}/g, '\n}\n');
  formatted = formatted.replace(/;(?!\s*{)/g, ';\n');
  formatted = formatted.replace(/\n\s*{/g, ' {');
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  const lines = formatted.split('\n');
  formatted = lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      return trimmed;
    })
    .filter((line) => line.length > 0 || line === '')
    .join('\n');

  const result = [];
  let indentLevel = 0;
  const indentSize = 4;

  formatted.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      result.push('');
      return;
    }
    if (trimmed.startsWith('}')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    result.push(' '.repeat(indentLevel * indentSize) + trimmed);
    if (trimmed.endsWith('{')) {
      indentLevel += 1;
    }
  });

  return result.join('\n');
};

export default function PeerReviewPage() {
  const params = useParams();
  const router = useRouter();
  const hasFinalizedRef = useRef(false);
  const { user, isAuthorized } = useRoleGuard({ allowedRoles: ['student'] });
  const studentId = user?.id;
  const challengeId = params?.challengeId;

  const {
    getStudentPeerReviewAssignments,
    getPeerReviewSummary,
    submitPeerReviewVote,
    getStudentVotes,
    finalizePeerReview,
  } = useChallenge();

  const redirectOnError = useApiErrorRedirect();

  const [assignments, setAssignments] = useState([]);
  const [challengeInfo, setChallengeInfo] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [voteMap, setVoteMap] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [finalSummary, setFinalSummary] = useState(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const theme = useAppSelector((state) => state.ui.theme);
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';

  useEffect(() => {
    if (!challengeId || !studentId || !isAuthorized) return undefined;
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [assignmentsRes, votesRes] = await Promise.all([
          getStudentPeerReviewAssignments(challengeId, studentId),
          getStudentVotes(challengeId),
        ]);

        if (cancelled) return;

        if (assignmentsRes?.success === false) {
          if (redirectOnError(assignmentsRes)) return;
          setError(
            getApiErrorMessage(assignmentsRes, 'Unable to load peer review.')
          );
          setAssignments([]);
          return;
        }

        const nextAssignments = Array.isArray(assignmentsRes?.assignments)
          ? assignmentsRes.assignments
          : [];
        setAssignments(nextAssignments);
        setChallengeInfo(assignmentsRes?.challenge || null);

        const initialVoteMap = {};

        if (votesRes?.success && Array.isArray(votesRes.votes)) {
          votesRes.votes.forEach((v) => {
            initialVoteMap[v.submissionId] = {
              type: v.vote,
              input: v.testCaseInput || '',
              output: v.expectedOutput || '',
            };
          });
          console.log(
            '✅ Votes hydrated from GET /votes endpoint:',
            initialVoteMap
          );
        } else {
          console.warn(
            '⚠️ Could not fetch votes independently or no votes found.'
          );
        }

        setVoteMap(initialVoteMap);

        if (nextAssignments.length > 0) {
          setSelectedIndex(0);
        }
      } catch (_err) {
        if (!cancelled) {
          console.error(_err);
          setError('Unable to load data.');
          setAssignments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [
    challengeId,
    studentId,
    isAuthorized,
    getStudentPeerReviewAssignments,
    getStudentVotes,
    redirectOnError,
  ]);

  useEffect(() => {
    if (
      !challengeInfo?.startPhaseTwoDateTime ||
      !challengeInfo?.durationPeerReview
    )
      return undefined;

    const tick = () => {
      setTimeLeft(
        buildTimeLeft(
          challengeInfo.startPhaseTwoDateTime,
          challengeInfo.durationPeerReview
        )
      );
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [challengeInfo?.startPhaseTwoDateTime, challengeInfo?.durationPeerReview]);

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(monacoTheme);
    }
  }, [monacoTheme]);

  useEffect(() => {
    if (timeLeft === 0 && challengeId && !hasFinalizedRef.current) {
      hasFinalizedRef.current = true;

      finalizePeerReview(challengeId)
        .then(async () => {
          const result = await fetchPeerReviewSummary();

          if (result.success) {
            setFinalSummary(result.summary);
            setShowSummaryDialog(true);
          } else {
            toast.error(result.error);
          }
        })
        .catch(() => {
          setError('Unable to finalize peer review.');
        });
    }
  }, [timeLeft, challengeId]);

  const isPeerReviewActive =
    challengeInfo?.status === ChallengeStatus.STARTED_PHASE_TWO ||
    challengeInfo?.status === ChallengeStatus.ENDED_PHASE_TWO;

  const selectedAssignment = assignments[selectedIndex] || null;
  const selectedSubmissionId = selectedAssignment?.submissionId;

  const currentVoteEntry = selectedSubmissionId
    ? voteMap[selectedSubmissionId]
    : null;
  const currentVote = currentVoteEntry?.type || '';

  const completedCount = useMemo(
    () =>
      assignments.filter((assignment) =>
        Boolean(voteMap[assignment.submissionId]?.type)
      ).length,
    [assignments, voteMap]
  );

  const progressValue = assignments.length
    ? Math.round((completedCount / assignments.length) * 100)
    : 0;

  const saveVoteToBackend = async (
    assignmentId,
    voteType,
    input = null,
    output = null
  ) => {
    const res = await submitPeerReviewVote(
      assignmentId,
      voteType,
      input,
      output
    );

    if (res?.success) {
      toast.success('Vote saved');
    } else {
      console.error('Save failed', res);
      const msg = res?.error?.message || 'Failed to save vote';
      toast.error(msg);
    }
  };

  const fetchPeerReviewSummary = async () => {
    if (!challengeId || !studentId) {
      return {
        success: false,
        error: 'Missing challenge or student',
      };
    }

    const res = await getPeerReviewSummary(challengeId, studentId);

    if (res?.success === false) {
      return {
        success: false,
        error: getApiErrorMessage(res, 'Unable to load summary'),
      };
    }

    return {
      success: true,
      summary: res?.summary || {
        total: 0,
        voted: 0,
        correct: 0,
        incorrect: 0,
        abstain: 0,
        unvoted: 0,
      },
    };
  };

  const handleCloseSummaryDialog = () => {
    setShowSummaryDialog(false);
    setFinalSummary(null);
  };

  const handleVoteChange = (newVoteType) => {
    if (!selectedAssignment) return;

    const { submissionId } = selectedAssignment;
    const assignmentId = selectedAssignment.id;

    setVoteMap((prev) => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        type: newVoteType,
      },
    }));

    if (newVoteType === 'correct' || newVoteType === 'abstain') {
      saveVoteToBackend(assignmentId, newVoteType, null, null);
      setValidationErrors((prev) => ({ ...prev, [submissionId]: null }));
    } else {
      setValidationErrors((prev) => ({
        ...prev,
        [submissionId]: {
          warning:
            "This vote won't count until you provide both input and expected output",
        },
      }));
    }
  };

  const handleIncorrectDetailsChange = (field, value) => {
    if (!selectedAssignment) return;
    const { submissionId } = selectedAssignment;
    const assignmentId = selectedAssignment.id;

    const currentEntry = voteMap[submissionId] || {};
    const updatedEntry = { ...currentEntry, [field]: value };

    setVoteMap((prev) => ({
      ...prev,
      [submissionId]: updatedEntry,
    }));

    const inputStr = field === 'input' ? value : currentEntry.input;
    const outputStr = field === 'output' ? value : currentEntry.output;
    const publicTests = selectedAssignment.matchSetting?.publicTests || [];

    const check = validateIncorrectInput(inputStr, outputStr, publicTests);

    if (check.valid) {
      setValidationErrors((prev) => ({ ...prev, [submissionId]: null }));
      saveVoteToBackend(assignmentId, 'incorrect', inputStr, outputStr);
    } else {
      setValidationErrors((prev) => ({
        ...prev,
        [submissionId]: check.error
          ? { error: check.error }
          : { warning: check.message },
      }));
    }
  };

  const handleExit = () => {
    router.push('/student/challenges');
  };

  const handlePrev = () => {
    setSelectedIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => Math.min(assignments.length - 1, prev + 1));
  };

  const isFirst = selectedIndex <= 0;
  const isLast =
    assignments.length === 0 || selectedIndex >= assignments.length - 1;

  const showSummaryToast = async () => {
    if (!challengeId || !studentId) return;
    toast.dismiss('peer-review-summary-loading');
    toast.dismiss('peer-review-summary');

    const loadingId = toast.loading('Loading summary...', {
      id: 'peer-review-summary-loading',
    });
    try {
      const res = await getPeerReviewSummary(challengeId, studentId);
      if (res?.success === false) {
        toast.error(getApiErrorMessage(res, 'Unable to load summary'));
        return;
      }
      const summary = res?.summary || {
        total: 0,
        voted: 0,
        correct: 0,
        incorrect: 0,
        abstain: 0,
        unvoted: 0,
      };
      toast.custom(
        (t) => (
          <div className='pointer-events-auto w-[360px] max-w-[92vw] rounded-2xl border-2 border-primary/20 bg-background shadow-xl shadow-primary/20 ring-1 ring-offset-2 ring-primary/50 p-1'>
            <div className='p-4'>
              <div className='flex items-start justify-between gap-3'>
                <div className='mb-2 pb-2'>
                  <p className='text-sm font-semibold text-primary'>Summary</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    Overview of your submitted votes
                  </p>
                </div>
                <div className='relative -top-3 -right-3'>
                  <Button
                    type='button'
                    onClick={() => toast.dismiss(t.id)}
                    variant='destructive'
                    size='sm'
                  >
                    ⤬
                  </Button>
                </div>
              </div>
              <div className='mt-3 rounded-xl border border-secondary bg-muted/40 p-3'>
                <p className='text-sm font-semibold text-foreground'>
                  Voted {summary.voted} of {summary.total}
                </p>
              </div>
              <div className='mt-3 space-y-2 text-sm'>
                <div className='flex items-center justify-between rounded-xl border border-border px-3 py-2'>
                  <span>Correct</span>
                  <span className='font-semibold'>{summary.correct}</span>
                </div>
                <div className='flex items-center justify-between rounded-xl border border-border px-3 py-2'>
                  <span>Incorrect</span>
                  <span className='font-semibold'>{summary.incorrect}</span>
                </div>
                <div className='flex items-center justify-between rounded-xl border border-border px-3 py-2'>
                  <span>Abstain</span>
                  <span className='font-semibold'>{summary.abstain}</span>
                </div>
                <div className='flex items-center justify-between rounded-xl border border-border px-3 py-2'>
                  <span>Unvoted</span>
                  <span className='font-semibold'>{summary.unvoted}</span>
                </div>
              </div>
            </div>
          </div>
        ),
        { id: 'peer-review-summary', duration: Infinity }
      );
    } catch (e) {
      toast.error('Unable to load summary');
    } finally {
      if (loadingId) toast.dismiss(loadingId);
    }
  };

  if (!isAuthorized || !studentId) return null;

  if (!loading && !isPeerReviewActive) {
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
              onClick={() => router.push('/student/challenges')}
            >
              Back to challenges
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
            Peer Review Phase
          </p>
          <h1 className='text-3xl font-bold text-foreground'>
            Review solutions and submit your assessment
          </h1>
        </div>
        <div className='inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary'>
          <span className='h-2 w-2 rounded-full bg-primary' />
          {formatTimer(timeLeft)}
        </div>
      </div>

      {error && (
        <Card className='mt-4 border border-destructive/30 bg-destructive/5 text-destructive'>
          <CardContent className='py-4'>
            <p className='text-sm'>{error}</p>
          </CardContent>
        </Card>
      )}

      <div className='mt-6 grid gap-6 lg:grid-cols-[280px_1fr]'>
        <aside className='space-y-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-semibold'>
                Overall Progress
              </CardTitle>
              <CardDescription className='text-xs text-muted-foreground'>
                {completedCount}/{assignments.length}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='h-2 w-full rounded-full bg-muted'>
                <div
                  className='h-2 rounded-full bg-primary transition-all'
                  style={{ width: `${progressValue}%` }}
                />
              </div>
              <p className='text-xs text-muted-foreground'>
                {progressValue}% completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-semibold'>
                Solutions to Review
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {loading && (
                <p className='text-xs text-muted-foreground'>Loading...</p>
              )}
              {!loading && assignments.length === 0 && (
                <p className='text-xs text-muted-foreground'>
                  No assignments available yet.
                </p>
              )}
              {assignments.map((assignment, index) => {
                const isSelected = index === selectedIndex;
                const voteEntry = voteMap[assignment.submissionId];
                const status = voteEntry?.type ? 'Reviewed' : 'Not voted yet';
                return (
                  <button
                    key={assignment.id}
                    type='button'
                    onClick={() => setSelectedIndex(index)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? 'border-primary/30 bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className='flex items-center gap-2 font-semibold'>
                      <span className='flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted text-xs'>
                        {index + 1}
                      </span>
                      Solution {index + 1}
                    </div>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {status}
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className='space-y-2'>
            <Button
              className='w-full'
              variant='primary'
              onClick={showSummaryToast}
            >
              Summary
            </Button>
            {timeLeft > 0 && (
              <Button className='w-full' variant='outline' onClick={handleExit}>
                Exit
              </Button>
            )}
          </div>
        </aside>

        <section className='space-y-4 min-w-0'>
          <Card>
            <CardHeader className='bg-primary text-primary-foreground rounded-t-xl'>
              <CardTitle className='text-lg font-semibold'>
                {selectedAssignment
                  ? `Solution ${selectedIndex + 1}`
                  : 'Solution'}
              </CardTitle>
              <CardDescription className='text-primary-foreground/80'>
                Review this solution and cast your vote
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4 min-w-0'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  Submitted Code
                </p>
                <div className='mt-2 min-h-[320px] w-full max-w-full overflow-hidden rounded-lg border border-border bg-muted'>
                  <MonacoEditor
                    height='320px'
                    width='100%'
                    language='cpp'
                    theme={monacoTheme}
                    value={
                      formatCodeWithNewlines(selectedAssignment?.code) ||
                      '// No code available.'
                    }
                    onMount={(editor, monaco) => {
                      editorRef.current = editor;
                      monacoRef.current = monaco;
                      monaco.editor.setTheme(monacoTheme);
                      setTimeout(() => {
                        try {
                          editor
                            .getAction('editor.action.formatDocument')
                            ?.run();
                        } catch (err) {
                          /* empty */
                        }
                      }, 100);
                    }}
                    loading={
                      <div className='flex h-full items-center justify-center bg-muted text-muted-foreground'>
                        Loading editor...
                      </div>
                    }
                    options={{
                      readOnly: true,
                      automaticLayout: true,
                      fontSize: 14,
                      wordWrap: 'off',
                      minimap: { enabled: false },
                      scrollbar: { alwaysConsumeMouseWheel: false },
                      padding: { top: 12, bottom: 12 },
                      lineNumbers: 'on',
                      renderLineHighlight: 'all',
                    }}
                  />
                </div>
              </div>

              <div className='rounded-xl border border-border bg-muted/40 p-4 space-y-3'>
                <div>
                  <p className='text-sm font-semibold text-foreground'>
                    Your Assessment
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    Your selection is saved locally. You can change it anytime.
                  </p>
                </div>

                {['correct', 'incorrect', 'abstain'].map((option) => {
                  let label = 'Abstain';
                  if (option === 'correct') label = 'Correct';
                  if (option === 'incorrect') label = 'Incorrect';
                  const isSelected = currentVote === option;
                  return (
                    <div key={option} className='space-y-2'>
                      <label
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition cursor-pointer ${
                          isSelected
                            ? 'border-primary/40 bg-primary/10 shadow-sm'
                            : 'border-border bg-card'
                        }`}
                      >
                        <span>{label}</span>
                        <input
                          type='radio'
                          name='assessment'
                          value={option}
                          checked={isSelected}
                          onChange={() => handleVoteChange(option)}
                          className='h-4 w-4 accent-primary cursor-pointer'
                        />
                      </label>
                      {/* */}
                      {option === 'incorrect' && isSelected && (
                        <div className='pl-4 pr-2 py-3 space-y-3 border-l-2 border-primary/20 ml-2 bg-muted/20 rounded-r-lg'>
                          {/* Warning */}
                          {validationErrors[selectedSubmissionId]?.warning && (
                            <p className='text-xs text-amber-500 font-medium flex gap-2'>
                              ⚠️{' '}
                              <span>
                                {validationErrors[selectedSubmissionId].warning}
                              </span>
                            </p>
                          )}
                          {validationErrors[selectedSubmissionId]?.error && (
                            <p className='text-xs text-destructive font-bold flex gap-2'>
                              ❌{' '}
                              <span>
                                {validationErrors[selectedSubmissionId].error}
                              </span>
                            </p>
                          )}

                          <div>
                            <label
                              htmlFor={`input-${selectedSubmissionId}`}
                              className='text-xs font-semibold text-muted-foreground'
                            >
                              Test Case Input (JSON Array)
                            </label>
                            <input
                              id={`input-${selectedSubmissionId}`}
                              type='text'
                              placeholder='e.g. [1, 2] or ["a", "b"]'
                              className='w-full mt-1 p-2 text-sm border rounded bg-background focus:ring-1 focus:ring-primary'
                              value={voteMap[selectedSubmissionId]?.input || ''}
                              onChange={(e) =>
                                handleIncorrectDetailsChange(
                                  'input',
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`output-${selectedSubmissionId}`}
                              className='text-xs font-semibold text-muted-foreground'
                            >
                              Expected Output (JSON Array)
                            </label>
                            <input
                              id={`output-${selectedSubmissionId}`}
                              type='text'
                              placeholder='e.g. [3] or [true]'
                              className='w-full mt-1 p-2 text-sm border rounded bg-background focus:ring-1 focus:ring-primary'
                              value={
                                voteMap[selectedSubmissionId]?.output || ''
                              }
                              onChange={(e) =>
                                handleIncorrectDetailsChange(
                                  'output',
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </div>
                      )}{' '}
                    </div>
                  );
                })}
              </div>

              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                <Button
                  type='button'
                  variant='primary'
                  onClick={handlePrev}
                  disabled={isFirst}
                >
                  Previous
                </Button>
                <span>
                  {assignments.length
                    ? `Solution ${selectedIndex + 1} of ${assignments.length}`
                    : 'No solutions assigned'}
                </span>
                <Button
                  type='button'
                  variant='primary'
                  onClick={handleNext}
                  disabled={isLast}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
      <PeerReviewSummaryDialog
        open={true}
        summary={finalSummary}
        onClose={handleCloseSummaryDialog}
      />
    </div>
  );
}
