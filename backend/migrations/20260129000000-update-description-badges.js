const TABLE_NAME = 'badges';

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    // Aggiorniamo le descrizioni dei challenge badges
    await queryInterface.bulkUpdate(
      TABLE_NAME,
      { description: 'Completed 3 challenges' },
      { name: 'Challenge Novice' },
      { transaction }
    );

    await queryInterface.bulkUpdate(
      TABLE_NAME,
      { description: 'Completed 5 challenges' },
      { name: 'Challenge Pro' },
      { transaction }
    );

    await queryInterface.bulkUpdate(
      TABLE_NAME,
      { description: 'Completed 10 challenges' },
      { name: 'Challenge Master' },
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    // Ripristiniamo le descrizioni originali in italiano
    await queryInterface.bulkUpdate(
      TABLE_NAME,
      { description: 'Completati 3 challenges' },
      { name: 'Challenge Novice' },
      { transaction }
    );

    await queryInterface.bulkUpdate(
      TABLE_NAME,
      { description: 'Completati 5 challenges' },
      { name: 'Challenge Pro' },
      { transaction }
    );

    await queryInterface.bulkUpdate(
      TABLE_NAME,
      { description: 'Completati 10 challenges' },
      { name: 'Challenge Master' },
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
