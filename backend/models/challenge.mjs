import { DataTypes } from 'sequelize';
import sequelize from '#root/services/sequelize.mjs';
import getValidator from '#root/services/validator.mjs';
import { errorTypes } from '#root/services/error.mjs';

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
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    duration: {
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
    allowedNumberOfReview: {
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
        name: 'challenge_start_datetime_idx',
        fields: [{ name: 'start_datetime' }],
      },
    ],
  }
);

Challenge.initializeRelations = function (models) {
  Challenge.belongsToMany(models.MatchSetting, {
    through: 'ChallengeMatchSetting',
    as: 'matchSettings',
    foreignKey: 'challengeId',
    otherKey: 'matchSettingId',
  });
};

Challenge.getDefaultOrder = function () {
  return [
    ['start_datetime', 'DESC'],
    ['id', 'DESC'],
  ];
};

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

Challenge.createWithValidation = async function (payload, options = {}) {
  await validateChallengeData(payload, { validatorKey: 'challenge_create' });
  return Challenge.create(payload, options);
};

export default Challenge;
