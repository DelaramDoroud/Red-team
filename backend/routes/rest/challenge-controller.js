import { Router } from 'express';
import { Op } from 'sequelize';
import Badge from '#root/models/badge.js';
import Challenge, { validateChallengeData } from '#root/models/challenge.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import {
  ChallengeStatus,
  Scoring_Availability,
  SubmissionStatus,
  VoteType,
} from '#root/models/enum/enums.js';
import Match from '#root/models/match.js';
import MatchSetting from '#root/models/match-setting.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer-review-vote.js';
import StudentBadge from '#root/models/student-badges.js';
import Submission from '#root/models/submission.js';
import SubmissionScoreBreakdown from '#root/models/submission-score-breakdown.js';
import Title from '#root/models/title.js';
import User from '#root/models/user.js';
import assignMatches from '#root/services/assign-matches.js';
import assignPeerReviews from '#root/services/assign-peer-reviews.js';
import {
  awardChallengeMilestoneBadges,
  awardReviewMilestoneBadges,
  awardReviewQualityBadges,
  getReviewBadgesEarnedSince,
} from '#root/services/challenge-completed-badges.js';
import {
  getChallengeParticipants,
  joinChallenge,
} from '#root/services/challenge-participant.js';
import {
  scheduleCodingPhaseEndForChallenge,
  schedulePeerReviewEndForChallenge,
} from '#root/services/challenge-scheduler.js';
import {
  CODING_PHASE_AUTOSUBMIT_GRACE_MS,
  getInFlightSubmissionsCount,
  maybeCompleteCodingPhaseFinalization,
} from '#root/services/coding-phase-finalization.js';
import { handleException } from '#root/services/error.js';
import { broadcastEvent } from '#root/services/event-stream.js';
import { executeCodeTests } from '#root/services/execute-code-tests.js';
import finalizePeerReviewChallenge from '#root/services/finalize-peer-review.js';
import { validateImportsBlock } from '#root/services/import-validation.js';
import logger from '#root/services/logger.js';
import getPeerReviewSummary from '#root/services/peer-review-summary.js';
import {
  normalizeOutputForComparison,
  runReferenceSolution,
} from '#root/services/reference-solution-evaluation.js';
import {
  getRequestRole,
  getRequestUser,
  getRequestUserId,
  isPrivilegedRole,
  requireAuthenticatedUser,
  requirePrivilegedUser,
} from '#root/services/request-auth.js';
import { calculateChallengeScores } from '#root/services/scoring-service.js';
import sequelize from '#root/services/sequelize.js';
import startChallengeService from '#root/services/start-challenge.js';
import startPeerReviewService from '#root/services/start-peer-review.js';
import { finalizeMissingSubmissionsForChallenge } from '#root/services/submission-finalization.js';
import getValidator from '#root/services/validator.js';
import registerChallengeAssignmentRoutes from './challenge/routes/challenge-assignment-routes.js';
import registerChallengeCreateJoinRoutes from './challenge/routes/challenge-create-join-routes.js';
import registerChallengeCustomTestsMatchSettingRoutes from './challenge/routes/challenge-custom-tests-matchsetting-routes.js';
import registerChallengeDetailsScoringRoutes from './challenge/routes/challenge-details-scoring-routes.js';
import registerChallengeLeaderboardManualRoutes from './challenge/routes/challenge-leaderboard-manual-routes.js';
import registerChallengeListsRoutes from './challenge/routes/challenge-lists-routes.js';
import registerChallengeMatchesExpectedRoutes from './challenge/routes/challenge-matches-expected-routes.js';
import registerChallengePeerReviewAssignRoutes from './challenge/routes/challenge-peer-review-assign-routes.js';
import registerChallengePeerReviewStudentRoutes from './challenge/routes/challenge-peer-review-student-routes.js';
import registerChallengePhaseEndOverviewRoutes from './challenge/routes/challenge-phase-end-overview-routes.js';
import registerChallengePhaseTransitionRoutes from './challenge/routes/challenge-phase-transition-routes.js';
import registerChallengePrivateTestsRoutes from './challenge/routes/challenge-private-tests-routes.js';
import registerChallengePublishUpdateRoutes from './challenge/routes/challenge-publish-update-routes.js';
import registerChallengeStudentMatchRoutes from './challenge/routes/challenge-student-match-routes.js';
import registerChallengeStudentResultsRoutes from './challenge/routes/challenge-student-results-routes.js';
import registerChallengeTeacherResultsRoutes from './challenge/routes/challenge-teacher-results-routes.js';
import {
  emitChallengeUpdate,
  executeInBatches,
  getChallengeStatsMap,
  isEndedStatus,
  normalizeCustomTests,
  normalizeFeedbackTests,
  parseJsonValue,
  parseJsonValueStrict,
  parseTestResults,
  resolveStudentIdFromRequest,
  shouldHidePrivate,
} from './challenge/shared.js';

