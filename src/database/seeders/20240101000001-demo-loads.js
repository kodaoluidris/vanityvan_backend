'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Get all seeded users
    const users = await queryInterface.sequelize.query(
      `SELECT id, user_type FROM users;`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const broker = users.find(user => user.user_type === 'BROKER');
    const rfdCarrier = users.find(user => user.user_type === 'RFD_CARRIER');
    const rfpCarrier = users.find(user => user.user_type === 'RFP_CARRIER');

    const now = new Date();

    // Broker Loads (RFP type)
    const brokerLoads = [
      {
        user_id: broker.id,
        load_type: 'RFP',
        status: 'ACTIVE',
        pickup_location: 'Chicago, IL',
        pickup_zip: '60601',
        pickup_date: new Date('2024-03-01'),
        delivery_location: 'New York, NY',
        delivery_zip: '10001',
        delivery_date: new Date('2024-03-03'),
        weight: 40000,
        cubic_feet: 2800,
        rate: 2500,
        equipment_type: 'Dry Van',
        details: JSON.stringify({
          commodityType: 'General Freight',
          specialInstructions: 'Dock delivery'
        }),
        created_at: now,
        updated_at: now
      },
      {
        user_id: broker.id,
        load_type: 'RFP',
        status: 'ACTIVE',
        pickup_location: 'Los Angeles, CA',
        pickup_zip: '90001',
        pickup_date: new Date('2024-03-02'),
        delivery_location: 'Phoenix, AZ',
        delivery_zip: '85001',
        delivery_date: new Date('2024-03-04'),
        weight: 35000,
        cubic_feet: 2500,
        rate: 1800,
        equipment_type: 'Reefer',
        details: JSON.stringify({
          commodityType: 'Produce',
          temperature: '34F'
        }),
        created_at: now,
        updated_at: now
      },
      {
        user_id: broker.id,
        load_type: 'RFP',
        status: 'ACTIVE',
        pickup_location: 'Miami, FL',
        pickup_zip: '33101',
        pickup_date: new Date('2024-03-03'),
        delivery_location: 'Atlanta, GA',
        delivery_zip: '30301',
        delivery_date: new Date('2024-03-04'),
        weight: 28000,
        cubic_feet: 2000,
        rate: 1500,
        equipment_type: 'Flatbed',
        details: JSON.stringify({
          commodityType: 'Construction Materials',
          specialInstructions: 'Tarps required'
        }),
        created_at: now,
        updated_at: now
      },
      {
        user_id: broker.id,
        load_type: 'RFP',
        status: 'ACTIVE',
        pickup_location: 'Seattle, WA',
        pickup_zip: '98101',
        pickup_date: new Date('2024-03-04'),
        delivery_location: 'Portland, OR',
        delivery_zip: '97201',
        delivery_date: new Date('2024-03-05'),
        weight: 42000,
        cubic_feet: 3000,
        rate: 1200,
        equipment_type: 'Step Deck',
        details: JSON.stringify({
          commodityType: 'Machinery',
          specialInstructions: 'Oversized load'
        }),
        created_at: now,
        updated_at: now
      },
      {
        user_id: broker.id,
        load_type: 'RFP',
        status: 'ACTIVE',
        pickup_location: 'Dallas, TX',
        pickup_zip: '75201',
        pickup_date: new Date('2024-03-05'),
        delivery_location: 'Houston, TX',
        delivery_zip: '77001',
        delivery_date: new Date('2024-03-06'),
        weight: 38000,
        cubic_feet: 2800,
        rate: 900,
        equipment_type: 'Van',
        details: JSON.stringify({
          commodityType: 'Retail Goods',
          specialInstructions: 'Liftgate required'
        }),
        created_at: now,
        updated_at: now
      }
    ];

    // In your loads seeder, update some loads to be assigned
    const assignedLoad = {
      ...brokerLoads[0],  // Copy the first broker load
      assigned_to: rfpCarrier.id,  // Assign it to the RFP carrier
      assigned_at: now,  // Set assignment time
      status: 'ASSIGNED'  // Update status
    };

    // Update the brokerLoads array
    brokerLoads[0] = assignedLoad;

    // RFD Carrier Loads
    const rfdCarrierLoads = [
      {
        user_id: rfdCarrier.id,
        load_type: 'RFD',
        status: 'ACTIVE',
        pickup_location: 'Denver, CO',
        pickup_zip: '80201',
        pickup_date: new Date('2024-03-01'),
        delivery_location: 'Salt Lake City, UT',
        delivery_zip: '84101',
        delivery_date: new Date('2024-03-02'),
        weight: 32000,
        cubic_feet: 2400,
        rate: 1600,
        equipment_type: 'Dry Van',
        details: JSON.stringify({
          truckNumber: 'T123',
          driverName: 'John Smith'
        }),
        created_at: now,
        updated_at: now
      },
      // ... 4 more RFD loads with different routes
      {
        user_id: rfdCarrier.id,
        load_type: 'RFD',
        status: 'ACTIVE',
        pickup_location: 'San Francisco, CA',
        pickup_zip: '94101',
        pickup_date: new Date('2024-03-02'),
        delivery_location: 'Las Vegas, NV',
        delivery_zip: '89101',
        delivery_date: new Date('2024-03-03'),
        weight: 29000,
        cubic_feet: 2200,
        rate: 1900,
        equipment_type: 'Reefer',
        details: JSON.stringify({
          truckNumber: 'T124',
          driverName: 'Mike Johnson'
        }),
        created_at: now,
        updated_at: now
      },
      {
        user_id: rfdCarrier.id,
        load_type: 'RFD',
        status: 'ACTIVE',
        pickup_location: 'Boston, MA',
        pickup_zip: '02101',
        pickup_date: new Date('2024-03-03'),
        delivery_location: 'Philadelphia, PA',
        delivery_zip: '19101',
        delivery_date: new Date('2024-03-04'),
        weight: 36000,
        cubic_feet: 2600,
        rate: 1400,
        equipment_type: 'Flatbed',
        details: JSON.stringify({
          truckNumber: 'T125',
          driverName: 'Sarah Wilson'
        }),
        created_at: now,
        updated_at: now
      },
      {
        user_id: rfdCarrier.id,
        load_type: 'RFD',
        status: 'ACTIVE',
        pickup_location: 'Minneapolis, MN',
        pickup_zip: '55401',
        pickup_date: new Date('2024-03-04'),
        delivery_location: 'Chicago, IL',
        delivery_zip: '60601',
        delivery_date: new Date('2024-03-05'),
        weight: 41000,
        cubic_feet: 3000,
        rate: 1100,
        equipment_type: 'Van',
        details: JSON.stringify({
          truckNumber: 'T126',
          driverName: 'Bob Miller'
        }),
        created_at: now,
        updated_at: now
      },
      {
        user_id: rfdCarrier.id,
        load_type: 'RFD',
        status: 'ACTIVE',
        pickup_location: 'Detroit, MI',
        pickup_zip: '48201',
        pickup_date: new Date('2024-03-05'),
        delivery_location: 'Cleveland, OH',
        delivery_zip: '44101',
        delivery_date: new Date('2024-03-06'),
        weight: 33000,
        cubic_feet: 2500,
        rate: 800,
        equipment_type: 'Step Deck',
        details: JSON.stringify({
          truckNumber: 'T127',
          driverName: 'Tom Davis'
        }),
        created_at: now,
        updated_at: now
      }
    ];

    // RFP Carrier Loads
    const rfpCarrierLoads = [
      {
        user_id: rfpCarrier.id,
        load_type: 'RFP',
        status: 'ACTIVE',
        pickup_location: 'Nashville, TN',
        pickup_zip: '37201',
        pickup_date: new Date('2024-03-01'),
        delivery_location: 'Louisville, KY',
        delivery_zip: '40201',
        delivery_date: new Date('2024-03-02'),
        weight: 37000,
        cubic_feet: 2800,
        rate: 1300,
        equipment_type: 'Van',
        details: JSON.stringify({
          commodityType: 'Auto Parts',
          specialInstructions: 'Inside delivery'
        }),
        created_at: now,
        updated_at: now
      },
      // ... 4 more RFP loads with different routes
      {
        user_id: rfpCarrier.id,
        load_type: 'RFP',
        status: 'ACTIVE',
        pickup_location: 'Kansas City, MO',
        pickup_zip: '64101',
        pickup_date: new Date('2024-03-02'),
        delivery_location: 'St. Louis, MO',
        delivery_zip: '63101',
        delivery_date: new Date('2024-03-03'),
        weight: 34000,
        cubic_feet: 2500,
        rate: 950,
        equipment_type: 'Reefer',
        details: JSON.stringify({
          commodityType: 'Frozen Foods',
          temperature: '0F'
        }),
        created_at: now,
        updated_at: now
      },
      {
        user_id: rfpCarrier.id,
        load_type: 'RFP',
        status: 'ACTIVE',
        pickup_location: 'New Orleans, LA',
        pickup_zip: '70112',
        pickup_date: new Date('2024-03-03'),
        delivery_location: 'Memphis, TN',
        delivery_zip: '38101',
        delivery_date: new Date('2024-03-04'),
        weight: 39000,
        cubic_feet: 3000,
        rate: 1700,
        equipment_type: 'Flatbed',
        details: JSON.stringify({
          commodityType: 'Steel',
          specialInstructions: 'Chains required'
        }),
        created_at: now,
        updated_at: now
      },
      {
        user_id: rfpCarrier.id,
        load_type: 'RFP',
        status: 'ACTIVE',
        pickup_location: 'Indianapolis, IN',
        pickup_zip: '46201',
        pickup_date: new Date('2024-03-04'),
        delivery_location: 'Columbus, OH',
        delivery_zip: '43201',
        delivery_date: new Date('2024-03-05'),
        weight: 31000,
        cubic_feet: 2200,
        rate: 850,
        equipment_type: 'Van',
        details: JSON.stringify({
          commodityType: 'Electronics',
          specialInstructions: 'No touch freight'
        }),
        created_at: now,
        updated_at: now
      },
      {
        user_id: rfpCarrier.id,
        load_type: 'RFP',
        status: 'ACTIVE',
        pickup_location: 'Oklahoma City, OK',
        pickup_zip: '73101',
        pickup_date: new Date('2024-03-05'),
        delivery_location: 'Tulsa, OK',
        delivery_zip: '74101',
        delivery_date: new Date('2024-03-06'),
        weight: 35000,
        cubic_feet: 2800,
        rate: 600,
        equipment_type: 'Step Deck',
        details: JSON.stringify({
          commodityType: 'Construction Equipment',
          specialInstructions: 'Forklift required at delivery'
        }),
        created_at: now,
        updated_at: now
      }
    ];

    // Combine all loads
    const allLoads = [...brokerLoads, ...rfdCarrierLoads, ...rfpCarrierLoads];

    // Insert all loads
    return queryInterface.bulkInsert('loads', allLoads);
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('loads', null, {});
  }
}; 