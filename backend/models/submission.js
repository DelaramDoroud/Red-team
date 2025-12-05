import { DataTypes } from 'sequelize';
import sequelize from '#root/services/sequelize.js';
import { SubmissionStatus } from './enum/enums.js';

const MatchSubmission = sequelize.define(
  'MatchSubmission',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    matchId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'match_id',
    },

    challengeParticipantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'challenge_participant_id',
    },

    solution: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // wrong / improvable / probably_correct
    status: {
      type: DataTypes.ENUM(...Object.values(SubmissionStatus)),
      allowNull: false,
    },

    isAutoSubmission: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_auto_submission',
    },
  },
  {
    tableName: 'match_submission',
    schema: 'public',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        name: 'idx_match_submission_match_id',
        fields: ['matchId'],
      },
      {
        name: 'idx_match_submission_challenge_participant_id',
        fields: ['challengeParticipantId'],
      },
    ],
  }
);

MatchSubmission.initializeRelations = (models) => {
  MatchSubmission.belongsTo(models.Match, {
    as: 'match',
    foreignKey: 'matchId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  MatchSubmission.belongsTo(models.ChallengeParticipant, {
    as: 'challengeParticipant',
    foreignKey: 'challengeParticipantId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
};

export default MatchSubmission;
