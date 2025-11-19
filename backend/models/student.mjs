import { DataTypes } from 'sequelize';
import sequelize from '#root/services/sequelize.mjs';

/**
 * Student model
 * Represents a student that can participate in one or multiple challenges.
 */
const Student = sequelize.define(
  'Student',
  {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    settings: {
      // JSON field for arbitrary per-student configuration.
      // We keep it empty by default.
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: 'student',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        name: 'student_pkey',
        unique: true,
        fields: [{ name: 'id' }],
      },
      {
        name: 'student_username_key',
        unique: true,
        fields: [{ name: 'username' }],
      },
    ],
  }
);

/**
 * Define all the associations for Student.
 * We assume Challenge and StudentChallenge models exist in the same folder.
 */
Student.initializeRelations = function (/*models*/) {
  // Many-to-many: one student can participate in many challenges,
  // and one challenge can have many students.
  // Student.belongsToMany(models.Challenge, {
  //   through: models.StudentChallenge, // join table (assumed to exist)
  //   as: 'challenges',
  //   foreignKey: 'studentId',
  //   otherKey: 'challengeId',
  // });
};

/**
 * Seed default students.
 * This will be called by seedModels() from init-models.mjs.
 */
Student.seed = async function () {
  const defaultStudents = [
    {
      username: 'alice',
      settings: {}, // empty settings
    },
    {
      username: 'bob',
      settings: {}, // empty settings
    },
    {
      username: 'charlie',
      settings: {}, // empty settings
    },
  ];

  // We use findOrCreate to avoid duplicate seeds if the migration runs more than once.
  for (const data of defaultStudents) {
    await Student.findOrCreate({
      where: { username: data.username },
      defaults: data,
    });
  }
};

export default Student;
