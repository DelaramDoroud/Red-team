export const errorTypes = {
  ValidationError: 'ValidationError',
  SequelizeUniqueConstraintError: 'SequelizeUniqueConstraintError',
  NotExistsError: 'NotExistsError',
  NotFoundError: 'NotFoundError',
  NotFoundResearchItemError: 'NotFoundResearchItemError',
  NotFoundResearchEntityError: 'NotFoundResearchEntityError',
  VerificationError: 'VerificationError',
  VerificationMissingAffiliationError: 'VerificationMissingAffiliationError',
  VerificationMissingAuthorPositionError:
    'VerificationMissingAuthorPositionError',
  VerificationMissingAuthorInPositionError:
    'VerificationMissingAuthorInPositionError',
  VerificationAlreadyVerifiedError: 'VerificationAlreadyVerifiedError',
  VerificationIsDuplicateError: 'VerificationIsDuplicateError',
  VerificationNotDraftCreatorError: 'VerificationNotDraftCreatorError',
  UnverificationError: 'UnverificationError',
  UnverificationAlreadyVerifiedError: 'UnverificationAlreadyVerifiedError',
};

export const inputErrors = [
  errorTypes.ValidationError,
  errorTypes.SequelizeUniqueConstraintError,
  errorTypes.NotExistsError,
];

export const verificationErrors = [
  errorTypes.NotFoundResearchItemError,
  errorTypes.NotFoundResearchEntityError,
  errorTypes.VerificationError,
  errorTypes.VerificationMissingAffiliationError,
  errorTypes.VerificationMissingAuthorPositionError,
  errorTypes.VerificationIsDuplicateError,
  errorTypes.VerificationAlreadyVerifiedError,
  errorTypes.VerificationNotDraftCreatorError,
  errorTypes.VerificationMissingAuthorInPositionError,
];

export const unverificationErrors = [
  errorTypes.ValidationError,
  errorTypes.UnverificationError,
  errorTypes.UnverificationAlreadyVerifiedError,
];

export function handleException(res, error, errorsGroup = [], code = 400) {
  if (errorsGroup.includes(error.type)) {
    res.status(code).json({ success: false, error });
  } else {
    res.status(500).json({ success: false, error });
  }
}
