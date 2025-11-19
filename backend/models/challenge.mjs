import { DataTypes } from 'sequelize';
import sequelize from '#root/services/sequelize.mjs';
import getValidator from '#root/services/validator.mjs';
import { errorTypes } from '#root/services/error.mjs';

/**
 * Validate challenge payload using shared JSON Schema validators.
 * You can customize the validator key (e.g. "challenge_create", "challenge_update").
 */
export async function validateChallengeData(
  data,
  { validatorKey = 'challenge' } = {}
) {
  const validate = getValidator(validatorKey);

  if (!validate) {
    throw new Error(`Validator not found for key: ${validatorKey}`);
  }

  const isValid = validate(data);

  if (!isValid) {
    const details =
      validate.errors?.map((e) => `${e.instancePath} ${e.message}`) || [];
    const error = new Error('Challenge validation error');
    error.name = errorTypes?.VALIDATION_ERROR || 'validationError';
    error.status = 400;
    error.details = details;
    throw error;
  }
}

/**
 * Challenge model
 * Represents a coding challenge that can contain one or more matches.
 */
const Challenge = sequelize.define(
  'Challenge',
  {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255), // or STRING(100) if you aligned the migration
      allowNull: false,
    },
    duration: {
      // Duration in minutes
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    startDatetime: {
      type: DataTypes.DATE,
      field: 'start_datetime',
      allowNull: false,
    },
  },
  {
    tableName: 'challenge',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: 'challenge_pkey',
        unique: true,
        fields: [{ name: 'id' }],
      },
      {
        // Example index if you query a lot by start date/time
        name: 'challenge_start_datetime_idx',
        fields: [{ name: 'start_datetime' }],
      },
    ],
  }
);

/**
 * Define all the associations for Challenge.
 * We "pretend" related models (MatchSetting, User, Match, ChallengeParticipant) exist.
 */
Challenge.initializeRelations = function (/*models*/) {
  // One challenge can have many match settings (configurations for different match modes)
  // Challenge.hasMany(models.MatchSetting, {
  //   as: 'matchSettings',
  //   foreignKey: 'challengeId',
  // });
  // One challenge can have many matches (individual games/rounds played under this challenge)
  // Challenge.hasMany(models.Match, {
  //   as: 'matches',
  //   foreignKey: 'challengeId',
  // });
  // A challenge is usually created by a specific user
  // Challenge.belongsTo(models.Teacher, {
  //   as: 'creator',
  //   foreignKey: 'creatorUserId',
  // });
  // Many users can participate in many challenges through a join table
  // Challenge.belongsToMany(models.Student, {
  //   through: models.ChallengeParticipant,
  //   as: 'participants',
  //   foreignKey: 'challengeId',
  //   otherKey: 'userId',
  // });
  //
  // // Example: one challenge might be linked to a "default" match setting
  // Challenge.belongsTo(models.MatchSetting, {
  //   as: 'defaultMatchSetting',
  //   foreignKey: 'defaultMatchSettingId',
  // });
};

/**
 * Default ordering for queries on Challenge.
 */
Challenge.getDefaultOrder = function () {
  return [
    ['start_datetime', 'DESC'],
    ['id', 'DESC'],
  ];
};

/**
 * Default includes commonly used when loading challenges.
 */
Challenge.getDefaultIncludes = function () {
  return [
    {
      association: 'creator',
    },
    {
      association: 'matchSettings',
    },
    {
      association: 'matches',
    },
    {
      association: 'participants',
    },
  ];
};

/**
 * Create a challenge with validation.
 * You can use this convenience method from your services instead of Challenge.create.
 */
Challenge.createWithValidation = async function (payload, options = {}) {
  await validateChallengeData(payload, { validatorKey: 'challenge_create' });
  return Challenge.create(payload, options);
};

export default Challenge;
