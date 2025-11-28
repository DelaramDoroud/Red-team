import { DataTypes } from 'sequelize';
import sequelize from '#root/services/sequelize.js';

const ChallengeMatchSetting = sequelize.define(
  'ChallengeMatchSetting',
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
    matchSettingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'match_setting_id',
    },
  },
  {
    tableName: 'challenge_match_setting',
    schema: 'public',
    underscored: true,
    timestamps: true, // use created_at / updated_at
    indexes: [
      {
        name: 'challenge_match_setting_pkey',
        unique: true,
        fields: ['id'],
      },
      {
        name: 'uq_challenge_match_setting_ids',
        unique: true,
        fields: ['challengeId', 'matchSettingId'],
      },
    ],
  }
);

ChallengeMatchSetting.initializeRelations = (models) => {
  ChallengeMatchSetting.belongsTo(models.Challenge, {
    as: 'challenge',
    foreignKey: 'challengeId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  ChallengeMatchSetting.belongsTo(models.MatchSetting, {
    as: 'matchSetting',
    foreignKey: 'matchSettingId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  // A challenge_match_setting has one match
  ChallengeMatchSetting.hasMany(models.Match, {
    as: 'match',
    foreignKey: 'challengeMatchSettingId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
};

ChallengeMatchSetting.seed = async function () {
  try {
    const count = await ChallengeMatchSetting.count();
    if (count > 0) return;

    await ChallengeMatchSetting.bulkCreate([
      {
        challengeId: 1,
        matchSettingId: 1,
      },
      {
        challengeId: 1,
        matchSettingId: 2,
      },
      {
        challengeId: 1,
        matchSettingId: 3,
      },
    ]);

    console.log('ChallengeMatchSetting seeded successfully.');
  } catch (error) {
    console.error('ChallengeMatchSetting seeding failed:', error);
  }
};

export default ChallengeMatchSetting;
