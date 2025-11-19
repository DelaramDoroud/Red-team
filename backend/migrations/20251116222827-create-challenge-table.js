import { Sequelize } from 'sequelize';

export async function up({ context: queryInterface }) {
  await queryInterface.createTable('challenge', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    duration: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    startDatetime: {
      type: Sequelize.DATE,
      field: 'start_datetime',
      allowNull: false,
    },
    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: new Date(),
    },
    updatedAt: {
      type: Sequelize.DATE,
      field: 'updated_at',
      allowNull: false,
      defaultValue: new Date(),
    },
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable('challenge');
}
