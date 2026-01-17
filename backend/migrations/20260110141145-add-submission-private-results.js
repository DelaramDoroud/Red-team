import { DataTypes } from 'sequelize';

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    await queryInterface.addColumn(
      'submission',
      'private_test_results',
      {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      { transaction }
    );
    await queryInterface.addColumn(
      'submission',
      'private_summary',
      {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      { transaction }
    );
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    await queryInterface.removeColumn('submission', 'private_test_results', {
      transaction,
    });
    await queryInterface.removeColumn('submission', 'private_summary', {
      transaction,
    });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
