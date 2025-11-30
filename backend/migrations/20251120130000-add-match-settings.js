import { DataTypes } from 'sequelize';
import { MatchSettingStatus } from '../models/enum/enums.js';

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    await queryInterface.createTable(
      'match_setting',
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        problem_title: {
          type: DataTypes.STRING(255),
          allowNull: false,
          unique: true,
        },
        problem_description: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        reference_solution: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        public_tests: {
          type: DataTypes.JSONB,
          allowNull: false,
        },
        private_tests: {
          type: DataTypes.JSONB,
          allowNull: false,
        },
        status: {
          type: DataTypes.ENUM(...Object.values(MatchSettingStatus)),
          allowNull: false,
          defaultValue: 'draft',
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: new Date(),
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: new Date(),
        },
      },
      { transaction }
    );

    await queryInterface.createTable(
      'challenge_match_setting',
      {
        challenge_id: {
          type: DataTypes.INTEGER,
          references: {
            model: 'challenge',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          primaryKey: true,
          allowNull: false,
        },
        match_setting_id: {
          type: DataTypes.INTEGER,
          references: {
            model: 'match_setting',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          primaryKey: true,
          allowNull: false,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: new Date(),
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: new Date(),
        },
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
    await queryInterface.dropTable('challenge_match_setting', { transaction });
    await queryInterface.dropTable('match_setting', { transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
