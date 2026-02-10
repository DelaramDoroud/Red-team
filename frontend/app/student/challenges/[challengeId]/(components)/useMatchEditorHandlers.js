import { useCallback } from 'react';
import { analyzeImports } from './matchHelpers';

export default function useMatchEditorHandlers({
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
}) {
  const handleTryAgain = useCallback(() => {
    setMessage(null);
    setError(null);
    setIsSubmittingActive(false);
    setRunResult(null);
    setTestResults([]);
  }, [
    setError,
    setIsSubmittingActive,
    setMessage,
    setRunResult,
    setTestResults,
  ]);

  const handleImportsChange = useCallback(
    (value) => {
      setImports(value);
      setImportsWarning('');
    },
    [setImports, setImportsWarning]
  );

  const handleImportsBlur = useCallback(
    (event) => {
      const { invalidLines } = analyzeImports(event.target.value);
      if (invalidLines.length > 0) {
        const suffix = invalidLines.length === 1 ? '' : 's';
        setImportsWarning(
          `Found ${invalidLines.length} non-#include line${suffix}.`
        );
      } else {
        setImportsWarning('');
      }
    },
    [setImportsWarning]
  );

  const handleClean = useCallback(() => {
    setImports(defaultImports);
    setStudentCode('');
    setImportsWarning('');
    setRunResult(null);
    setTestResults([]);
    setIsCompiled(null);
    setCanSubmit(false);
    setIsSubmittingActive(false);
    setMessage(null);
    setError(null);
  }, [
    defaultImports,
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
  ]);

  const handleRestore = useCallback(() => {
    if (!savedLastCompiledSnapshot) return;
    const restoredImports = savedLastCompiledSnapshot.imports || defaultImports;
    const restoredStudentCode = savedLastCompiledSnapshot.studentCode || '';
    if (!restoredImports.trim() && !restoredStudentCode.trim()) return;
    setImports(restoredImports);
    setStudentCode(restoredStudentCode);
    setImportsWarning('');
    setRunResult(null);
    setTestResults([]);
    setIsCompiled(null);
    setCanSubmit(false);
    setIsSubmittingActive(false);
    setMessage(null);
    setError(null);
  }, [
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
  ]);

  return {
    handleTryAgain,
    handleImportsChange,
    handleImportsBlur,
    handleClean,
    handleRestore,
  };
}
