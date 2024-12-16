const loadService = require('../services/loadService');
const { Load, User } = require('../models');
const { Op } = require('sequelize');
const NotificationService = require('../services/notificationService');
const Request = require('../models/LoadRequest');

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
                    jobNumber: `${load.loadType}-${load.id}`,
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
                    mobilePhone: load.mobilePhone,
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
                console.log('Processing load ID:', loadData.id);
                
                // Format based on load type
                switch (loadData.load_type) {  // Make sure this matches your database column name
                    case 'RFP':
                        return {
                            id: loadData.id,
                            jobNumber: `RFP-${loadData.id}`,
                            type: 'RFP',
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
                            mobilePhone: loadData.mobilePhone,
                            contact: {
                                company: loadData.user.companyName,
                                name: loadData.user.contactName,
                                phone: loadData.user.phone,
                                email: loadData.user.email
                            }
                        };

                    case 'RFD':
                        return {
                            id: loadData.id,
                            jobNumber: `RFD-${loadData.id}`,
                            type: 'RFD',
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
                            mobilePhone: loadData.mobilePhone,
                            contact: {
                                company: loadData.user.companyName,
                                name: loadData.user.contactName,
                                phone: loadData.user.phone,
                                email: loadData.user.email
                            }
                        };

                    case 'TRUCK':
                        return {
                            id: loadData.id,
                            jobNumber: `TRUCK-${loadData.id}`,
                            type: 'TRUCK',
                            location: loadData.pickup_location,
                            locationZip: loadData.pickup_zip,
                            availableDate: loadData.pickup_date,
                            equipmentType: loadData.equipment_type,
                            balance: loadData.balance,
                            ratePerMile: loadData.rate,
                            details: loadData.details,
                            mobilePhone: loadData.mobilePhone,
                            contact: {
                                company: loadData.user.companyName,
                                name: loadData.user.contactName,
                                phone: loadData.user.phone,
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
                    'mobilePhone',
                    'created_at'
                ]
            });

            // Format the response
            const formattedLoads = loads.map(load => {
                const loadData = load.get({ plain: true });
                const baseData = {
                    id: loadData.id,
                    jobNumber: `${loadData.load_type}-${loadData.id}`,
                    type: loadData.load_type,
                    cubicFeet: loadData.cubic_feet,
                    status: loadData.status,
                    createdAt: loadData.created_at,
                    contact: {
                        company: loadData.user.companyName,
                        name: loadData.user.contactName,
                        phone: loadData.user.phone,
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
                            mobilePhone: loadData.mobilePhone
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
                            mobilePhone: loadData.mobilePhone
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
                    'mobilePhone',
                    'created_at'
                ]
            });

            // Format the response
            const formattedLoads = loads.map(load => {
                const loadData = load.get({ plain: true });
                const baseData = {
                    id: loadData.id,
                    jobNumber: `${loadData.load_type}-${loadData.id}`,
                    type: loadData.load_type,
                    cubicFeet: loadData.cubic_feet,
                    status: loadData.status,
                    createdAt: loadData.created_at,
                    contact: {
                        company: loadData.user.companyName,
                        name: loadData.user.contactName,
                        phone: loadData.user.phone,
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
                            mobilePhone: loadData.mobilePhone
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
                            mobilePhone: loadData.mobilePhone
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
            const existingRequest = await Request.findOne({
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
            const newRequest = await Request.create({
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
            const requests = await Request.findAll({
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
    }
}; 