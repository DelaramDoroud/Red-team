import { getApiErrorMessage } from '#js/apiError';
import { EMPTY_PEER_REVIEW_SUMMARY } from './peerReviewSummaryDefaults';

export default async function fetchPeerReviewSummary({
  challengeId,
  studentId,
  getPeerReviewSummary,
}) {
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
    summary: res?.summary || EMPTY_PEER_REVIEW_SUMMARY,
  };
}
