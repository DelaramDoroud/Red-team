const LEGACY_COLUMNS = {
  startCodingPhaseDateTime: ['start', 'Phase', 'OneDateTime'].join(''),
  endCodingPhaseDateTime: ['end', 'Phase', 'OneDateTime'].join(''),
  startPeerReviewDateTime: ['start', 'Phase', 'TwoDateTime'].join(''),
  endPeerReviewDateTime: ['end', 'Phase', 'TwoDateTime'].join(''),
  codingPhaseFinalizationCompletedAt: [
    'phase',
    'one',
    'finalization',
    'completed',
    'at',
  ].join('_'),
};

const NEW_COLUMNS = {
  startCodingPhaseDateTime: 'startCodingPhaseDateTime',
  endCodingPhaseDateTime: 'endCodingPhaseDateTime',
  startPeerReviewDateTime: 'startPeerReviewDateTime',
  endPeerReviewDateTime: 'endPeerReviewDateTime',
  codingPhaseFinalizationCompletedAt: 'coding_phase_finalization_completed_at',
};

const LEGACY_STATUS = {
  startedClassic: 'started',
  endedClassic: 'ended',
  startedCodingPhase: ['started', 'phase', 'one'].join('_'),
  endedCodingPhase: ['ended', 'phase', 'one'].join('_'),
  startedPeerReview: ['started', 'phase', 'two'].join('_'),
  endedPeerReview: ['ended', 'phase', 'two'].join('_'),
};

const NEW_STATUS = {
  startedCodingPhase: ['started', 'coding', 'phase'].join('_'),
  endedCodingPhase: ['ended', 'coding', 'phase'].join('_'),
  startedPeerReview: ['started', 'peer', 'review'].join('_'),
  endedPeerReview: ['ended', 'peer', 'review'].join('_'),
};

const ENUM_TYPE_NAME = ['enum', 'challenge', 'status'].join('_');

const escapeLiteral = (value) => value.replaceAll("'", "''");

