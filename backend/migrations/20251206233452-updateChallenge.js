import { DataTypes } from 'sequelize';

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.addColumn(
      'challenge',
      'startCodingPhaseDateTime',
      { type: DataTypes.DATE, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      'challenge',
      'endCodingPhaseDateTime',
      { type: DataTypes.DATE, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      'challenge',
      'startPeerReviewDateTime',
      { type: DataTypes.DATE, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      'challenge',
      'endPeerReviewDateTime',
      { type: DataTypes.DATE, allowNull: true },
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.removeColumn('challenge', 'startCodingPhaseDateTime', {
      transaction,
    });
    await queryInterface.removeColumn('challenge', 'endCodingPhaseDateTime', {
      transaction,
    });
    await queryInterface.removeColumn('challenge', 'startPeerReviewDateTime', {
      transaction,
    });
    await queryInterface.removeColumn('challenge', 'endPeerReviewDateTime', {
      transaction,
    });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
