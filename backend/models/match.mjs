import sequelize from '#root/services/sequelize.mjs';
import { DataTypes } from 'sequelize';

const Match = sequelize.define(
  'Match',
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
    tableName: 'match',
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

Match.initializeRelations = (models) => {
  Match.belongsTo(models.Challenge, {
    foreignKey: 'challengeId',
  });

  Match.belongsTo(models.User, {
    as: 'student',
    foreignKey: 'studentId',
  });
};

export default Match;
