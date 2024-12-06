module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      photo: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'URL or path to user profile photo'
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      company_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      user_type: {
        type: Sequelize.ENUM('BROKER', 'RFD_CARRIER', 'RFP_CARRIER'),
        allowNull: false
      },
      dot_number: {
        type: Sequelize.STRING(7),
        allowNull: true
      },
      contact_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: false
      },
      website: {
        type: Sequelize.STRING,
        allowNull: true
      },
      notifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: true
      },
      email_alerts: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: true
      },
      language: {
        type: Sequelize.STRING(2),
        defaultValue: 'en',
        allowNull: true
      },
      timezone: {
        type: Sequelize.STRING,
        defaultValue: 'UTC',
        allowNull: true
      },
      load_board_urls: {
        type: Sequelize.JSON,
        defaultValue: '[]',
        allowNull: true
      },
      alert_preferences: {
        type: Sequelize.JSON,
        defaultValue: '{"rfpAlerts":true,"openTruckAlerts":false}',
        allowNull: true
      },
      service_areas: {
        type: Sequelize.JSON,
        defaultValue: '[]',
        allowNull: true
      },
      route_alerts: {
        type: Sequelize.JSON,
        defaultValue: '[]',
        allowNull: false,
        comment: 'Array of {originZip: string, destinationZip: string}'
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'pending'),
        defaultValue: 'active'
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

    // Add indexes
    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['username']);
    await queryInterface.addIndex('users', ['user_type']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  }
}; 