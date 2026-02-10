import { DataTypes } from 'sequelize';

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const challengeDefinition = await queryInterface.describeTable('challenge');
    const hasCodingPhaseFinalizationColumn =
      challengeDefinition.coding_phase_finalization_completed_at != null;

    if (!hasCodingPhaseFinalizationColumn) {
      await queryInterface.addColumn(
        'challenge',
        'coding_phase_finalization_completed_at',
        {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
        },
        { transaction }
      );
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const challengeDefinition = await queryInterface.describeTable('challenge');
    const hasCodingPhaseFinalizationColumn =
      challengeDefinition.coding_phase_finalization_completed_at != null;

    if (hasCodingPhaseFinalizationColumn) {
      await queryInterface.removeColumn(
        'challenge',
        'coding_phase_finalization_completed_at',
        { transaction }
      );
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
