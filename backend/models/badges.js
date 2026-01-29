import { DataTypes } from 'sequelize';
import sequelize from '#root/services/sequelize.js';

const Badge = sequelize.define(
  'Badge',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    metric: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    threshold: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    accuracyRequired: {
      type: DataTypes.DECIMAL(3, 2),
      field: 'accuracy_required',
      allowNull: true,
    },

    iconUrl: {
      type: DataTypes.STRING,
      field: 'icon_url',
      allowNull: true,
    },
  },
  {
    tableName: 'badges',
    schema: 'public',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        name: 'badges_pkey',
        unique: true,
        fields: ['id'],
      },
    ],
  }
);

Badge.initializeRelations = (models) => {
  Badge.hasMany(models.StudentBadge, {
    as: 'studentBadges',
    foreignKey: 'badgeId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
};

export default Badge;