const router = Router();

const dependencies = {
  sequelize,
  Challenge,
  validateChallengeData,
  MatchSetting,
  Match,
  ChallengeMatchSetting,
  ChallengeParticipant,
  User,
  Submission,
  PeerReviewAssignment,
  PeerReviewVote,
  SubmissionScoreBreakdown,
  StudentBadge,
  Badge,
  Title,
  ChallengeStatus,
  SubmissionStatus,
  VoteType,
  Scoring_Availability,
  handleException,
  getValidator,
  getChallengeParticipants,
  joinChallenge,
  assignMatches,
  startChallengeService,
  startPeerReviewService,
  assignPeerReviews,
  broadcastEvent,
  scheduleCodingPhaseEndForChallenge,
  schedulePeerReviewEndForChallenge,
  executeCodeTests,
  validateImportsBlock,
  normalizeOutputForComparison,
  runReferenceSolution,
  logger,
  Op,
  getPeerReviewSummary,
  calculateChallengeScores,
  finalizePeerReviewChallenge,
  finalizeMissingSubmissionsForChallenge,
  CODING_PHASE_AUTOSUBMIT_GRACE_MS,
  getInFlightSubmissionsCount,
  maybeCompleteCodingPhaseFinalization,
  awardChallengeMilestoneBadges,
  awardReviewMilestoneBadges,
  awardReviewQualityBadges,
  getReviewBadgesEarnedSince,
  getRequestRole,
  getRequestUser,
  getRequestUserId,
  isPrivilegedRole,
  requireAuthenticatedUser,
  requirePrivilegedUser,
  shouldHidePrivate,
  isEndedStatus,
  emitChallengeUpdate,
  normalizeCustomTests,
  normalizeFeedbackTests,
  parseTestResults,
  parseJsonValue,
  parseJsonValueStrict,
  executeInBatches,
  getChallengeStatsMap,
  resolveStudentIdFromRequest,
};

registerChallengeListsRoutes(router, dependencies);
registerChallengeCreateJoinRoutes(router, dependencies);
registerChallengeAssignmentRoutes(router, dependencies);
registerChallengeMatchesExpectedRoutes(router, dependencies);
registerChallengePeerReviewAssignRoutes(router, dependencies);
registerChallengePeerReviewStudentRoutes(router, dependencies);
registerChallengePhaseTransitionRoutes(router, dependencies);
registerChallengePhaseEndOverviewRoutes(router, dependencies);
registerChallengeCustomTestsMatchSettingRoutes(router, dependencies);
registerChallengeStudentMatchRoutes(router, dependencies);
registerChallengeStudentResultsRoutes(router, dependencies);
registerChallengeTeacherResultsRoutes(router, dependencies);
registerChallengePrivateTestsRoutes(router, dependencies);
registerChallengePublishUpdateRoutes(router, dependencies);
registerChallengeDetailsScoringRoutes(router, dependencies);
registerChallengeLeaderboardManualRoutes(router, dependencies);

export default router;
