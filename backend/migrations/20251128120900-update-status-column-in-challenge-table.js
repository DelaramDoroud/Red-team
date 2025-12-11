export async function up({ context: queryInterface }) {
  await queryInterface.sequelize.query(`
    ALTER TYPE "enum_challenge_status" ADD VALUE IF NOT EXISTS 'public';
    ALTER TYPE "enum_challenge_status" ADD VALUE IF NOT EXISTS 'private';
    ALTER TYPE "enum_challenge_status" ADD VALUE IF NOT EXISTS 'assigned';
    ALTER TYPE "enum_challenge_status" ADD VALUE IF NOT EXISTS 'started_phase_one';
    ALTER TYPE "enum_challenge_status" ADD VALUE IF NOT EXISTS 'ended_phase_one';
    ALTER TYPE "enum_challenge_status" ADD VALUE IF NOT EXISTS 'started_phase_two';
    ALTER TYPE "enum_challenge_status" ADD VALUE IF NOT EXISTS 'ended_phase_two';
  `);
}

export async function down() {
  // Note: Sequelize does not support removing enum values directly.
}
