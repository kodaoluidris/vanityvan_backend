const loadService = require('../services/loadService');
const { Load, User, LoadRequest } = require('../models');
const { Op } = require('sequelize');
const NotificationService = require('../services/notificationService');
const csv = require('csv-parse');
const { getLocationByZip } = require('../utils/locationService');

// Export the controller methods directly
module.exports = {
    createLoad: async (req, res) => {
        try {
            const loadData = {
                ...req.body,
                userId: req.userData.userId
            };
            
            const load = await loadService.createLoad(loadData);
            
            res.status(201).json({
                status: 'success',
                data: {
                    id: load.id,
                    jobNumber: load.job_number ?? `${load.loadType}-${load.id}`,
                    type: load.loadType,
                    status: load.status,
                    pickup: {
                        location: load.pickupLocation,
                        date: load.pickupDate
                    },
                    delivery: {
                        location: load.deliveryLocation,
                        date: load.deliveryDate
                    },
                    balance: load.balance,
                    rate: load.rate,
                    equipmentType: load.equipmentType,
                    details: load.details,
                    mobilePhone: load.mobile_phone,
                    createdAt: load.createdAt
                }
            });
        } catch (error) {
            console.error('Create load error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error creating load',
                error: error.message
            });
        }
    },

    getAllLoads: async (req, res) => {
        try {
            const loads = await loadService.getAllLoads();
            res.json(loads);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getLoadById: async (req, res) => {
        try {
            const load = await loadService.getLoadById(req.params.id);
            if (!load) {
                return res.status(404).json({ message: 'Load not found' });
            }
            res.json(load);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    updateLoad: async (req, res) => {
        try {
            const load = await loadService.updateLoad(req.params.id, req.body);
            if (!load) {
                return res.status(404).json({ message: 'Load not found' });
            }
            res.json(load);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    deleteLoad: async (req, res) => {
        try {
            const success = await loadService.deleteLoad(req.params.id);
            if (!success) {
                return res.status(404).json({ message: 'Load not found' });
            }
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    searchLoads: async (req, res) => {
        try {
            let {
                loadType,
                startDate,
                endDate,
                equipmentType,
                location,
                radius,
                status = 'ACTIVE'
            } = req.query;

            // Base query conditions
            const whereConditions = {
                status: status
            };

            // Handle load type filter
            if (loadType) {
                const loadTypes = Array.isArray(loadType) 
                    ? loadType 
                    : loadType.split(',').map(type => type.trim());

                whereConditions.load_type = {
                    [Op.in]: loadTypes
                };
            }

            // Add date range filter if specified
            if (startDate || endDate) {
                whereConditions.pickup_date = {};
                if (startDate) {
                    whereConditions.pickup_date[Op.gte] = new Date(startDate);
                }
                if (endDate) {
                    whereConditions.pickup_date[Op.lte] = new Date(endDate);
                }
            }

            // Add equipment type filter if specified
            if (equipmentType) {
                whereConditions.equipment_type = equipmentType;
            }

            // Add location filter if specified
            if (location) {
                whereConditions[Op.or] = [
                    { pickup_zip: location },
                    { delivery_zip: location },
                    { pickup_location: { [Op.like]: `%${location}%` } },
                    { delivery_location: { [Op.like]: `%${location}%` } }
                ];
            }

            // Fetch loads with user information
            const loads = await Load.findAll({
                where: whereConditions,
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'company_name', 'contact_name', 'phone', 'email']
                }],
                order: [['created_at', 'DESC']],
                attributes: [
                    'id',
                    'job_number',
                    'load_type',
                    'status',
                    'pickup_location',
                    'pickup_zip',
                    'pickup_date',
                    'delivery_location',
                    'delivery_zip',
                    'delivery_date',
                    'balance',
                    'rate',
                    'cubic_feet',
                    'equipment_type',
                    'details',
                    'mobile_phone',
                    'created_at'
                ],
                distinct: true,
                group: ['Load.id', 'user.id'],
                subQuery: false
            });

            // Add some debug logging
            // console.log('Query conditions:', whereConditions);
            // console.log('Raw SQL:', loads.length);

            // Format the response
            const formattedLoads = loads.map(load => {
                const loadData = load.get({ plain: true });
                
                // Ensure we're not getting duplicate data
                // console.log('Processing load ID:', loadData.id);
                
                // Format based on load type
                switch (loadData.load_type) {  // Make sure this matches your database column name
                    case 'RFP':
                        return {
                            id: loadData.id,
                            jobNumber: loadData.job_number ?? `RFP-${loadData.id}`,
                            type: 'RFP',
                            originZip: loadData.pickup_zip,
                            originLocation: loadData.pickup_location,
                            destinationZip: loadData.delivery_zip,
                            destinationLocation: loadData.delivery_location,
                            pickupDate: loadData.pickup_date,
                            deliveryDate: loadData.delivery_date,
                            balance: loadData.balance,
                            cubicFeet: loadData.cubic_feet,
                            rate: loadData.rate,
                            equipmentType: loadData.equipment_type,
                            details: loadData.details,
                            mobilePhone: loadData.mobile_phone,
                            contact: {
                                company: loadData.user.companyName,
                                name:  loadData.user.contactName,
                                phone: loadData.mobile_phone ?? loadData.user.phone,
                                email: loadData.user.email
                            }
                        };

                    case 'RFD':
                        return {
                            id: loadData.id,
                            jobNumber: loadData.job_number ?? `RFD-${loadData.id}`,
                            type: 'RFD',
                            originZip: loadData.pickup_zip,
                            originLocation: loadData.pickup_location,
                            destinationZip: loadData.delivery_zip,
                            destinationLocation: loadData.delivery_location,
                            pickupDate: loadData.pickup_date,
                            deliveryDate: loadData.delivery_date,
                            balance: loadData.balance,
                            cubicFeet: loadData.cubic_feet,
                            rate: loadData.rate,
                            equipmentType: loadData.equipment_type,
                            details: loadData.details,
                            mobilePhone: loadData.mobile_phone,
                            contact: {
                                company: loadData.user.companyName,
                                name: loadData.user.contactName,
                                phone: loadData.mobile_phone ?? loadData.user.phone,
                                email: loadData.user.email
                            }
                        };

                    case 'TRUCK':
                        return {
                            id: loadData.id,
                            jobNumber: loadData.job_number ?? `TRUCK-${loadData.id}`,
                            type: 'TRUCK',
                            location: loadData.pickup_location,
                            locationZip: loadData.pickup_zip,
                            availableDate: loadData.pickup_date,
                            cubicFeet: loadData.cubic_feet,
                            equipmentType: loadData.equipment_type,
                            balance: loadData.balance,
                            ratePerMile: loadData.rate,
                            details: loadData.details,
                            mobilePhone: loadData.mobile_phone,
                            contact: {
                                company: loadData.user.companyName,
                                name: loadData.user.contactName,
                                phone: loadData.mobile_phone ?? loadData.user.phone,
                                email: loadData.user.email
                            }
                        };
                }
            });

            // Final check for duplicates
            const uniqueLoads = Array.from(new Set(formattedLoads.map(load => load.id)))
                .map(id => formattedLoads.find(load => load.id === id));

            res.json({
                status: 'success',
                data: uniqueLoads
            });

        } catch (error) {
            console.error('Search loads error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error searching loads',
                error: error.message
            });
        }
    },

    viewLoads: async (req, res) => {
        try {
            const {
                origin,
                destination,
                pickupDate,
                deliveryDate,
                status,
                type
            } = req.query;

            const whereConditions = {};

            // If not super admin, only show user's own loads
            if (req.userData.userType !== 'SUPER_ADMIN') {
                whereConditions.user_id = req.userData.userId;
            }

            // Add filters if provided
            if (origin) {
                whereConditions.pickup_location = { [Op.like]: `%${origin}%` };
            }

            if (destination) {
                whereConditions.delivery_location = { [Op.like]: `%${destination}%` };
            }

            if (pickupDate) {
                whereConditions.pickup_date = new Date(pickupDate);
            }

            if (deliveryDate) {
                whereConditions.delivery_date = new Date(deliveryDate);
            }

            if (status) {
                whereConditions.status = status;
            }else{
                whereConditions.status = 'ACTIVE';
            }

            if (type) {
                whereConditions.load_type = type;
            }


            const loads = await Load.findAll({
                where: whereConditions,
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'companyName', 'contactName', 'phone', 'email', 'userType']
                }],
                order: [['created_at', 'DESC']],
                attributes: [
                    'id',
                    'job_number',
                    'load_type',
                    'status',
                    'pickup_location',
                    'pickup_zip',
                    'pickup_date',
                    'delivery_location',
                    'delivery_zip',
                    'delivery_date',
                    'balance',
                    'cubic_feet',
                    'rate',
                    'equipment_type',
                    'details',
                    'mobile_phone',
                    'created_at'
                ]
            });

            // Format the response
            const formattedLoads = loads.map(load => {
                const loadData = load.get({ plain: true });
                const baseData = {
                    id: loadData.id,
                    jobNumber: loadData.job_number ?? `${loadData.load_type}-${loadData.id}`,
                    type: loadData.load_type,
                    cubicFeet: loadData.cubic_feet,
                    mobilePhone: loadData.mobile_phone,
                    status: loadData.status,
                    createdAt: loadData.created_at,
                    contact: {
                        company: loadData.user.companyName,
                        name: loadData.user.contactName,
                        phone: loadData.mobile_phone ?? loadData.user.phone,
                        email: loadData.user.email,
                        userType: loadData.user.userType
                    }
                };

                switch (loadData.load_type) {
                    case 'RFP':
                    case 'RFD':
                        return {
                            ...baseData,
                            originZip: loadData.pickup_zip,
                            originLocation: loadData.pickup_location,
                            destinationZip: loadData.delivery_zip,
                            destinationLocation: loadData.delivery_location,
                            pickupDate: loadData.pickup_date,
                            deliveryDate: loadData.delivery_date,
                            balance: loadData.balance,
                            rate: loadData.rate,
                            equipmentType: loadData.equipment_type,
                            details: loadData.details,
                            mobilePhone: loadData.mobile_phone
                        };

                    case 'TRUCK':
                        return {
                            ...baseData,
                            originLocation: loadData.pickup_location,
                            originZip: loadData.pickup_zip,
                            pickupDate: loadData.pickup_date,
                            equipmentType: loadData.equipment_type,
                            balance: loadData.balance,
                            rate: loadData.rate,
                            details: loadData.details,
                            mobilePhone: loadData.mobile_phone
                        };

                    default:
                        return baseData;
                }
            });

            res.json({
                status: 'success',
                data: formattedLoads,
                meta: {
                    total: formattedLoads.length,
                    userType: req.userData.userType,
                    isSuperAdmin: req.userData.userType === 'SUPER_ADMIN',
                    filters: {
                        origin,
                        destination,
                        pickupDate,
                        deliveryDate,
                        status
                    }
                }
            });

        } catch (error) {
            console.error('View loads error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error viewing loads',
                error: error.message
            });
        }
    },

    allLoads: async (req, res) => {
        try {
            const {
                origin,
                destination,
                pickupDate,
                deliveryDate,
                status,
                type
            } = req.query;

            const whereConditions = {};

            // If not super admin, only show user's own load
            whereConditions.user_id != req.userData.userId;
            // Add filters if provided
            if (origin) {
                whereConditions.pickup_location = { [Op.like]: `%${origin}%` };
            }

            if (destination) {
                whereConditions.delivery_location = { [Op.like]: `%${destination}%` };
            }

            if (pickupDate) {
                whereConditions.pickup_date = new Date(pickupDate);
            }

            if (deliveryDate) {
                whereConditions.delivery_date = new Date(deliveryDate);
            }

            if (type) {
                whereConditions.load_type = type;
            }

            if (status) {
                whereConditions.status = status;
            }else{
                whereConditions.status = 'ACTIVE';
            }

            const loads = await Load.findAll({
                where: whereConditions,
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'companyName', 'contactName', 'phone', 'email', 'userType']
                }],
                order: [['created_at', 'DESC']],
                attributes: [
                    'id',
                    'load_type',
                    'status',
                    'pickup_location',
                    'pickup_zip',
                    'pickup_date',
                    'delivery_location',
                    'delivery_zip',
                    'delivery_date',
                    'balance',
                    'cubic_feet',
                    'rate',
                    'equipment_type',
                    'details',
                    'mobile_phone',
                    'job_number',
                    'created_at'
                ]
            });

            // Format the response
            const formattedLoads = loads.map(load => {
                const loadData = load.get({ plain: true });
                const baseData = {
                    id: loadData.id,
                    jobNumber: loadData.job_number ?? `${loadData.load_type}-${loadData.id}`,
                    type: loadData.load_type,
                    cubicFeet: loadData.cubic_feet,
                    status: loadData.status,
                    createdAt: loadData.created_at,
                    mobilePhone:loadData.mobile_phone,
                    contact: {
                        company: loadData.user.companyName,
                        name: loadData.user.contactName,
                        phone: loadData.mobile_phone ?? loadData.user.phone,
                        email: loadData.user.email,
                        userType: loadData.user.userType
                    }
                };

                switch (loadData.load_type) {
                    case 'RFP':
                    case 'RFD':
                        return {
                            ...baseData,
                            originZip: loadData.pickup_zip,
                            originLocation: loadData.pickup_location,
                            destinationZip: loadData.delivery_zip,
                            destinationLocation: loadData.delivery_location,
                            pickupDate: loadData.pickup_date,
                            deliveryDate: loadData.delivery_date,
                            balance: loadData.balance,
                            rate: loadData.rate,
                            equipmentType: loadData.equipment_type,
                            details: loadData.details,
                            mobilePhone: loadData.mobile_phone
                        };

                    case 'TRUCK':
                        return {
                            ...baseData,
                            originLocation: loadData.pickup_location,
                            originZip: loadData.pickup_zip,
                            pickupDate: loadData.pickup_date,
                            equipmentType: loadData.equipment_type,
                            balance: loadData.balance,
                            rate: loadData.rate,
                            details: loadData.details,
                            mobilePhone: loadData.mobile_phone
                        };

                    default:
                        return baseData;
                }
            });

            res.json({
                status: 'success',
                data: formattedLoads,
                meta: {
                    total: formattedLoads.length,
                    userType: req.userData.userType,
                    isSuperAdmin: req.userData.userType === 'SUPER_ADMIN',
                    filters: {
                        origin,
                        destination,
                        pickupDate,
                        deliveryDate,
                        status
                    }
                }
            });

        } catch (error) {
            console.error('View loads error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error viewing loads',
                error: error.message
            });
        }
    },

    requestLoad: async (req, res) => {
        try {
            const { loadId } = req.params;
            const { message, proposedRate } = req.body;

            // 1. First check if load exists - using raw: true
            const load = await Load.findByPk(loadId, {
                raw: true  // This will return plain object
            });
            
            if (!load) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Load not found'
                });
            }

            // 2. Check if it's user's own load
            if (load.userId === req.userData.userId) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Cannot request your own load'
                });
            }

            // 3. Check for existing request - using raw: true
            const existingRequest = await LoadRequest.findOne({
                where: {
                    loadId: loadId,
                    requesterId: req.userData.userId,
                    status: 'PENDING'
                },
                raw: true  // This will return plain object
            });

            if (existingRequest) {
                return res.status(400).json({
                    status: 'error',
                    message: 'You already have a pending request for this load'
                });
            }

            // 4. Create request and get plain object
            const newRequest = await LoadRequest.create({
                loadId: parseInt(loadId),
                requesterId: req.userData.userId,
                ownerId: load.userId,
                message: message || null,
                proposedRate: proposedRate,
                status: 'PENDING'
            });

            // Convert to plain object
            const plainRequest = newRequest.get({ plain: true });

            // 5. Return success response
            res.status(201).json({
                status: 'success',
                message: 'Request submitted successfully',
                data: {
                    requestId: plainRequest.id,
                    loadId: plainRequest.loadId,
                    status: plainRequest.status,
                    proposedRate: plainRequest.proposedRate,
                    message: plainRequest.message,
                    createdAt: plainRequest.createdAt
                }
            });

        } catch (error) {
            console.error('Load request error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error submitting load request',
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    },

    getLoadRequests: async (req, res) => {
        try {
            const { loadId } = req.params;

            // First check if load exists
            const load = await Load.findByPk(loadId, {
                raw: true
            });

            if (!load) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Load not found'
                });
            }

            // Check if user is authorized to view requests
            // Only load owner or super admin can view requests
            if (load.userId !== req.userData.userId && req.userData.userType !== 'SUPER_ADMIN') {
                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to view these requests'
                });
            }

            // Get all requests for this load with requester details
            const requests = await LoadRequest.findAll({
                where: {
                    loadId: loadId
                },
                include: [
                    {
                        model: User,
                        as: 'requester',
                        attributes: ['id', 'companyName', 'contactName', 'email', 'phone']
                    },
                    {
                        model: Load,
                        as: 'load',
                        attributes: ['id', 'loadType', 'pickupLocation', 'deliveryLocation', 'pickupDate', 'status']
                    }
                ],
                order: [['createdAt', 'DESC']],
                raw: true,
                nest: true // This helps format the nested objects nicely
            });
            console.log(requests, "REQUESTSSSS")
            // Format the response to match frontend requirements
            const formattedRequests = requests.map(request => ({
                id: request.id,
                jobNumber: `${request.load.loadType}-${request.load.id}`,
                requestedBy: request.requester.companyName,
                requesterContact: {
                    name: request.requester.contactName,
                    email: request.requester.email,
                    phone: request.requester.phone
                },
                status: request.status,
                date: request.createdAt,
                proposedRate: request.proposedRate,
                message: request.message,
                responseMessage: request.responseMessage,
                load: {
                    id: request.load.id,
                    type: request.load.loadType,
                    pickupLocation: request.load.pickupLocation,
                    deliveryLocation: request.load.deliveryLocation,
                    pickupDate: request.load.pickupDate,
                    status: request.load.status
                }
            }));

            res.json({
                status: 'success',
                data: {
                    loadId: load.id,
                    loadType: load.loadType,
                    requests: formattedRequests,
                    meta: {
                        total: formattedRequests.length,
                        pending: formattedRequests.filter(r => r.status === 'PENDING').length,
                        accepted: formattedRequests.filter(r => r.status === 'ACCEPTED').length,
                        rejected: formattedRequests.filter(r => r.status === 'REJECTED').length
                    }
                }
            });

        } catch (error) {
            console.error('Get load requests error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error fetching load requests',
                error: error.message
            });
        }
    },

    manageUsers: async (req, res) => {
        try {
            const { status, userType, search } = req.query;

            const whereConditions = {};
            if (status) whereConditions.status = status;
            if (userType) whereConditions.userType = userType;
            if (search) {
                whereConditions[Op.or] = [
                    { firstName: { [Op.like]: `%${search}%` } },
                    { lastName: { [Op.like]: `%${search}%` } },
                    { email: { [Op.like]: `%${search}%` } }
                ];
            }

            const users = await User.findAll({
                where: whereConditions,
                order: [['createdAt', 'DESC']]
            });

            res.json({
                status: 'success',
                data: users
            });
        } catch (error) {
            console.error('Manage Users Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error managing users'
            });
        }
    },

    importLoads: async (req, res) => {
        try {
            if (!req.files || !req.files.file) {
                return res.status(400).json({
                    status: 'error',
                    message: 'No file uploaded',
                    errors: [{
                        field: 'file',
                        message: 'Please upload a CSV file'
                    }]
                });
            }

            const file = req.files.file;
            const records = [];
            const errors = [];
            let rowNumber = 1;

            // Parse CSV file without using headers
            const parser = csv.parse({
                columns: false,
                skip_empty_lines: true,
                trim: true,
                relax_column_count: false
            });

            let loopCounter = 0;
            let processPromises = []; // Array to hold all processing promises

            parser.on('readable', async function() {
                let record;
                while ((record = parser.read()) !== null) {
                    loopCounter++;
                    console.log(`\n=== Loop iteration ${loopCounter} ===`);
                    console.log('Raw record:', record);
                    
                    // Skip the header row and empty rows
                    if (rowNumber === 1 || record.length !== 11) {
                        console.log(`Skipping row ${rowNumber}: ${record.length !== 11 ? 'Invalid column count' : 'Header row'}`);
                        rowNumber++;
                        continue;
                    }
                    
                    // Validate that we have actual data
                    if (!record[0] || !record[1] || !record[2] || !record[3] || !record[4]) {
                        console.log(`Skipping row ${rowNumber}: Missing required data`);
                        rowNumber++;
                        continue;
                    }

                    const mappedRecord = {
                        jobNumber: record[0],
                        pickupZip: record[1],
                        pickupDate: record[2],
                        deliveryZip: record[3],
                        deliveryDate: record[4],
                        weight: record[5],
                        balance: record[6],
                        mobilePhone: record[7],
                        rate: record[8],
                        cubicFeet: record[9],
                        description: record[10]
                    };

                    console.log('Mapped record:', mappedRecord);

                    const validationErrors = validateRecord(mappedRecord, rowNumber);
                    console.log('Validation errors:', validationErrors);
                    
                    if (validationErrors.length > 0) {
                        errors.push(...validationErrors);
                    } else {
                        // Push the promise into our array instead of awaiting it immediately
                        processPromises.push(
                            (async () => {
                                try {
                                    const [originLocation, destLocation] = await Promise.all([
                                        getLocationByZip(mappedRecord.pickupZip),
                                        getLocationByZip(mappedRecord.deliveryZip)
                                    ]);

                                    records.push({
                                        ...mappedRecord,
                                        userId: req.userData.userId,
                                        loadType: req.userData?.userType === 'BROKER' ? 'RFP' : 
                                                 req.userData?.userType === 'RFP_CARRIER' ? 'RFD' : 'TRUCK',
                                        status: 'ACTIVE',
                                        pickupLocation: originLocation.location,
                                        deliveryLocation: destLocation.location,
                                        details: {
                                            weight: mappedRecord.weight || null,
                                            source: 'CSV_IMPORT',
                                            coordinates: {
                                                origin: originLocation.coordinates,
                                                destination: destLocation.coordinates
                                            }
                                        }
                                    });
                                    console.log(`Successfully processed record ${rowNumber}. Total records pending: ${records.length}`);
                                } catch (locationError) {
                                    console.error('Location error:', locationError);
                                    errors.push({
                                        field: 'location',
                                        message: `Row ${rowNumber}: Error fetching location data: ${locationError.message}`,
                                        row: rowNumber
                                    });
                                }
                            })()
                        );
                    }
                    rowNumber++;
                }
            });

            parser.on('end', async function() {
                // Wait for all processing to complete
                await Promise.all(processPromises);
                console.log('\n=== Final Statistics ===');
                console.log('Total records after processing:', records.length);

                if (records.length === 0) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'No valid records found in CSV file',
                        errors: errors.length > 0 ? errors : [{
                            field: 'file',
                            message: 'CSV file contains no valid records'
                        }]
                    });
                }

                if (errors.length > 0) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Validation failed',
                        errors: errors
                    });
                }

                try {
                    // Get all job numbers from the records to be imported
                    const jobNumbers = records.map(record => record.jobNumber);
                    
                    // Check for existing records with these job numbers
                    const existingLoads = await Load.findAll({
                        where: {
                            jobNumber: {
                                [Op.in]: jobNumbers
                            }
                        },
                        attributes: ['jobNumber']
                    });

                    // Filter out records that already exist
                    const existingJobNumbers = existingLoads.map(load => load.jobNumber);
                    const newRecords = records.filter(record => !existingJobNumbers.includes(record.jobNumber));

                    console.log('\n=== Duplicate Check ===');
                    console.log('Total records:', records.length);
                    console.log('Existing records:', existingJobNumbers.length);
                    console.log('New records to save:', newRecords.length);

                    if (newRecords.length === 0) {
                        return res.status(400).json({
                            status: 'error',
                            message: 'All records already exist in the database',
                            duplicates: existingJobNumbers
                        });
                    }

                    const createdLoads = await Load.bulkCreate(newRecords);
                    console.log('Successfully created loads:', createdLoads.length);
                    
                    res.status(200).json({
                        status: 'success',
                        message: `Successfully imported ${createdLoads.length} loads`,
                        data: {
                            count: createdLoads.length,
                            skipped: existingJobNumbers.length,
                            skippedJobNumbers: existingJobNumbers
                        }
                    });
                } catch (dbError) {
                    console.error('Database error:', dbError);
                    res.status(500).json({
                        status: 'error',
                        message: 'Failed to save loads to database',
                        error: dbError.message
                    });
                }
            });

            // Feed the file data into the parser
            parser.write(file.data);
            parser.end();

        } catch (error) {
            console.error('Import loads error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to import loads',
                error: error.message
            });
        }
    },

    downloadSampleCSV: async (req, res) => {
        try {
            // Define the CSV headers
            const headers = [
                'jobNumber',
                'pickupZip',
                'pickupDate',
                'deliveryZip',
                'deliveryDate',
                'weight',
                'balance',
                'mobilePhone',
                'rate',
                'cubicFeet',
                'description'
            ];

            // Create the CSV content (just headers)
            const csvContent = headers.join(',') + '\n';

            // Set the response headers for file download
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=load_import_template.csv');

            // Send the CSV content
            res.send(csvContent);

        } catch (error) {
            console.error('Download sample CSV error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to generate sample CSV',
                error: error.message
            });
        }
    }
}; 

