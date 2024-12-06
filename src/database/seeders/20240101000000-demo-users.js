'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('12345678', 10);
    const now = new Date();

    return queryInterface.bulkInsert('users', [
      {
        username: 'demo_broker',
        email: 'broker@example.com',
        password: hashedPassword,
        photo: null,
        first_name: 'John',
        last_name: 'Doe',
        company_name: 'Demo Broker LLC',
        user_type: 'BROKER',
        dot_number: null,
        contact_name: 'John Doe',
        phone: '123-456-7890',
        website: 'www.demobroker.com',
        status: 'active',
        // Optional settings fields
        notifications: true,
        email_alerts: true,
        language: 'en',
        timezone: 'UTC',
        load_board_urls: JSON.stringify([]),
        alert_preferences: JSON.stringify({
          rfpAlerts: true,
          openTruckAlerts: false
        }),
        service_areas: JSON.stringify([]),
        route_alerts: JSON.stringify([]),
        created_at: now,
        updated_at: now
      },
      {
        username: 'demo_carrier_rfp',
        email: 'rfp_carrier@example.com',
        password: hashedPassword,
        photo: null,
        first_name: 'Jane',
        last_name: 'Smith',
        company_name: 'Demo RFP Carrier Inc',
        user_type: 'RFP_CARRIER',
        dot_number: '1234567',
        contact_name: 'Jane Smith',
        phone: '098-765-4321',
        website: 'www.demorfpcarrier.com',
        status: 'active',
        // Optional settings fields
        notifications: true,
        email_alerts: true,
        language: 'en',
        timezone: 'UTC',
        load_board_urls: JSON.stringify([]),
        alert_preferences: JSON.stringify({
          rfpAlerts: true,
          openTruckAlerts: false
        }),
        service_areas: JSON.stringify([]),
        route_alerts: JSON.stringify([]),
        created_at: now,
        updated_at: now
      },
      {
        username: 'demo_carrier_rfd',
        email: 'rfd_carrier@example.com',
        password: hashedPassword,
        photo: null,
        first_name: 'Bob',
        last_name: 'Johnson',
        company_name: 'Demo RFD Carrier Inc',
        user_type: 'RFD_CARRIER',
        dot_number: '7654321',
        contact_name: 'Bob Johnson',
        phone: '555-123-4567',
        website: 'www.demorfdcarrier.com',
        status: 'active',
        // Optional settings fields
        notifications: true,
        email_alerts: true,
        language: 'en',
        timezone: 'UTC',
        load_board_urls: JSON.stringify([]),
        alert_preferences: JSON.stringify({
          rfpAlerts: true,
          openTruckAlerts: false
        }),
        service_areas: JSON.stringify([]),
        route_alerts: JSON.stringify([]),
        created_at: now,
        updated_at: now
      },
      {
        username: 'demo_super_admin',
        email: 'superadmin@example.com',
        password: hashedPassword,
        photo: null,
        first_name: 'John',
        last_name: 'Doe',
        company_name: 'Demo Super Admin LLC',
        user_type: 'SUPER_ADMIN',
        dot_number: null,
        contact_name: 'Super Admin',
        phone: '123-456-7890',
        website: 'www.demosuperadmin.com',
        status: 'active',
        // Optional settings fields
        notifications: true,
        email_alerts: true,
        language: 'en',
        timezone: 'UTC',
        load_board_urls: JSON.stringify([]),
        alert_preferences: JSON.stringify({
          rfpAlerts: true,
          openTruckAlerts: false
        }),
        service_areas: JSON.stringify([]),
        route_alerts: JSON.stringify([]),
        created_at: now,
        updated_at: now
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('users', null, {});
  }
}; 