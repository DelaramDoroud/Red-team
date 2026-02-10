import { useCallback, useMemo } from 'react';
import {
  buildMinimumEndDate,
  formatDateTimeLocal,
  isDateTimeInputWithinLimits,
  normalizeDateTimeInput,
  parsePositiveInt,
  resolveDateTimeInputValue,
  updateEndDateTime,
} from '#js/challenge-form-utils';
import * as Constants from '#js/constants';
import { formatDateTime } from '#js/date';

export default function useChallengeFormState({
  challenge,
  setChallenge,
  canToggleStatus = true,
}) {
  const toggleSetting = useCallback(
    (id) => {
      setChallenge((prev) => ({
        ...prev,
        matchSettingIds: prev.matchSettingIds.includes(id)
          ? prev.matchSettingIds.filter((settingId) => settingId !== id)
          : [...prev.matchSettingIds, id],
      }));
    },
    [setChallenge]
  );

  const toggleStatus = useCallback(() => {
    if (!canToggleStatus) return;
    setChallenge((prev) => ({
      ...prev,
      status:
        prev.status === Constants.ChallengeStatus.PUBLIC
          ? Constants.ChallengeStatus.PRIVATE
          : Constants.ChallengeStatus.PUBLIC,
    }));
  }, [canToggleStatus, setChallenge]);

  const handleDataField = useCallback(
    (event) => {
      const { name, value } = event.target;
      let nextChallenge = { ...challenge };

      if (name === 'startDatetime' || name === 'endDatetime') {
        if (!isDateTimeInputWithinLimits(value)) return;
        const { normalized, inputValue } = resolveDateTimeInputValue(value);
        nextChallenge = {
          ...nextChallenge,
          [name]: normalized,
          [`${name}Input`]: inputValue,
        };
      } else {
        nextChallenge = { ...nextChallenge, [name]: value };
      }

      if (
        name === 'startDatetime' ||
        name === 'duration' ||
        name === 'durationPeerReview'
      ) {
        const updated = updateEndDateTime(nextChallenge);
        if (updated) {
          nextChallenge = { ...nextChallenge, ...updated };
        }
      }

      setChallenge(nextChallenge);
    },
    [challenge, setChallenge]
  );

  const handleDatePickerChange = useCallback(
    (name) => (event) => {
      const { value } = event.target;
      setChallenge((prev) => {
        let next = {
          ...prev,
          [name]: value,
          [`${name}Input`]: value ? formatDateTime(value) : '',
        };
        if (name === 'startDatetime') {
          const updated = updateEndDateTime(next);
          if (updated) {
            next = { ...next, ...updated };
          }
        }
        return next;
      });
    },
    [setChallenge]
  );

  const handleDateBlur = useCallback(
    (name) => {
      setChallenge((prev) => {
        const rawValue = prev[`${name}Input`] || '';
        const normalized = normalizeDateTimeInput(rawValue);
        const parsed = new Date(normalized);
        if (Number.isNaN(parsed.getTime())) return prev;
        return {
          ...prev,
          [name]: normalized,
          [`${name}Input`]: formatDateTime(normalized),
        };
      });
    },
    [setChallenge]
  );

  const openPicker = useCallback((ref) => {
    if (ref.current?.showPicker) {
      ref.current.showPicker();
      return;
    }
    ref.current?.focus();
    ref.current?.click?.();
  }, []);

  const durationValue = parsePositiveInt(challenge.duration);
  const durationPeerReviewValue = parsePositiveInt(
    challenge.durationPeerReview
  );

  const canPickEndDate = useMemo(
    () =>
      Boolean(challenge.startDatetime) &&
      Number.isInteger(durationValue) &&
      durationValue >= 2 &&
      Number.isInteger(durationPeerReviewValue) &&
      durationPeerReviewValue >= 2,
    [challenge.startDatetime, durationValue, durationPeerReviewValue]
  );

  const getMinDateTimeValue = useCallback(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return formatDateTimeLocal(now);
  }, []);

  const getMinEndDateValue = useCallback(() => {
    const minEndDate = buildMinimumEndDate(challenge);
    if (!minEndDate) return getMinDateTimeValue();
    return formatDateTimeLocal(minEndDate);
  }, [challenge, getMinDateTimeValue]);

  return {
    toggleSetting,
    toggleStatus,
    handleDataField,
    handleDatePickerChange,
    handleDateBlur,
    openPicker,
    canPickEndDate,
    getMinDateTimeValue,
    getMinEndDateValue,
  };
}
