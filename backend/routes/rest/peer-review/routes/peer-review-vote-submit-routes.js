const registerPeerReviewVoteSubmitRoutes = (router, deps) => {
  const { handleException, logger, submitVoteService } = deps;

  router.post('/peer-reviews/:assignmentId/vote', async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const { vote, testCaseInput, expectedOutput } = req.body;

      const userId = req.user?.id || req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      await submitVoteService.submitVote(userId, assignmentId, {
        vote,
        testCaseInput,
        expectedOutput,
      });

      logger.info(`User ${userId} voted ${vote} on assignment ${assignmentId}`);

      return res.json({ success: true });
    } catch (error) {
      if (error.code === 'INVALID_INPUT') {
        return res
          .status(400)
          .json({ success: false, error: { message: error.message } });
      }
      if (error.code === 'INVALID_TEST_CASE') {
        return res
          .status(400)
          .json({ success: false, error: { message: error.message } });
      }
      if (error.code === 'NOT_FOUND') {
        return res
          .status(404)
          .json({ success: false, error: { message: error.message } });
      }
      if (error.code === 'FORBIDDEN') {
        return res
          .status(403)
          .json({ success: false, error: { message: error.message } });
      }

      logger.error('Submit peer review vote error:', error);
      handleException(res, error);
    }
  });
};

export default registerPeerReviewVoteSubmitRoutes;
