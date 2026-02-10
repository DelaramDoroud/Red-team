'use client';

import { CheckCircle2 } from 'lucide-react';
import { useRef, useState } from 'react';
import Spinner from '#components/common/Spinner';
import Timer from '#components/common/Timer';
import { useDuration } from '../(context)/DurationContext';
import CppEditor from './CppEditor';
import MatchViewEditorCard from './MatchViewEditorCard';
import MatchViewSidebar from './MatchViewSidebar';
import {
  MatchCompletedState,
  MatchFinishedState,
  MatchLoadingState,
  MatchLobbyState,
  MatchMissingState,
  MatchUnavailableState,
} from './MatchViewStateCards';

const normalizeMultilineValue = (value) =>
  typeof value === 'string' ? value.replace(/\\n/g, '\n') : value;

const formatDisplayValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return normalizeMultilineValue(value);
  try {
    return normalizeMultilineValue(JSON.stringify(value));
  } catch {
    return normalizeMultilineValue(String(value));
  }
};

const renderDisplayValue = (value) => (
  <span className='whitespace-pre-wrap'>{formatDisplayValue(value)}</span>
);

const formatCustomOutput = (value) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export default function MatchView({
  loading,
  error,
  message,
  challengeId,
  isWaitingForStart,
  matchData,
  imports,
  onImportsChange,
  onImportsBlur,
  importsWarning,
  studentCode,
  onStudentCodeChange,
  fixedPrefix,
  fixedSuffix,
  finalCode,
  isRunning,
  isSubmitting,
  isSubmittingActive,
  peerReviewNotice,
  peerReviewPendingMessage,
  runResult,
  onRun,
  onSubmit,
  onTimerFinish,
  isChallengeFinished,
  isFinalizationPending,
  testResults,
  canSubmit,
  isTimeUp,
  isCompiled,
  onTryAgain,
  onClean,
  onRestore,
  hasRestorableCode,
  draftSaveState,
  customTests,
  customTestResults,
  customRunResult,
  isCustomRunning,
  customRunOrder,
  onCustomTestAdd,
  onCustomTestChange,
  onCustomTestRemove,
  onRunCustomTests,
}) {
  const { duration, startCodingPhaseDateTime, startDatetime } = useDuration();
  const codingPhaseTimerStart = startCodingPhaseDateTime || startDatetime;

  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [finished, setFinished] = useState(false);
  const [submissionError, setSubmissionError] = useState(null);
  const hasTimerFinished = useRef(false);

  const runResultClass = (() => {
    if (runResult?.type === 'error') return 'text-red-700 dark:text-red-400';
    if (runResult?.type === 'success')
      return 'text-green-700 dark:text-green-400';
    if (runResult?.type === 'info') return 'text-blue-700 dark:text-blue-400';
    return 'text-foreground';
  })();

  const customResultClass = (() => {
    if (customRunResult?.type === 'error')
      return 'text-red-700 dark:text-red-400';
    if (customRunResult?.type === 'success') {
      return 'text-green-700 dark:text-green-400';
    }
    if (customRunResult?.type === 'info')
      return 'text-blue-700 dark:text-blue-400';
    return 'text-foreground';
  })();

  const isBusy = isRunning || isSubmitting || isSubmittingFinal;
  const canSubmitNow =
    canSubmit && isSubmittingActive && !isSubmittingFinal && !isTimeUp;
  const canClean =
    Boolean(onClean) && !isBusy && !isTimeUp && !isChallengeFinished;
  const canRestore =
    Boolean(onRestore) &&
    hasRestorableCode &&
    !isBusy &&
    !isTimeUp &&
    !isChallengeFinished;
  const editorDisabled = isSubmittingFinal || isTimeUp || isChallengeFinished;
  const showImportsWarning = Boolean(importsWarning);

  let importsInputClassName =
    'w-full min-h-[96px] rounded-md border bg-background p-3 font-mono text-sm leading-relaxed';
  if (showImportsWarning) {
    importsInputClassName += ' border-amber-500';
  }

  const submitTitle = canSubmitNow
    ? 'Submit your solution for evaluation'
    : 'Run your code before submitting';
  const tryAgainTitle = isTimeUp
    ? 'View your submitted code'
    : 'Clear the results to try again';
  const actionButtonSize = 'sm';

  const saveIndicator = (() => {
    if (!draftSaveState) return null;
    if (draftSaveState === 'saving') {
      return (
        <div className='flex items-center gap-2 text-xs font-semibold text-amber-600'>
          <span
            className='h-3 w-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin'
            aria-hidden='true'
          />
          <span>Saving</span>
        </div>
      );
    }
    if (draftSaveState === 'saved') {
      return (
        <div className='flex items-center gap-2 text-xs font-semibold text-emerald-600'>
          <CheckCircle2 className='h-4 w-4' aria-hidden='true' />
          <span>Saved</span>
        </div>
      );
    }
    return null;
  })();

  const customResultMap = new Map();
  if (Array.isArray(customRunOrder)) {
    customRunOrder.forEach((id, index) => {
      const result = customTestResults?.[index];
      if (result) customResultMap.set(id, result);
    });
  }

  const handleTimerEnd = async () => {
    if (hasTimerFinished.current) return;
    if (!duration || duration <= 0) return;

    hasTimerFinished.current = true;
    setIsSubmittingFinal(true);
    setSubmissionError(null);

    try {
      const result = await onSubmit();
      if (result === false || result?.success === false) {
        setSubmissionError('Your code did not compile successfully.');
      }
    } catch {
      setSubmissionError('Error during final submission.');
    } finally {
      setIsSubmittingFinal(false);
      setFinished(true);
    }
  };

  const timerFinishHandler = onTimerFinish || handleTimerEnd;
  const finalizationMessage =
    'The coding phase has ended. We are finalizing your submission. Please wait.';

  if (loading) return <MatchLoadingState />;
  if (isWaitingForStart) return <MatchLobbyState />;
  if (error && !matchData) return <MatchUnavailableState error={error} />;
  if (!matchData) return <MatchMissingState />;

  if (finished) {
    return (
      <MatchFinishedState
        finalCode={finalCode}
        finalizationMessage={finalizationMessage}
        isFinalizationPending={Boolean(isFinalizationPending)}
        message={message}
        peerReviewNotice={peerReviewNotice}
        peerReviewPendingMessage={peerReviewPendingMessage}
        submissionError={submissionError}
      />
    );
  }

  if (isChallengeFinished) {
    return (
      <MatchCompletedState
        finalizationMessage={finalizationMessage}
        isFinalizationPending={Boolean(isFinalizationPending)}
        message={message}
        peerReviewNotice={peerReviewNotice}
        peerReviewPendingMessage={peerReviewPendingMessage}
      />
    );
  }

  return (
    <div className='max-w-7xl h-full my-2 relative px-3 sm:px-4'>
      {isSubmittingFinal ? (
        <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/40'>
          <Spinner label='Submitting your code...' />
        </div>
      ) : null}

      <div className='flex justify-center text-base font-bold sm:justify-end sm:text-lg'>
        <Timer
          duration={duration}
          challengeId={challengeId}
          startTime={codingPhaseTimerStart}
          onFinish={timerFinishHandler}
        />
      </div>
      <div className='my-4 flex flex-col gap-4 lg:flex-row lg:gap-6'>
        <MatchViewSidebar
          actionButtonSize={actionButtonSize}
          customResultClass={customResultClass}
          customResultMap={customResultMap}
          customRunResult={customRunResult}
          customTests={customTests}
          editorDisabled={editorDisabled}
          formatCustomOutput={formatCustomOutput}
          isCompiled={isCompiled}
          isCustomRunning={isCustomRunning}
          matchData={matchData}
          onCustomTestAdd={onCustomTestAdd}
          onCustomTestChange={onCustomTestChange}
          onCustomTestRemove={onCustomTestRemove}
          onRunCustomTests={onRunCustomTests}
          renderDisplayValue={renderDisplayValue}
          testResults={testResults}
        />

        <MatchViewEditorCard
          CppEditor={CppEditor}
          actionButtonSize={actionButtonSize}
          canClean={canClean}
          canRestore={canRestore}
          canSubmitNow={canSubmitNow}
          editorDisabled={editorDisabled}
          error={error}
          fixedPrefix={fixedPrefix}
          fixedSuffix={fixedSuffix}
          imports={imports}
          importsInputClassName={importsInputClassName}
          importsWarning={importsWarning}
          isBusy={isBusy}
          isChallengeFinished={isChallengeFinished}
          isRunning={isRunning}
          isSubmitting={isSubmitting}
          isTimeUp={isTimeUp}
          message={message}
          onClean={onClean}
          onImportsBlur={onImportsBlur}
          onImportsChange={onImportsChange}
          onRestore={onRestore}
          onRun={onRun}
          onStudentCodeChange={onStudentCodeChange}
          onSubmit={onSubmit}
          onTryAgain={onTryAgain}
          runResult={runResult}
          runResultClass={runResultClass}
          saveIndicator={saveIndicator}
          showImportsWarning={showImportsWarning}
          studentCode={studentCode}
          submitTitle={submitTitle}
          tryAgainTitle={tryAgainTitle}
        />
      </div>
    </div>
  );
}
