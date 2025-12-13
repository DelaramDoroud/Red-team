import { DataTypes } from 'sequelize';

const TABLE = 'match_submission';

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.createTable(
      TABLE,
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },

        match_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'match',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },

        challenge_participant_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'challenge_participant',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },

        solution: {
          type: DataTypes.TEXT,
          allowNull: false,
        },

        status: {
          type: DataTypes.ENUM('wrong', 'improvable', 'probably_correct'),
          allowNull: false,
        },

        is_auto_submission: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      { transaction }
    );

    await queryInterface.addIndex(TABLE, ['match_id'], {
      name: 'idx_match_submission_match_id',
      transaction,
    });

    await queryInterface.addIndex(TABLE, ['challenge_participant_id'], {
      name: 'idx_match_submission_challenge_participant_id',
      transaction,
    });

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.dropTable(TABLE, { transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
