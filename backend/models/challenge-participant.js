import sequelize from '#root/services/sequelize.js';
import { DataTypes } from 'sequelize';
//import ChallengeMatchSetting from '#root/models/challenge_match_setting.mjs';

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
  ChallengeParticipant.hasOne(models.Match, {
    as: 'match',
    foreignKey: 'challengeParticipantId',
  });
};

ChallengeParticipant.seed = async function () {
  try {
    const count = await ChallengeParticipant.count();
    if (count > 0) return;

    await ChallengeParticipant.bulkCreate([
      {
        challengeId: 1,
        studentId: 2,
      },
      {
        challengeId: 1,
        studentId: 3,
      },
      {
        challengeId: 1,
        studentId: 4,
      },
      {
        challengeId: 1,
        studentId: 5,
      },
      {
        challengeId: 1,
        studentId: 6,
      },
      {
        challengeId: 1,
        studentId: 7,
      },
      {
        challengeId: 1,
        studentId: 8,
      },
      {
        challengeId: 1,
        studentId: 9,
      },
      {
        challengeId: 1,
        studentId: 10,
      },
      {
        challengeId: 1,
        studentId: 11,
      },
    ]);

    console.log('ChallengeParticipant seeded successfully.');
  } catch (error) {
    console.error('ChallengeParticipant seeding failed:', error);
  }
};

export default ChallengeParticipant;
