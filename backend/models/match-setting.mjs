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

MatchSetting.initializeRelations = function (models) {
  // Many-to-Many: This setting can belong to many challenges
  MatchSetting.belongsToMany(models.Challenge, {
    through: 'ChallengeMatchSetting', // Same junction table name as in Challenge model
    as: 'challenges',
    foreignKey: 'matchSettingId',
    otherKey: 'challengeId',
  });
};

MatchSetting.seed = async function () {
  const count = await MatchSetting.count();
  if (count > 0) return;

  await MatchSetting.bulkCreate([
    {
      problemTitle: 'Two Sum',
      problemDescription: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      referenceSolution: `
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}
      `,
      publicTests: [
        { input: [[2, 7, 11, 15], 9], output: [0, 1] },
        { input: [[3, 2, 4], 6], output: [1, 2] }
      ],
      privateTests: [
        { input: [[3, 3], 6], output: [0, 1] }
      ],
      status: 'ready',
    },
    {
      problemTitle: 'Palindrome Number',
      problemDescription: 'Given an integer x, return true if x is a palindrome, and false otherwise.',
      referenceSolution: `
function isPalindrome(x) {
  if (x < 0) return false;
  const s = String(x);
  return s === s.split('').reverse().join('');
}
      `,
      publicTests: [
        { input: [121], output: true },
        { input: [-121], output: false }
      ],
      privateTests: [
        { input: [10], output: false }
      ],
      status: 'ready',
    },
  ]);
  console.log('MatchSettings seeded successfully.');
};

export default MatchSetting;
