'use strict';

module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    content: {
      type: DataTypes.JSON
    },
    referenceId: {
      type: DataTypes.INTEGER,
      field: 'reference_id'
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_read'
    }
  }, {
    tableName: 'notifications',
    timestamps: true,
    underscored: true
  });

  return Notification;
}; 