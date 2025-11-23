import { Sequelize } from 'sequelize';

// TODO check if status column already exists to make this migration idempotent

export async function up({ context: queryInterface }) {
  await queryInterface.addColumn('challenge', 'status', {
    type: Sequelize.ENUM('draft', 'published'),
    allowNull: false,
    defaultValue: 'draft',
  });

  // Add index on status for faster queries
  await queryInterface.addIndex('challenge', ['status'], {
    name: 'challenge_status_idx',
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeIndex('challenge', 'challenge_status_idx');
  await queryInterface.removeColumn('challenge', 'status');

  // Drop the ENUM type (PostgreSQL specific)
  await queryInterface.sequelize.query(
    'DROP TYPE IF EXISTS "enum_challenge_status";'
  );
}
