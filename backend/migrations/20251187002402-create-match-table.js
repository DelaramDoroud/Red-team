import { Sequelize } from 'sequelize';

export async function up({ context: queryInterface }) {
  await queryInterface.createTable('match', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },

    challengeId: {
      type: Sequelize.INTEGER,
      field: 'challenge_id',
      allowNull: false,
      references: {
        model: 'challenge',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },

    studentId: {
      type: Sequelize.INTEGER,
      field: 'student_id',
      allowNull: false,

      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },

    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: new Date(),
    },

    updatedAt: {
      type: Sequelize.DATE,
      field: 'updated_at',
      allowNull: false,
      defaultValue: new Date(),
    },
  });

  await queryInterface.addConstraint('match', {
    fields: ['challenge_id', 'student_id'],
    type: 'unique',
    name: 'match_challenge_student_unique',
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable('match');
}
