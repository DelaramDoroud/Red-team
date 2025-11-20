import { DataTypes } from 'sequelize';
import sequelize from '#root/services/sequelize.mjs';

const MatchSetting = sequelize.define(
  'MatchSetting',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    problemTitle: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    problemDescription: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    referenceSolution: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    publicTests: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    privateTests: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('draft', 'ready'),
      allowNull: false,
      defaultValue: 'draft',
    },
  },

  {
    tableName: 'match_setting',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: 'match_setting_pkey',
        unique: true,
        fields: [{ name: 'id' }],
      },
    ],
  }
  
);

MatchSetting.initializeRelations = (models) => {
  MatchSetting.belongsToMany(models.Challenge, {
    through: 'ChallengeMatchSetting',
    as: 'challenges',
    foreignKey: 'matchSettingId',
    otherKey: 'challengeId',
  });
};

export default MatchSetting;
