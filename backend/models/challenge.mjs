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
    endDatetime: {
      type: DataTypes.DATE,
      field: 'end_datetime',
      allowNull: false,
    },
    peerReviewStartDate: {
      type: DataTypes.DATE,
      field: 'peer_review_start_date',
      allowNull: false,
    },
    peerReviewEndDate: {
      type: DataTypes.DATE,
      field: 'peer_review_end_date',
      allowNull: false,
    },
    numberOfPeers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('public', 'private'),
      allowNull: false,
      defaultValue: 'private',
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
Challenge.initializeRelations = function (models) {
  // This creates the Many-to-Many link.
  // It allows:
  // 1. Challenge A -> [Setting 1, Setting 2]
  // 2. Challenge B -> [Setting 2, Setting 3]
  Challenge.belongsToMany(models.MatchSetting, {
    through: 'ChallengeMatchSetting', // The junction table
    as: 'matchSettings', // Accessor: challenge.matchSettings
    foreignKey: 'challengeId',
    otherKey: 'matchSettingId',
  });
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
