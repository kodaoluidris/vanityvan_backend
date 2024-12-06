module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('loads', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      assigned_to: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      load_type: {
        type: Sequelize.ENUM('RFP', 'RFD', 'TRUCK'),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'ASSIGNED', 'COMPLETED', 'CANCELLED'),
        defaultValue: 'ACTIVE'
      },
      pickup_location: {
        type: Sequelize.STRING,
        allowNull: false
      },
      pickup_zip: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      pickup_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      delivery_location: {
        type: Sequelize.STRING,
        allowNull: true
      },
      delivery_zip: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      delivery_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      weight: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      cubic_feet: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      rate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      equipment_type: {
        type: Sequelize.STRING,
        allowNull: true
      },
      details: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: '{}'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('loads', ['load_type']);
    await queryInterface.addIndex('loads', ['status']);
    await queryInterface.addIndex('loads', ['pickup_zip']);
    await queryInterface.addIndex('loads', ['delivery_zip']);
    await queryInterface.addIndex('loads', ['pickup_date']);
    await queryInterface.addIndex('loads', ['equipment_type']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('loads');
  }
}; 