function validateRecord(record, rowNumber) {
    const errors = [];

    // Required fields validation
    const requiredFields = ['pickupZip', 'pickupDate', 'deliveryZip', 'deliveryDate'];
    requiredFields.forEach(field => {
        if (!record[field]) {
            errors.push({
                field: field,
                message: `Row ${rowNumber}: ${field} is required`,
                row: rowNumber
            });
        }
    });

    // Date validation helper function
    const validateAndConvertDate = (dateStr) => {
        // Check for DD/MM/YYYY format
        const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const match = dateStr.match(dateRegex);
        
        if (match) {
            const [_, day, month, year] = match;
            // Convert to Date object to validate
            const date = new Date(year, month - 1, day);
            if (
                date.getDate() === parseInt(day) &&
                date.getMonth() === parseInt(month) - 1 &&
                date.getFullYear() === parseInt(year)
            ) {
                // Convert to YYYY-MM-DD format for database
                return `${year}-${month}-${day}`;
            }
        }
        return null;
    };

    // Date fields validation
    ['pickupDate', 'deliveryDate'].forEach(field => {
        if (record[field]) {
            const convertedDate = validateAndConvertDate(record[field]);
            if (!convertedDate) {
                errors.push({
                    field: field,
                    message: `Row ${rowNumber}: ${field} must be in DD/MM/YYYY format`,
                    row: rowNumber
                });
            } else {
                // Update the record with converted date
                record[field] = convertedDate;
            }
        }
    });

    // ZIP code validation
    ['pickupZip', 'deliveryZip'].forEach(field => {
        if (record[field] && !/^\d{5}$/.test(record[field])) {
            errors.push({
                field: field,
                message: `Row ${rowNumber}: ${field} must be a 5-digit number`,
                row: rowNumber
            });
        }
    });

    // Rest of your validations...
    return errors;
}