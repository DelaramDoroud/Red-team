import { Router } from 'express';
import { Op } from 'sequelize';
import Challenge from '#root/models/challenge.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import {
  ChallengeStatus,
  SubmissionStatus,
  VoteType,
} from '#root/models/enum/enums.js';
import Match from '#root/models/match.js';
import MatchSetting from '#root/models/match-setting.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer-review-vote.js';
import Submission from '#root/models/submission.js';
import User from '#root/models/user.js';
import { handleException } from '#root/services/error.js';
import finalizePeerReviewChallenge from '#root/services/finalize-peer-review.js';
import logger from '#root/services/logger.js';
import * as submitVoteService from '#root/services/peer-review-submit-vote.js';
import {
  normalizeOutputForComparison,
  runReferenceSolution,
} from '#root/services/reference-solution-evaluation.js';
import {
  getRequestRole,
  getRequestUserId,
  requireAuthenticatedUser,
} from '#root/services/request-auth.js';
import registerPeerReviewExitRoutes from './peer-review/routes/peer-review-exit-routes.js';
import registerPeerReviewFinalizeRoutes from './peer-review/routes/peer-review-finalize-routes.js';
import registerPeerReviewVoteSubmitRoutes from './peer-review/routes/peer-review-vote-submit-routes.js';
import registerPeerReviewVotesRoutes from './peer-review/routes/peer-review-votes-routes.js';

const router = Router();

const dependencies = {
  Op,
  handleException,
  ChallengeParticipant,
  PeerReviewAssignment,
  PeerReviewVote,
  Challenge,
  Submission,
  Match,
  ChallengeMatchSetting,
  MatchSetting,
  User,
  ChallengeStatus,
  VoteType,
  SubmissionStatus,
  logger,
  submitVoteService,
  runReferenceSolution,
  normalizeOutputForComparison,
  finalizePeerReviewChallenge,
  getRequestRole,
  getRequestUserId,
  requireAuthenticatedUser,
};

registerPeerReviewVotesRoutes(router, dependencies);
registerPeerReviewVoteSubmitRoutes(router, dependencies);
registerPeerReviewFinalizeRoutes(router, dependencies);
registerPeerReviewExitRoutes(router, dependencies);

export default router;
