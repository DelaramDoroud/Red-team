import sequelize from '#root/services/sequelize.js';
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
  ChallengeParticipant.hasOne(models.Match, {
    as: 'match',
    foreignKey: 'challengeParticipantId',
  });
  ChallengeParticipant.hasMany(models.MatchSubmission, {
    as: 'submissions',
    foreignKey: 'challengeParticipantId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
};

ChallengeParticipant.seed = async function () {
  try {
    const count = await ChallengeParticipant.count();
    if (count > 0) return;

    const { default: Challenge } = await import('./challenge.js');
    const { default: User } = await import('./user.js');

    const challenge = await Challenge.findOne({ order: [['id', 'ASC']] });
    const students = await User.findAll({
      where: { role: 'student' },
      order: [['id', 'ASC']],
      limit: 10,
    });

    if (!challenge || students.length === 0) {
      console.warn(
        'ChallengeParticipant seeding skipped: missing challenge or students'
      );
      return;
    }

    const rows = students.map((student) => ({
      challengeId: challenge.id,
      studentId: student.id,
    }));

    await ChallengeParticipant.bulkCreate(rows);

    console.log('ChallengeParticipant seeded successfully.');
  } catch (error) {
    console.error('ChallengeParticipant seeding failed:', error);
  }
};

export default ChallengeParticipant;
