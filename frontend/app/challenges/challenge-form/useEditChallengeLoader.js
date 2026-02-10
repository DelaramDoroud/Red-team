import { useEffect } from 'react';
import { updateEndDateTime } from '#js/challenge-form-utils';
import * as Constants from '#js/constants';
import { formatDateTime } from '#js/date';
import {
  buildLocalDateTime,
  mergeMatchSettings,
  resolveChallengePayload,
  resolveMatchSettingPayload,
  resolveMatchSettingsPayload,
} from './editUtils';

export default function useEditChallengeLoader({
  challengeId,
  getChallengeById,
  getMatchSetting,
  getMatchSettings,
  isAuthorized,
  setChallenge,
  setError,
  setInitialStatus,
  setLoadingChallenge,
  setMatchSettings,
}) {
  useEffect(() => {
    if (!isAuthorized || !challengeId) return undefined;

    let mounted = true;

    const loadData = async () => {
      setLoadingChallenge(true);
      setError(null);

      try {
        const [challengeResult, matchSettingsResult] = await Promise.all([
          getChallengeById(challengeId),
          getMatchSettings(),
        ]);
        if (!mounted) return;

        const challengeData = resolveChallengePayload(challengeResult);
        if (!challengeData) {
          setError(
            challengeResult?.message || 'Unable to load challenge details.'
          );
          setLoadingChallenge(false);
          return;
        }

        const {
          title,
          duration,
          allowedNumberOfReview,
          durationPeerReview,
          status,
          startDatetime,
          endDatetime,
          startCodingPhaseDateTime,
          endPeerReviewDateTime,
          matchSettings: challengeMatchSettings,
        } = challengeData;

        const startSource = startDatetime || startCodingPhaseDateTime || null;
        const endSource = endDatetime || endPeerReviewDateTime || null;
        const localStart = buildLocalDateTime(startSource);
        const localEnd = buildLocalDateTime(endSource);
        const { matchSettingIds: challengeMatchSettingIds = [] } =
          challengeData;

        let matchSettingIds = [];
        if (Array.isArray(challengeMatchSettingIds)) {
          matchSettingIds = challengeMatchSettingIds;
        } else if (Array.isArray(challengeMatchSettings)) {
          matchSettingIds = challengeMatchSettings
            .map((setting) => setting?.id)
            .filter(Boolean);
        }
        matchSettingIds = Array.from(new Set(matchSettingIds));

        let nextChallenge = {
          title: title || '',
          startDatetime: localStart,
          endDatetime: localEnd,
          startDatetimeInput: localStart ? formatDateTime(localStart) : '',
          endDatetimeInput: localEnd ? formatDateTime(localEnd) : '',
          duration: String(duration ?? ''),
          allowedNumberOfReview: String(allowedNumberOfReview ?? ''),
          matchSettingIds,
          status: status || Constants.ChallengeStatus.PRIVATE,
          durationPeerReview: String(durationPeerReview ?? ''),
        };

        if (!localEnd && localStart) {
          const updated = updateEndDateTime(nextChallenge);
          if (updated) {
            nextChallenge = {
              ...nextChallenge,
              ...updated,
            };
          }
        }

        setChallenge(nextChallenge);
        setInitialStatus(status || Constants.ChallengeStatus.PRIVATE);

        const readySettings = resolveMatchSettingsPayload(matchSettingsResult);
        let mergedSettings = mergeMatchSettings(
          readySettings,
          challengeMatchSettings
        );

        if (mergedSettings.length === 0 && matchSettingIds.length > 0) {
          const selectedSettings = await Promise.all(
            matchSettingIds.map((id) => getMatchSetting(id))
          );
          const resolvedSelected = selectedSettings
            .map((result) => resolveMatchSettingPayload(result))
            .filter(Boolean);
          mergedSettings = mergeMatchSettings(readySettings, resolvedSelected);
        }

        setMatchSettings(mergedSettings);

        if (status && status !== Constants.ChallengeStatus.PRIVATE) {
          setError(
            'This challenge must be private to edit. Unpublish it first.'
          );
        }
      } catch {
        if (mounted) {
          setError('Error loading challenge details.');
        }
      } finally {
        if (mounted) {
          setLoadingChallenge(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [
    challengeId,
    getChallengeById,
    getMatchSetting,
    getMatchSettings,
    isAuthorized,
    setChallenge,
    setError,
    setInitialStatus,
    setLoadingChallenge,
    setMatchSettings,
  ]);
}
