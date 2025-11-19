export default {
  name: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    host: process.env.DB_HOST,
    port: 5432,
    dialect: 'postgres',
    freezeTableName: true,
    logging: process.env.SQL_LOGGING === 'true',
    define: {
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    pool: {
      max: 15,
    },
  },
};
