'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChallengeStatus } from '#js/constants';
import { useAppDispatch } from '#js/store/hooks';
import { setLastCompiledCode } from '#js/store/slices/ui';
import useApiErrorRedirect from '#js/useApiErrorRedirect';
import useChallenge from '#js/useChallenge';
import { useDuration } from '../(context)/DurationContext';
import MatchView from './MatchView';
import {
  assembleCode,
  buildTemplateParts,
  MESSAGE_PEER_REVIEW_PENDING,
} from './matchHelpers';
import useFinalizationPolling from './useFinalizationPolling';
import useMatchActions from './useMatchActions';
import useMatchDraftEditor from './useMatchDraftEditor';
import useMatchEditorHandlers from './useMatchEditorHandlers';
import useMatchLifecycle from './useMatchLifecycle';

export default function MatchContainer({ challengeId, studentId }) {
  const dispatch = useAppDispatch();
  const durationContext = useDuration();
  const challengeStatus = durationContext?.status;
  const hasDurationContext = durationContext !== null;
  const isStatusKnown =
    hasDurationContext &&
    challengeStatus !== null &&
    challengeStatus !== undefined;
  const isCodingPhaseActive =
    challengeStatus === ChallengeStatus.STARTED_CODING_PHASE;
  const isWaitingForStart = challengeStatus === ChallengeStatus.ASSIGNED;
  const startSignature =
    durationContext?.startCodingPhaseDateTime || durationContext?.startDatetime;
  const challengeSignature = useMemo(
    () =>
      startSignature ? `${challengeId}-${startSignature}` : `${challengeId}`,
    [challengeId, startSignature]
  );
  const peerReviewPendingMessage =
    challengeStatus === ChallengeStatus.ENDED_CODING_PHASE
      ? MESSAGE_PEER_REVIEW_PENDING
      : null;
  const isCodingPhaseOver =
    challengeStatus === ChallengeStatus.ENDED_CODING_PHASE ||
    challengeStatus === ChallengeStatus.STARTED_PEER_REVIEW ||
    challengeStatus === ChallengeStatus.ENDED_PEER_REVIEW;

  const {
    getStudentAssignedMatchSetting,
    getStudentAssignedMatch,
    getChallengeResults,
    submitSubmission,
    getLastSubmission,
    runCode,
    runCustomTests,
  } = useChallenge();
  const redirectOnError = useApiErrorRedirect();

  const [loading, setLoading] = useState(true);
  const [matchData, setMatchData] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [runResult, setRunResult] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [customTests, setCustomTests] = useState([]);
  const [customRunResult, setCustomRunResult] = useState(null);
  const [customTestResults, setCustomTestResults] = useState([]);
  const [customRunOrder, setCustomRunOrder] = useState([]);
  const [isCustomRunning, setIsCustomRunning] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingActive, setIsSubmittingActive] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isCompiled, setIsCompiled] = useState(null);
  const [isChallengeFinished, setIsChallengeFinished] = useState(false);
  const [isFinalizationPending, setIsFinalizationPending] = useState(false);

  const lastSuccessRef = useRef(null);
  const lastManualSubmissionRef = useRef(null);
  const autoSubmitTriggeredRef = useRef(false);
  const finalizationPollTimerRef = useRef(null);

  const getLastSuccessCode = useCallback(() => lastSuccessRef.current, []);
  const setLastSuccessCode = useCallback((code) => {
    lastSuccessRef.current = code;
  }, []);
  const getLastManualSubmission = useCallback(
    () => lastManualSubmissionRef.current,
    []
  );
  const setLastManualSubmission = useCallback((code) => {
    lastManualSubmissionRef.current = code;
  }, []);
  const isAutoSubmitTriggered = useCallback(
    () => autoSubmitTriggeredRef.current,
    []
  );
  const markAutoSubmitTriggered = useCallback(() => {
    autoSubmitTriggeredRef.current = true;
  }, []);

  const clearFinalizationTimer = useCallback(() => {
    if (finalizationPollTimerRef.current) {
      clearTimeout(finalizationPollTimerRef.current);
      finalizationPollTimerRef.current = null;
    }
  }, []);

  const resetSessionRefs = useCallback(() => {
    lastSuccessRef.current = null;
    lastManualSubmissionRef.current = null;
    autoSubmitTriggeredRef.current = false;
  }, []);

  useEffect(
    () => () => {
      if (finalizationPollTimerRef.current) {
        clearTimeout(finalizationPollTimerRef.current);
        finalizationPollTimerRef.current = null;
      }
    },
    []
  );

  const storageKeyBase = useMemo(
    () => (matchId ? `match-${matchId}` : `challenge-${challengeId}`),
    [challengeId, matchId]
  );

  const templateParts = useMemo(
    () => buildTemplateParts(matchData?.starterCode),
    [matchData]
  );
  const { imports: defaultImports, fixedPrefix, fixedSuffix } = templateParts;

  const {
    imports,
    setImports,
    studentCode,
    setStudentCode,
    importsWarning,
    setImportsWarning,
    draftSaveState,
    savedLastCompiledSnapshot,
    resetDraftEditorState,
  } = useMatchDraftEditor({
    challengeId,
    challengeSignature,
    defaultImports,
    fixedPrefix,
    fixedSuffix,
    matchData,
    matchId,
    startSignature,
    storageKeyBase,
    studentId,
    setLastSuccessCode,
  });

  const assembledCode = useMemo(
    () => assembleCode(imports, fixedPrefix, studentCode, fixedSuffix),
    [imports, fixedPrefix, studentCode, fixedSuffix]
  );

  const storeLastCompiled = useCallback(() => {
    if (!studentId) return;
    if (!imports.trim() && !studentCode.trim()) return;
    dispatch(
      setLastCompiledCode({
        userId: studentId,
        key: storageKeyBase,
        imports,
        studentCode,
        signature: challengeSignature,
      })
    );
  }, [
    challengeSignature,
    dispatch,
    imports,
    storageKeyBase,
    studentCode,
    studentId,
  ]);

  useMatchLifecycle({
    challengeId,
    studentId,
    clearFinalizationTimer,
    getStudentAssignedMatch,
    getStudentAssignedMatchSetting,
    hasDurationContext,
    isCodingPhaseActive,
    isStatusKnown,
    isWaitingForStart,
    redirectOnError,
    resetDraftEditorState,
    resetSessionRefs,
    setCanSubmit,
    setCustomRunOrder,
    setCustomRunResult,
    setCustomTestResults,
    setCustomTests,
    setError,
    setIsCompiled,
    setIsCustomRunning,
    setIsFinalizationPending,
    setIsRunning,
    setIsSubmitting,
    setIsSubmittingActive,
    setIsTimeUp,
    setLoading,
    setMatchData,
    setMatchId,
    setMessage,
    setRunResult,
    setTestResults,
  });

  useFinalizationPolling({
    challengeId,
    studentId,
    isFinalizationPending,
    getChallengeResults,
    redirectOnError,
    setMessage,
    setIsFinalizationPending,
  });

  const {
    handleRun,
    handleSubmit,
    handleTimerFinish,
    addCustomTest,
    updateCustomTest,
    removeCustomTest,
    handleRunCustomTests,
  } = useMatchActions({
    assembledCode,
    canSubmit,
    challengeId,
    challengeSignature,
    clearFinalizationTimer,
    customTests,
    dispatch,
    getLastManualSubmission,
    getLastSubmission,
    getLastSuccessCode,
    getStudentAssignedMatch,
    imports,
    isAutoSubmitTriggered,
    isChallengeFinished,
    isCodingPhaseOver,
    isSubmitting,
    isTimeUp,
    markAutoSubmitTriggered,
    matchData,
    runCode,
    runCustomTests,
    setLastManualSubmission,
    setLastSuccessCode,
    setCanSubmit,
    setCustomRunOrder,
    setCustomRunResult,
    setCustomTestResults,
    setCustomTests,
    setError,
    setIsChallengeFinished,
    setIsCompiled,
    setIsCustomRunning,
    setIsFinalizationPending,
    setIsRunning,
    setIsSubmitting,
    setIsSubmittingActive,
    setIsTimeUp,
    setMatchId,
    setMessage,
    setRunResult,
    setTestResults,
    storageKeyBase,
    studentCode,
    studentId,
    submitSubmission,
    storeLastCompiled,
  });

  const {
    handleTryAgain,
    handleImportsChange,
    handleImportsBlur,
    handleClean,
    handleRestore,
  } = useMatchEditorHandlers({
    defaultImports,
    savedLastCompiledSnapshot,
    setCanSubmit,
    setError,
    setImports,
    setImportsWarning,
    setIsCompiled,
    setIsSubmittingActive,
    setMessage,
    setRunResult,
    setStudentCode,
    setTestResults,
  });

  const hasRestorableCode = Boolean(
    savedLastCompiledSnapshot?.imports?.trim() ||
      savedLastCompiledSnapshot?.studentCode?.trim()
  );
  const showDraftSaveState = matchData ? draftSaveState : null;

  return (
    <MatchView
      loading={loading}
      error={error}
      message={message}
      challengeId={challengeId}
      isWaitingForStart={isWaitingForStart}
      matchData={matchData}
      imports={imports}
      onImportsChange={handleImportsChange}
      onImportsBlur={handleImportsBlur}
      importsWarning={importsWarning}
      studentCode={studentCode}
      onStudentCodeChange={setStudentCode}
      fixedPrefix={fixedPrefix}
      fixedSuffix={fixedSuffix}
      finalCode={assembledCode}
      isRunning={isRunning}
      isSubmitting={isSubmitting}
      isSubmittingActive={isSubmittingActive}
      peerReviewNotice={matchData?.peerReviewBlockedMessage || null}
      peerReviewPendingMessage={peerReviewPendingMessage}
      runResult={runResult}
      onRun={handleRun}
      onSubmit={handleSubmit}
      customTests={customTests}
      customTestResults={customTestResults}
      customRunResult={customRunResult}
      isCustomRunning={isCustomRunning}
      customRunOrder={customRunOrder}
      onCustomTestAdd={addCustomTest}
      onCustomTestChange={updateCustomTest}
      onCustomTestRemove={removeCustomTest}
      onRunCustomTests={handleRunCustomTests}
      isTimeUp={isTimeUp}
      onTimerFinish={handleTimerFinish}
      testResults={testResults}
      canSubmit={canSubmit}
      isCompiled={isCompiled}
      isChallengeFinished={isChallengeFinished}
      isFinalizationPending={isFinalizationPending}
      draftSaveState={showDraftSaveState}
      onTryAgain={handleTryAgain}
      onClean={handleClean}
      onRestore={handleRestore}
      hasRestorableCode={hasRestorableCode}
    />
  );
}
