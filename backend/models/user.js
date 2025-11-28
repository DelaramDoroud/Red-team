import { DataTypes } from 'sequelize';
import bcrypt from 'bcrypt';
import sequelize from '#root/services/sequelize.js';

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'teacher', 'student'),
      allowNull: false,
      defaultValue: 'student',
    },
    settings: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: 'users', // Plural is common for user tables to avoid conflict with 'user' reserved keyword in postgres
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['username'],
      },
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);
User.initializeRelations = function (models) {
  User.hasMany(models.ChallengeParticipant, {
    as: 'challengeJoins',
    foreignKey: 'studentId',
  });

  User.belongsToMany(models.Challenge, {
    through: models.ChallengeParticipant,
    as: 'joinedChallenges',
    foreignKey: 'studentId',
    otherKey: 'challengeId',
  });
};
User.seed = async function () {
  try {
    const count = await User.count();
    if (count > 0) return;

    await User.bulkCreate([
      {
        username: 'teacher1',
        password: 'password123',
        role: 'teacher',
        settings: { theme: 'light' },
      },
      {
        username: 'student1',
        password: 'password123',
        role: 'student',
        settings: { theme: 'dark' },
      },
      {
        username: 'student2',
        password: 'password123',
        role: 'student',
        settings: { theme: 'light' },
      },
      {
        username: 'student3',
        password: 'password123',
        role: 'student',
        settings: { theme: 'light' },
      },
    ]);

    console.log('Users seeded successfully.');
  } catch (error) {
    console.error('User seeding failed:', error);
  }
};

export default User;
