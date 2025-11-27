import { DataTypes } from 'sequelize';
import sequelize from '#root/services/sequelize.mjs';

const Match = sequelize.define(
  'Match',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    challengeMatchSettingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'challenge_match_setting_id',
    },
    challengeParticipantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'challenge_participant_id',
    },
  },
  {
    tableName: 'match',
    schema: 'public',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        name: 'match_pkey',
        unique: true,
        fields: ['id'],
      },
      {
        // constraint: each participant can have only one match per challenge match setting
        name: 'uq_match_challenge_match_setting_participant',
        unique: true,
        fields: ['challengeMatchSettingId', 'challengeParticipantId'],
      },
      {
        // constraint: each participant can appear only once in the match table
        name: 'uq_match_challenge_participant_id',
        unique: true,
        fields: ['challengeParticipantId'],
      },
    ],
  }
);

Match.initializeRelations = (models) => {
  Match.belongsTo(models.ChallengeMatchSetting, {
    as: 'challengeMatchSetting',
    foreignKey: 'challengeMatchSettingId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  Match.belongsTo(models.ChallengeParticipant, {
    as: 'challengeParticipant',
    foreignKey: 'challengeParticipantId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
};

export default Match;
