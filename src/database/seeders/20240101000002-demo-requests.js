'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Get users and loads
    const users = await queryInterface.sequelize.query(
      `SELECT id, user_type FROM users;`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const loads = await queryInterface.sequelize.query(
      `SELECT id, user_id, load_type FROM loads WHERE status = 'ACTIVE';`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const broker = users.find(user => user.user_type === 'BROKER');
    const rfpCarrier = users.find(user => user.user_type === 'RFP_CARRIER');
    const rfdCarrier = users.find(user => user.user_type === 'RFD_CARRIER');
    const now = new Date();

    // Create demo requests
    const demoRequests = [
      // RFP Carrier requests
      {
        load_id: loads[0].id,
        requester_id: rfpCarrier.id,
        owner_id: loads[0].user_id,
        status: 'PENDING',
        proposed_rate: 1850.00,
        message: 'Available for pickup as scheduled. Have experience with similar loads.',
        response_message: null,
        created_at: now,
        updated_at: now
      },
      {
        load_id: loads[1].id,
        requester_id: rfpCarrier.id,
        owner_id: loads[1].user_id,
        status: 'ACCEPTED',
        proposed_rate: 2100.00,
        message: 'Can pick up early if needed. Regular route for us.',
        response_message: 'Looks good! Assignment confirmed.',
        created_at: now,
        updated_at: now
      },
      {
        load_id: loads[2].id,
        requester_id: rfpCarrier.id,
        owner_id: loads[2].user_id,
        status: 'REJECTED',
        proposed_rate: 1950.00,
        message: 'Interested in this load. Have all required equipment.',
        response_message: 'Already assigned to another carrier.',
        created_at: now,
        updated_at: now
      },

      // RFD Carrier requests
      {
        load_id: loads[3].id,
        requester_id: rfdCarrier.id,
        owner_id: loads[3].user_id,
        status: 'PENDING',
        proposed_rate: 1750.00,
        message: 'Regular route for us. Can provide excellent service.',
        response_message: null,
        created_at: now,
        updated_at: now
      },
      {
        load_id: loads[4].id,
        requester_id: rfdCarrier.id,
        owner_id: loads[4].user_id,
        status: 'ACCEPTED',
        proposed_rate: 2200.00,
        message: 'Available immediately. All permits in place.',
        response_message: 'Rate and timing work well. Approved.',
        created_at: now,
        updated_at: now
      },
      {
        load_id: loads[5].id,
        requester_id: rfdCarrier.id,
        owner_id: loads[5].user_id,
        status: 'REJECTED',
        proposed_rate: 1650.00,
        message: 'Can handle this load with our specialized equipment.',
        response_message: 'Rate too high for this route.',
        created_at: now,
        updated_at: now
      }
    ];

    // Insert all requests
    return queryInterface.bulkInsert('requests', demoRequests);
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('requests', null, {});
  }
}; 