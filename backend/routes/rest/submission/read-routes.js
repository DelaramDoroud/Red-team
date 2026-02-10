import ChallengeParticipant from '#root/models/challenge-participant.js';
import Submission from '#root/models/submission.js';
import { handleException } from '#root/services/error.js';
import logger from '#root/services/logger.js';
import {
  parseBooleanQuery,
  requireAuthenticatedUser,
} from '#root/services/request-auth.js';
import { canAccessSubmission, serializeSubmissionPayload } from './shared.js';

const registerSubmissionReadRoutes = (router) => {
  router.get(
    '/submissions/last',
    requireAuthenticatedUser,
    async (req, res) => {
      try {
        const matchId = Number(req.query?.matchId);
        if (!matchId) {
          return res.status(400).json({
            success: false,
            error: { message: 'Match ID is required' },
          });
        }

        const includeCode = !parseBooleanQuery(req.query?.metadataOnly);
        const queryOptions = {
          include: [
            {
              model: ChallengeParticipant,
              as: 'challengeParticipant',
              attributes: ['id', 'studentId', 'challengeId'],
              required: true,
            },
          ],
          order: [
            ['updatedAt', 'DESC'],
            ['id', 'DESC'],
          ],
        };

        let submission = await Submission.findOne({
          ...queryOptions,
          where: { matchId, isFinal: true },
        });

        if (!submission) {
          submission = await Submission.findOne({
            ...queryOptions,
            where: { matchId },
          });
        }

        if (!submission) {
          return res.status(404).json({
            success: false,
            error: { message: 'Submission not found' },
          });
        }

        const canAccess = await canAccessSubmission({ req, submission });
        if (!canAccess) {
          return res.status(404).json({
            success: false,
            error: { message: 'Submission not found' },
          });
        }

        return res.json({
          success: true,
          data: {
            submission: serializeSubmissionPayload(submission, { includeCode }),
          },
        });
      } catch (error) {
        logger.error('Get last submission error:', error);
        handleException(res, error);
      }
    }
  );

  router.get('/submission/:id', requireAuthenticatedUser, async (req, res) => {
    try {
      const { id } = req.params;
      if (isNaN(Number(id))) {
        return res.status(400).json({
          success: false,
          error: { message: 'Submission ID must be a number' },
        });
      }

      const includeCode = !parseBooleanQuery(req.query?.metadataOnly);
      const submission = await Submission.findByPk(id, {
        include: [
          {
            model: ChallengeParticipant,
            as: 'challengeParticipant',
            attributes: ['id', 'studentId', 'challengeId'],
            required: true,
          },
        ],
      });
      if (!submission) {
        return res.status(404).json({
          success: false,
          error: { message: `Submission with ID ${id} not found` },
        });
      }

      const canAccess = await canAccessSubmission({ req, submission });
      if (!canAccess) {
        return res.status(404).json({
          success: false,
          error: { message: `Submission with ID ${id} not found` },
        });
      }

      return res.json({
        success: true,
        data: {
          submission: serializeSubmissionPayload(submission, { includeCode }),
        },
      });
    } catch (error) {
      logger.error('Get submission error:', error);
      handleException(res, error);
    }
  });
};

export default registerSubmissionReadRoutes;
