import { DataTypes } from 'sequelize';
import sequelize from '#root/services/sequelize.js';

const Submission = sequelize.define(
  'Submission',
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
    code: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: 'submission',
    schema: 'public',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        name: 'submission_pkey',
        unique: true,
        fields: ['id'],
      },
      {
        name: 'submission_match_id_idx',
        fields: ['matchId'],
      },
    ],
  }
);

Submission.initializeRelations = (models) => {
  Submission.belongsTo(models.Match, {
    as: 'match',
    foreignKey: 'matchId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
};

export default Submission;
