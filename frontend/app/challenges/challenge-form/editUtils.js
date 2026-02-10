import { formatDateTimeLocal } from '#js/challenge-form-utils';

export const buildLocalDateTime = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatDateTimeLocal(parsed);
};

export const mergeMatchSettings = (readySettings, selectedSettings) => {
  const merged = Array.isArray(readySettings) ? [...readySettings] : [];
  const seenIds = new Set(merged.map((setting) => setting.id));

  (Array.isArray(selectedSettings) ? selectedSettings : []).forEach(
    (setting) => {
      if (!setting?.id || seenIds.has(setting.id)) return;
      merged.push(setting);
      seenIds.add(setting.id);
    }
  );

  return merged;
};

export const resolveChallengePayload = (result) => {
  if (!result || result?.success === false) return null;
  const direct =
    result?.challenge || result?.data?.challenge || result?.data || result;
  if (!direct || typeof direct !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(direct, 'id')) return null;
  return direct;
};

export const resolveMatchSettingsPayload = (result) => {
  if (!result || result?.success === false) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.matchSettings)) return result.matchSettings;
  if (Array.isArray(result?.data?.matchSettings)) {
    return result.data.matchSettings;
  }
  return [];
};

export const resolveMatchSettingPayload = (result) => {
  if (!result || result?.success === false) return null;
  const direct =
    result?.matchSetting ||
    result?.data?.matchSetting ||
    result?.data ||
    result;
  if (!direct || typeof direct !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(direct, 'id')) return null;
  return direct;
};
