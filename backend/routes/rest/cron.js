import cron from 'node-cron';
import Challenge from '#root/models/challenge.js';
import { Op, literal } from 'sequelize';
import { ChallengeStatus } from '#root/models/enum/enums.js';

cron.schedule('*/5 * * * * *', async () => {
  try {
    console.log('Checking challenge statuses…');

    const [updatedCount] = await Challenge.update(
      {
        status: ChallengeStatus.ENDED_PHASE_ONE,
        endPhaseOneDateTime: literal('NOW()'),
      },
      {
        where: {
          status: ChallengeStatus.STARTED_PHASE_ONE,
          [Op.and]: literal(
            `"startPhaseOneDateTime" + ("duration" * INTERVAL '1 minute') <= NOW()`
          ),
        },
      }
    );

    console.log(`Updated ${updatedCount} challenge(s) to ENDED_PHASE_ONE`);
  } catch (err) {
    console.error('Error auto-updating challenges:', err);
  }
});