const renameEnumValueIfNeeded = async (queryInterface, fromValue, toValue) => {
  const fromLiteral = escapeLiteral(fromValue);
  const toLiteral = escapeLiteral(toValue);
  const typeLiteral = escapeLiteral(ENUM_TYPE_NAME);

  await queryInterface.sequelize.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = '${typeLiteral}'
          AND e.enumlabel = '${fromLiteral}'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = '${typeLiteral}'
          AND e.enumlabel = '${toLiteral}'
      ) THEN
        ALTER TYPE "${ENUM_TYPE_NAME}"
        RENAME VALUE '${fromLiteral}' TO '${toLiteral}';
      END IF;
    END
    $$;
  `);
};

const addEnumValueIfMissing = async (queryInterface, value) => {
  const valueLiteral = escapeLiteral(value);
  await queryInterface.sequelize.query(`
    ALTER TYPE "${ENUM_TYPE_NAME}" ADD VALUE IF NOT EXISTS '${valueLiteral}';
  `);
};

const renameColumnIfNeeded = async (
  queryInterface,
  transaction,
  tableSchema,
  fromColumn,
  toColumn
) => {
  if (!tableSchema[fromColumn] || tableSchema[toColumn]) return;
  await queryInterface.renameColumn('challenge', fromColumn, toColumn, {
    transaction,
  });
};

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const tableSchema = await queryInterface.describeTable('challenge', {
      transaction,
    });

    await renameColumnIfNeeded(
      queryInterface,
      transaction,
      tableSchema,
      LEGACY_COLUMNS.startCodingPhaseDateTime,
      NEW_COLUMNS.startCodingPhaseDateTime
    );
    await renameColumnIfNeeded(
      queryInterface,
      transaction,
      tableSchema,
      LEGACY_COLUMNS.endCodingPhaseDateTime,
      NEW_COLUMNS.endCodingPhaseDateTime
    );
    await renameColumnIfNeeded(
      queryInterface,
      transaction,
      tableSchema,
      LEGACY_COLUMNS.startPeerReviewDateTime,
      NEW_COLUMNS.startPeerReviewDateTime
    );
    await renameColumnIfNeeded(
      queryInterface,
      transaction,
      tableSchema,
      LEGACY_COLUMNS.endPeerReviewDateTime,
      NEW_COLUMNS.endPeerReviewDateTime
    );
    await renameColumnIfNeeded(
      queryInterface,
      transaction,
      tableSchema,
      LEGACY_COLUMNS.codingPhaseFinalizationCompletedAt,
      NEW_COLUMNS.codingPhaseFinalizationCompletedAt
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  await renameEnumValueIfNeeded(
    queryInterface,
    LEGACY_STATUS.startedClassic,
    NEW_STATUS.startedCodingPhase
  );
  await renameEnumValueIfNeeded(
    queryInterface,
    LEGACY_STATUS.endedClassic,
    NEW_STATUS.endedCodingPhase
  );
  await renameEnumValueIfNeeded(
    queryInterface,
    LEGACY_STATUS.startedCodingPhase,
    NEW_STATUS.startedCodingPhase
  );
  await renameEnumValueIfNeeded(
    queryInterface,
    LEGACY_STATUS.endedCodingPhase,
    NEW_STATUS.endedCodingPhase
  );
  await renameEnumValueIfNeeded(
    queryInterface,
    LEGACY_STATUS.startedPeerReview,
    NEW_STATUS.startedPeerReview
  );
  await renameEnumValueIfNeeded(
    queryInterface,
    LEGACY_STATUS.endedPeerReview,
    NEW_STATUS.endedPeerReview
  );

  await addEnumValueIfMissing(queryInterface, NEW_STATUS.startedCodingPhase);
  await addEnumValueIfMissing(queryInterface, NEW_STATUS.endedCodingPhase);
  await addEnumValueIfMissing(queryInterface, NEW_STATUS.startedPeerReview);
  await addEnumValueIfMissing(queryInterface, NEW_STATUS.endedPeerReview);
}

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const tableSchema = await queryInterface.describeTable('challenge', {
      transaction,
    });

    await renameColumnIfNeeded(
      queryInterface,
      transaction,
      tableSchema,
      NEW_COLUMNS.startCodingPhaseDateTime,
      LEGACY_COLUMNS.startCodingPhaseDateTime
    );
    await renameColumnIfNeeded(
      queryInterface,
      transaction,
      tableSchema,
      NEW_COLUMNS.endCodingPhaseDateTime,
      LEGACY_COLUMNS.endCodingPhaseDateTime
    );
    await renameColumnIfNeeded(
      queryInterface,
      transaction,
      tableSchema,
      NEW_COLUMNS.startPeerReviewDateTime,
      LEGACY_COLUMNS.startPeerReviewDateTime
    );
    await renameColumnIfNeeded(
      queryInterface,
      transaction,
      tableSchema,
      NEW_COLUMNS.endPeerReviewDateTime,
      LEGACY_COLUMNS.endPeerReviewDateTime
    );
    await renameColumnIfNeeded(
      queryInterface,
      transaction,
      tableSchema,
      NEW_COLUMNS.codingPhaseFinalizationCompletedAt,
      LEGACY_COLUMNS.codingPhaseFinalizationCompletedAt
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  await renameEnumValueIfNeeded(
    queryInterface,
    NEW_STATUS.startedCodingPhase,
    LEGACY_STATUS.startedCodingPhase
  );
  await renameEnumValueIfNeeded(
    queryInterface,
    NEW_STATUS.endedCodingPhase,
    LEGACY_STATUS.endedCodingPhase
  );
  await renameEnumValueIfNeeded(
    queryInterface,
    NEW_STATUS.startedPeerReview,
    LEGACY_STATUS.startedPeerReview
  );
  await renameEnumValueIfNeeded(
    queryInterface,
    NEW_STATUS.endedPeerReview,
    LEGACY_STATUS.endedPeerReview
  );
}
