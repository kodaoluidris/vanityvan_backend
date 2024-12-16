const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class LoadRequest extends Model {
    static associate(models) {
      LoadRequest.belongsTo(models.User, {
        foreignKey: 'requesterId',
        as: 'requester'
      });

      LoadRequest.belongsTo(models.User, {
        foreignKey: 'ownerId',
        as: 'owner'
      });

      LoadRequest.belongsTo(models.Load, {
        foreignKey: 'loadId',
        as: 'load'
      });
    }
  }

  LoadRequest.init({
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
    modelName: 'LoadRequest',
    tableName: 'load_requests',
    timestamps: true,
    underscored: true,
    freezeTableName: true
  });

  return LoadRequest;
}; 