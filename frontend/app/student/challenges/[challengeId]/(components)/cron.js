import cron from 'node-cron';
// import Challenge from '#root/models/challenge.js';
// import { Op } from 'sequelize';
// import { ChallengeStatus } from '#root/models/enum/enums.js';

cron.schedule('*/5 * * * * *', async () => {
  // try {
  //   console.log('Checking challenge statuses…');
  //   const [updatedCount] = await Challenge.update(
  //     { status: ChallengeStatus.ENDED },
  //     {
  //       where: {
  //         [Op.and]: [
  //           {
  //             status: ChallengeStatus.STARTED_PHASE_ONE
  //           },
  //           literal(`startPhaseOneDateTime + INTERVAL duration MINUTE <= NOW()`)
  //         ]
  //       }
  //     }
  //   );
  //   console.log(`Updated ${updatedCount} challenge(s) to ended`);
  // } catch (err) {
  //   console.error('Error auto-updating challenges:', err);
  // }
});
