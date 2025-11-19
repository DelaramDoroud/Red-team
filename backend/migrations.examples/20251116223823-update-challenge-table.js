import { Sequelize } from 'sequelize';

export async function up({ context: queryInterface }) {
  try {
    // 1) I'm adding the new columns start_date and start_time
    await queryInterface.addColumn('challenge', 'start_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.addColumn('challenge', 'start_time', {
      type: Sequelize.TIME,
      allowNull: true,
    });

    // 2) I'm populating the new columns from start_datetime
    await queryInterface.sequelize.query(`
      UPDATE challenge
      SET
        start_date = start_datetime::date,
        start_time = start_datetime::time
      WHERE start_datetime IS NOT NULL
    `);

    // 3) Remove the old column start_datetime
    await queryInterface.removeColumn('challenge', 'start_datetime');

    // 4) Change the definition of duration to have a default value of 60
    await queryInterface.changeColumn('challenge', 'duration', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 60,
    });
  } catch (e) {
    console.error('Error during challenge migration up:', e);
  }
}

export async function down({ context: queryInterface }) {
  try {
    // 1) Re-adding start_datetime column
    await queryInterface.addColumn('challenge', 'start_datetime', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // 2) Populating start_datetime from start_date and start_time
    await queryInterface.sequelize.query(`
      UPDATE challenge
      SET start_datetime = start_date + start_time
      WHERE start_date IS NOT NULL
        AND start_time IS NOT NULL
    `);

    // 3) Removing start_date and start_time columns
    await queryInterface.removeColumn('challenge', 'start_date');
    await queryInterface.removeColumn('challenge', 'start_time');

    // 4) Removing default value from duration column
    await queryInterface.changeColumn('challenge', 'duration', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  } catch (e) {
    console.error('Error during challenge migration down:', e);
  }
}
