import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '#js/store/hooks';
import {
  clearChallengeDraft,
  migrateChallengeKey,
  setDraftCode,
} from '#js/store/slices/ui';
import {
  assembleCode,
  DRAFT_SAVE_DELAY_MS,
  normalizeCode,
  normalizeSnapshot,
} from './matchHelpers';

export default function useMatchDraftEditor({
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
}) {
  const dispatch = useAppDispatch();

  const [imports, setImports] = useState(defaultImports);
  const [studentCode, setStudentCode] = useState('');
  const [importsWarning, setImportsWarning] = useState('');
  const [draftSaveState, setDraftSaveState] = useState('saved');

  const hasLoadedFromStorage = useRef(false);
  const draftSaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef({ imports: '', studentCode: '' });

  const savedDraftEntry = useAppSelector((state) => {
    if (!studentId) return null;
    return state.ui.challengeDrafts?.[studentId]?.[storageKeyBase] || null;
  });

  const shouldIgnoreSavedDraft = Boolean(
    savedDraftEntry &&
      savedDraftEntry.signature &&
      savedDraftEntry.signature !== challengeSignature
  );
  const activeDraftEntry = shouldIgnoreSavedDraft ? null : savedDraftEntry;

  const savedLastCompiledSnapshot = useMemo(
    () => normalizeSnapshot(activeDraftEntry?.lastCompiled),
    [activeDraftEntry?.lastCompiled]
  );

  const savedLastSuccessSnapshot = useMemo(
    () => normalizeSnapshot(activeDraftEntry?.lastSuccessful),
    [activeDraftEntry?.lastSuccessful]
  );

  const hasSignatureToken = Boolean(startSignature);

  const resetDraftEditorState = useCallback(() => {
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    hasLoadedFromStorage.current = false;
    setImports(defaultImports);
    setStudentCode('');
    setImportsWarning('');
    setDraftSaveState('saved');
    lastSavedSnapshotRef.current = { imports: '', studentCode: '' };
  }, [defaultImports]);

  useEffect(
    () => () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!studentId || !shouldIgnoreSavedDraft) return;
    dispatch(
      clearChallengeDraft({
        userId: studentId,
        key: storageKeyBase,
      })
    );
  }, [dispatch, shouldIgnoreSavedDraft, storageKeyBase, studentId]);

  useEffect(() => {
    if (!studentId || !matchId) return;
    const fromKey = `challenge-${challengeId}`;
    const toKey = `match-${matchId}`;
    dispatch(
      migrateChallengeKey({
        userId: studentId,
        fromKey,
        toKey,
      })
    );
  }, [challengeId, dispatch, matchId, studentId]);

  useEffect(() => {
    hasLoadedFromStorage.current = false;
  }, [challengeId, matchId, studentId, challengeSignature]);

  useEffect(() => {
    if (!matchData) return;
    if (hasLoadedFromStorage.current) return;

    const draftImports =
      typeof activeDraftEntry?.imports === 'string'
        ? activeDraftEntry.imports
        : '';
    const draftStudentCode =
      typeof activeDraftEntry?.studentCode === 'string'
        ? activeDraftEntry.studentCode
        : '';
    const draftHasContent = Boolean(
      draftImports.trim() || draftStudentCode.trim()
    );
    const hasCurrentStudentCode = Boolean(normalizeCode(studentCode));

    let nextImports = defaultImports;
    let nextStudentCode = '';
    if (activeDraftEntry) {
      nextImports = draftImports || defaultImports;
      nextStudentCode = draftStudentCode;
    }

    if (hasCurrentStudentCode && !draftHasContent) {
      if (savedLastSuccessSnapshot) {
        setLastSuccessCode(
          assembleCode(
            savedLastSuccessSnapshot.imports || defaultImports,
            fixedPrefix,
            savedLastSuccessSnapshot.studentCode,
            fixedSuffix
          )
        );
      } else {
        setLastSuccessCode(null);
      }

      lastSavedSnapshotRef.current = {
        imports,
        studentCode,
      };
      setDraftSaveState('saved');
      hasLoadedFromStorage.current = true;
      return;
    }

    setImports(nextImports);
    setStudentCode(nextStudentCode);
    setImportsWarning('');

    if (savedLastSuccessSnapshot) {
      setLastSuccessCode(
        assembleCode(
          savedLastSuccessSnapshot.imports || defaultImports,
          fixedPrefix,
          savedLastSuccessSnapshot.studentCode,
          fixedSuffix
        )
      );
    } else {
      setLastSuccessCode(null);
    }

    lastSavedSnapshotRef.current = {
      imports: nextImports,
      studentCode: nextStudentCode,
    };
    setDraftSaveState('saved');
    hasLoadedFromStorage.current = true;

    if (
      studentId &&
      activeDraftEntry &&
      hasSignatureToken &&
      !activeDraftEntry.signature
    ) {
      dispatch(
        setDraftCode({
          userId: studentId,
          key: storageKeyBase,
          imports: nextImports,
          studentCode: nextStudentCode,
          signature: challengeSignature,
        })
      );
    }
  }, [
    activeDraftEntry,
    challengeSignature,
    defaultImports,
    dispatch,
    fixedPrefix,
    fixedSuffix,
    hasSignatureToken,
    imports,
    matchData,
    savedLastSuccessSnapshot,
    setLastSuccessCode,
    storageKeyBase,
    studentCode,
    studentId,
  ]);

  useEffect(() => {
    if (!studentId || !matchData) return;
    if (!hasLoadedFromStorage.current) return;

    const nextSnapshot = {
      imports,
      studentCode,
    };
    const previousSnapshot = lastSavedSnapshotRef.current;
    const hasChanges =
      nextSnapshot.imports !== previousSnapshot.imports ||
      nextSnapshot.studentCode !== previousSnapshot.studentCode;
    if (!hasChanges) return;

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }
    setDraftSaveState('saving');
    draftSaveTimerRef.current = setTimeout(() => {
      dispatch(
        setDraftCode({
          userId: studentId,
          key: storageKeyBase,
          imports: nextSnapshot.imports,
          studentCode: nextSnapshot.studentCode,
          signature: challengeSignature,
        })
      );
      lastSavedSnapshotRef.current = nextSnapshot;
      setDraftSaveState('saved');
    }, DRAFT_SAVE_DELAY_MS);
  }, [
    challengeSignature,
    dispatch,
    imports,
    matchData,
    storageKeyBase,
    studentCode,
    studentId,
  ]);

  return {
    imports,
    setImports,
    studentCode,
    setStudentCode,
    importsWarning,
    setImportsWarning,
    draftSaveState,
    setDraftSaveState,
    savedLastCompiledSnapshot,
    resetDraftEditorState,
  };
}
