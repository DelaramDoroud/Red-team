import { Sequelize } from 'sequelize';

export async function up({ context: queryInterface }) {
  await queryInterface.createTable('challenge', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false,
      unique: true,
    },
    duration: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    startDatetime: {
      type: Sequelize.DATE,
      field: 'start_datetime',
      allowNull: false,
    },
    // New fields from model
    endDatetime: {
      type: Sequelize.DATE,
      field: 'end_datetime',
      allowNull: false,
    },
    peerReviewStartDate: {
      type: Sequelize.DATE,
      field: 'peer_review_start_date',
      allowNull: false,
    },
    peerReviewEndDate: {
      type: Sequelize.DATE,
      field: 'peer_review_end_date',
      allowNull: false,
    },
    allowedNumberOfReview: {
      type: Sequelize.INTEGER,
      field: 'allowed_number_of_review',
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: Sequelize.ENUM('public', 'private'),
      allowNull: false,
      defaultValue: 'private',
    },
    // Standard timestamps
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
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable('challenge');
}
