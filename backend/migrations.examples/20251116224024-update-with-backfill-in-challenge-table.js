import { Sequelize } from 'sequelize';

export async function up({ context: queryInterface }) {
  try {
    /**
     * 1) Add new columns: start_date e start_time
     */
    await queryInterface.addColumn('challenge', 'start_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.addColumn('challenge', 'start_time', {
      type: Sequelize.TIME,
      allowNull: true,
    });

    /**
     * 2) Backfill: populate new columns from start_datetime
     */
    await queryInterface.sequelize.query(`
      UPDATE challenge
      SET
        start_date = start_datetime::date,
        start_time = start_datetime::time
      WHERE start_datetime IS NOT NULL
    `);

    /**
     * 3) Backfill on modified column: duration
     *   - set a default of 60 where duration is NULL or <= 0
     */
    await queryInterface.sequelize.query(`
      UPDATE challenge
      SET duration = 60
      WHERE duration IS NULL
         OR duration <= 0
    `);

    /**
     * 4) Backfill modified column: title
     *    - decrease length to 100 chars, truncate if longer
     */
    await queryInterface.sequelize.query(`
      UPDATE challenge
      SET title = LEFT(title, 100)
      WHERE LENGTH(title) > 100
    `);

    /**
     * 5) Change the definition of column duration (set default to 60)
     */
    await queryInterface.changeColumn('challenge', 'duration', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 60,
    });

    /**
     * 6) Change the definition of column title (set length to 100)
     */
    await queryInterface.changeColumn('challenge', 'title', {
      type: Sequelize.STRING(100),
      allowNull: false,
    });

    /**
     * 7) Remove the old column start_datetime
     */
    await queryInterface.removeColumn('challenge', 'start_datetime');
  } catch (e) {
    console.error('Error during challenge migration up:', e);
  }
}

export async function down({ context: queryInterface }) {
  try {
    /**
     * 1) Re-adding start_datetime column
     */
    await queryInterface.addColumn('challenge', 'start_datetime', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    /**
     * 2) Backfill: repopulate start_datetime from start_date and start_time
     */
    await queryInterface.sequelize.query(`
      UPDATE challenge
      SET start_datetime = start_date + start_time
      WHERE start_date IS NOT NULL
        AND start_time IS NOT NULL
    `);

    /**
     * 3) Re-storing the original definition of title
     *   (length to 255 chars)
     */
    await queryInterface.changeColumn('challenge', 'title', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });

    /**
     * 4) Reset the definition of duration (remove default value)
     * (set allowNull to true to match original state)
     */
    await queryInterface.changeColumn('challenge', 'duration', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });

    /**
     * 5) Remove start_date and start_time columns
     */
    await queryInterface.removeColumn('challenge', 'start_date');
    await queryInterface.removeColumn('challenge', 'start_time');
  } catch (e) {
    console.error('Error during challenge migration down:', e);
  }
}
