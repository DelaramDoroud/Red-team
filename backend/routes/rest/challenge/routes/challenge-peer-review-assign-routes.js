const registerChallengePeerReviewAssignRoutes = (router, deps) => {
  const { handleException, assignPeerReviews, requirePrivilegedUser } = deps;

  router.post(
    '/challenges/:challengeId/peer-reviews/assign',
    requirePrivilegedUser,
    async (req, res) => {
      try {
        const challengeId = Number(req.params.challengeId);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res
            .status(400)
            .json({ success: false, error: 'Invalid challengeId' });
        }

        const expectedReviews =
          req.body?.expectedReviewsPerSubmission ??
          req.body?.allowedNumberOfReview;

        const result = await assignPeerReviews({
          challengeId,
          expectedReviewsPerSubmission: expectedReviews,
        });

        if (result.status === 'invalid_expected_reviews') {
          return res.status(400).json({
            success: false,
            error:
              'Expected reviews per submission must be an integer greater than or equal to 2.',
          });
        }

        if (result.status === 'challenge_not_found') {
          return res
            .status(404)
            .json({ success: false, error: 'Challenge not found' });
        }

        if (result.status === 'invalid_status') {
          return res.status(409).json({
            success: false,
            error: 'Peer review can only be assigned after coding ends.',
            currentStatus: result.challengeStatus,
          });
        }

        if (result.status === 'finalization_pending') {
          return res.status(409).json({
            success: false,
            error:
              'Submissions are still being finalized. Try again in a moment.',
            inFlightSubmissionsCount: result.inFlightSubmissionsCount,
          });
        }

        if (result.status === 'no_matches') {
          return res.status(400).json({
            success: false,
            error: 'No matches assigned for this challenge.',
          });
        }

        if (result.status !== 'ok') {
          return res.status(500).json({
            success: false,
            error: 'Unable to assign peer reviews.',
          });
        }

        return res.json({ success: true, ...result });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
};

export default registerChallengePeerReviewAssignRoutes;
