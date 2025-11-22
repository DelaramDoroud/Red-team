import { DataTypes } from 'sequelize';

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    // 1. Create 'match_setting' table
    await queryInterface.createTable('match_setting', {
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
        type: DataTypes.ENUM('draft', 'ready'),
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
    }, { transaction });

    // 2. Create Junction Table 'ChallengeMatchSetting'
    await queryInterface.createTable('ChallengeMatchSetting', {
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
      challengeId: {
        type: DataTypes.INTEGER,
        field: 'challenge_id',
        references: {
          model: 'challenge',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        primaryKey: true,
      },
      matchSettingId: {
        type: DataTypes.INTEGER,
        field: 'match_setting_id',
        references: {
          model: 'match_setting',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        primaryKey: true,
      },
    }, { transaction });
    
    // Note: We do NOT add columns to 'challenge' here anymore, 
    // because you updated the initial create-challenge migration file to include them.
    
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    await queryInterface.dropTable('ChallengeMatchSetting', { transaction });
    await queryInterface.dropTable('match_setting', { transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
