const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Load extends Model {
    static associate(models) {
      Load.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });

      Load.hasMany(models.Request, {
        foreignKey: 'loadId',
        as: 'requests'
      });
    }

    // Helper methods for type checking
    isRFP() {
      return this.loadType === 'RFP';
    }

    isRFD() {
      return this.loadType === 'RFD';
    }

    isTruck() {
      return this.loadType === 'TRUCK';
    }
  }

  Load.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id'
    },
    loadType: {
      type: DataTypes.ENUM('RFP', 'RFD', 'TRUCK'),
      allowNull: false,
      field: 'load_type'
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'ASSIGNED', 'COMPLETED', 'CANCELLED'),
      defaultValue: 'ACTIVE'
    },
    pickupLocation: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'pickup_location'
    },
    pickupZip: {
      type: DataTypes.STRING(10),
      allowNull: false,
      field: 'pickup_zip'
    },
    pickupDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'pickup_date'
    },
    deliveryLocation: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'delivery_location'
    },
    deliveryZip: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'delivery_zip'
    },
    deliveryDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'delivery_date'
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    cubicFeet: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'cubic_feet'
    },
    rate: DataTypes.DECIMAL(10, 2),
    equipmentType: {
      type: DataTypes.STRING,
      field: 'equipment_type'
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    assignedTo: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'assigned_to',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'assigned_at'
    },
    mobilePhone: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'assigned_to',
      validate: {
        is: /^\+?[\d\s-()]+$/
      }
    }
  }, {
    sequelize,
    modelName: 'Load',
    tableName: 'loads',
    underscored: true,
    timestamps: true,
    
    // Add hooks for validation
    hooks: {
      beforeValidate: (load) => {
        // Validate based on load type
        if (load.loadType === 'TRUCK') {
          if (!load.details.dimensions) {
            throw new Error('Truck dimensions are required');
          }
        }
        
        if (load.loadType !== 'TRUCK' && !load.deliveryLocation) {
          throw new Error('Delivery location is required for RFP and RFD loads');
        }
      }
    }
  });

  return Load;
}; 