const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Request extends Model {}

Request.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  loadId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'load_id',
    references: {
      model: 'loads',
      key: 'id'
    }
  },
  requesterId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'requester_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'owner_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  message: {
    type: DataTypes.TEXT
  },
  proposedRate: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'proposed_rate'
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'REJECTED'),
    defaultValue: 'PENDING'
  },
  responseMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'response_message'
  }
}, {
  sequelize,
  modelName: 'Request',
  tableName: 'load_requests',
  timestamps: true,
  underscored: true
});

Request.associate = (models) => {
  Request.belongsTo(models.User, {
    foreignKey: 'requester_id',
    as: 'requester'
  });
  
  Request.belongsTo(models.User, {
    foreignKey: 'owner_id',
    as: 'owner'
  });
  
  Request.belongsTo(models.Load, {
    foreignKey: 'load_id',
    as: 'load'
  });
};

module.exports = Request; 