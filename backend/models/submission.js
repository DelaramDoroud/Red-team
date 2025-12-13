import { Model, DataTypes } from 'sequelize';
import sequelize from '#root/services/sequelize.js';

class Submission extends Model {}

Submission.init(
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
    code: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    submissions_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Submission',
    tableName: 'submission',
    timestamps: true,
    underscored: true,
  }
);

export default Submission;
