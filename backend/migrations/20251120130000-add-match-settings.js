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
        references: {
          model: 'match_setting',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        primaryKey: true,
      },
    }, { transaction });
    
    // 3. Add start_time and end_time columns to challenge
    await queryInterface.addColumn('challenge', 'start_time', {
         type: DataTypes.DATE,
         allowNull: true, // Allow null initially or default
    }, { transaction });
    
    await queryInterface.addColumn('challenge', 'end_time', {
         type: DataTypes.DATE,
         allowNull: true,
    }, { transaction });

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
    await queryInterface.removeColumn('challenge', 'start_time', { transaction });
    await queryInterface.removeColumn('challenge', 'end_time', { transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
