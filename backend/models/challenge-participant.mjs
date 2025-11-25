import sequelize from '#root/services/sequelize.mjs';
import { DataTypes } from 'sequelize';

const ChallengeParticipant = sequelize.define(
  'ChallengeParticipant',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    challengeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'challenge_id',
    },
    studentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'student_id',
    },
  },
  {
    tableName: 'challenge_participant',
    schema: 'public',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['challengeId', 'studentId'],
      },
    ],
  }
);

ChallengeParticipant.initializeRelations = (models) => {
  ChallengeParticipant.belongsTo(models.Challenge, {
    foreignKey: 'challengeId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  ChallengeParticipant.belongsTo(models.User, {
    as: 'student',
    foreignKey: 'studentId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
};

export default ChallengeParticipant;
