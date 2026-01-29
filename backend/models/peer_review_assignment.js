import { Model, DataTypes } from 'sequelize';
import sequelize from '#root/services/sequelize.js';

class PeerReviewAssignment extends Model {}

PeerReviewAssignment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    submissionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    reviewerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    isExtra: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    feedbackTests: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'feedback_tests',
    },
  },
  {
    sequelize,
    modelName: 'PeerReviewAssignment',
    tableName: 'peer_review_assignment',
    schema: 'public',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'uq_peer_review_assignment_submission_reviewer',
        unique: true,
        fields: ['submissionId', 'reviewerId'],
      },
      {
        name: 'peer_review_assignment_submission_id_idx',
        fields: ['submissionId'],
      },
      {
        name: 'peer_review_assignment_reviewer_id_idx',
        fields: ['reviewerId'],
      },
    ],
  }
);

PeerReviewAssignment.initializeRelations = (models) => {
  PeerReviewAssignment.belongsTo(models.Submission, {
    as: 'submission',
    foreignKey: 'submissionId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  PeerReviewAssignment.belongsTo(models.ChallengeParticipant, {
    as: 'reviewer',
    foreignKey: 'reviewerId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  PeerReviewAssignment.hasOne(models.PeerReviewVote, {
    as: 'vote',
    foreignKey: 'peerReviewAssignmentId',
  });
};

export default PeerReviewAssignment;
