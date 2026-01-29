import { DataTypes } from 'sequelize';

const TABLE_NAME = 'badges';

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.createTable(
      TABLE_NAME,
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },

        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        type: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        description: {
          type: DataTypes.TEXT,
          allowNull: false,
        },

        metric: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        threshold: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },

        accuracyRequired: {
          type: DataTypes.DECIMAL(3, 2),
          field: 'accuracy_required',
          allowNull: true,
        },

        iconUrl: {
          type: DataTypes.STRING,
          field: 'icon_url',
          allowNull: true,
        },

        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
          field: 'created_at',
        },

        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
          field: 'updated_at',
        },
      },
      { transaction }
    );
    const now = new Date();
    await queryInterface.bulkInsert(
      TABLE_NAME,
      [
        // Challenge milestone
        {
          name: 'Challenge Novice',
          type: 'milestone',
          description: 'Completati 3 challenges',
          metric: 'completed_challenges',
          threshold: 3,
          created_at: now,
          updated_at: now,
        },
        {
          name: 'Challenge Pro',
          type: 'milestone',
          description: 'Completati 5 challenges',
          metric: 'completed_challenges',
          threshold: 5,
          created_at: now,
          updated_at: now,
        },
        {
          name: 'Challenge Master',
          type: 'milestone',
          description: 'Completati 10 challenges',
          metric: 'completed_challenges',
          threshold: 10,
          created_at: now,
          updated_at: now,
        },

        // Review milestone
        {
          name: 'Milestone Reviewer 3',
          type: 'milestone',
          description: 'Reviewed 3 submissions',
          metric: 'reviews_done',
          threshold: 3,
          created_at: now,
          updated_at: now,
        },
        {
          name: 'Milestone Reviewer 5',
          type: 'milestone',
          description: 'Reviewed 5 submissions',
          metric: 'reviews_done',
          threshold: 5,
          created_at: now,
          updated_at: now,
        },

        // Review quality
        {
          name: 'Reviewer Rookie',
          type: 'quality',
          description: '5+ correct reviews (80% accuracy)',
          metric: 'correct_reviews',
          threshold: 5,
          accuracy_required: 0.8,
          created_at: now,
          updated_at: now,
        },
        {
          name: 'Code Detective',
          type: 'quality',
          description: '10+ correctly identified errors',
          metric: 'correct_reviews',
          threshold: 10,
          created_at: now,
          updated_at: now,
        },
        {
          name: 'Review Master',
          type: 'quality',
          description: '25+ reviews with 90% accuracy',
          metric: 'correct_reviews',
          threshold: 25,
          accuracy_required: 0.9,
          created_at: now,
          updated_at: now,
        },
      ],
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
    await queryInterface.dropTable(TABLE_NAME, { transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
