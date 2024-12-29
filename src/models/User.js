const { Model } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Load, {
        foreignKey: 'userId',
        as: 'loads'
      });
    }

    // Helper methods to check user type
    isBroker() {
      return this.userType === 'BROKER';
    }

    isRFDCarrier() {
      return this.userType === 'RFD_CARRIER';
    }

    isRFPCarrier() {
      return this.userType === 'RFP_CARRIER';
    }
  }

  User.init({
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'first_name'
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'last_name'
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'company_name'
    },
    userType: {
      type: DataTypes.ENUM('BROKER', 'RFD_CARRIER', 'RFP_CARRIER'),
      allowNull: false,
      field: 'user_type',
      validate: {
        isIn: [['BROKER', 'RFD_CARRIER', 'RFP_CARRIER']]
      }
    },
    dotNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'dot_number',
      validate: {
        len: {
          args: [7, 7],
          msg: "DOT Number must be exactly 7 digits"
        },
        isNumeric: {
          msg: "DOT Number must contain only numbers"
        },
        notEmpty: {
          msg: "DOT Number is required"
        }
      }
    },
    contactName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'contact_name'
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    loadBoardUrls: {
      type: DataTypes.JSON,
      defaultValue: [],
      field: 'load_board_urls',
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'pending'),
      defaultValue: 'active'
    },
    photo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    emailAlerts: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    language: {
      type: DataTypes.STRING(2),
      defaultValue: 'en',
      allowNull: false
    },
    timezone: {
      type: DataTypes.STRING,
      defaultValue: 'UTC',
      allowNull: false
    },
    alertPreferences: {
      type: DataTypes.JSONB,
      defaultValue: {
        rfpAlerts: true,
        openTruckAlerts: false
      },
      allowNull: false
    },
    serviceAreas: {
      type: DataTypes.JSONB,
      defaultValue: [],
      field: 'service_areas',
      allowNull: false
    },
    routeAlerts: {
      type: DataTypes.JSONB,
      defaultValue: [],
      field: 'route_alerts',
      allowNull: false
    },
    resetPasswordToken: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'reset_password_token'
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reset_password_expires'
    }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    timestamps: true,
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
      }
    }
  });

  // Instance method to check password
  User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
  };

  // Instance methods for checking permissions
  User.prototype.canPostRFDLoad = function() {
    return this.userType === 'BROKER';
  };

  User.prototype.canPostRFPLoad = function() {
    return this.userType === 'RFP_CARRIER';
  };

  User.prototype.canPostTruck = function() {
    return this.userType === 'RFD_CARRIER';
  };

  User.prototype.canViewRFDLoads = function() {
    return this.userType === 'RFP_CARRIER' || this.userType === 'RFD_CARRIER';
  };

  User.prototype.canViewRFPLoads = function() {
    return this.userType === 'RFD_CARRIER';
  };

  User.prototype.canViewTrucks = function() {
    return this.userType === 'RFP_CARRIER' || this.userType === 'BROKER';
  };

  return User;
}; 