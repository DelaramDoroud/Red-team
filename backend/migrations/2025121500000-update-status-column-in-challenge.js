export async function up({ context: queryInterface }) {
  await queryInterface.sequelize.query(`
    ALTER TYPE "enum_challenge_status" REMOVE VALUE IF EXISTS 'started';
    ALTER TYPE "enum_challenge_status" REMOVE VALUE IF EXISTS 'ended';
    ALTER TYPE "enum_challenge_status" ADD VALUE IF NOT EXISTS 'started_phase_one';
    ALTER TYPE "enum_challenge_status" ADD VALUE IF NOT EXISTS 'ended_phase_one';
    ALTER TYPE "enum_challenge_status" ADD VALUE IF NOT EXISTS 'started_phase_two';
    ALTER TYPE "enum_challenge_status" ADD VALUE IF NOT EXISTS 'ended_phase_two';
  `);
}

export async function down() {
  // Note: Sequelize/Postgres does not support removing enum values easily.
}
