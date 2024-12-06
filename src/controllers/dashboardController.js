const { Load, Request, User, Truck } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// Export the controller methods directly as an object
module.exports = {
    getBrokerDashboard: async (req, res) => {
        try {
            const userId = req.userData.userId;
            const today = new Date();
            const startOfToday = new Date(today.setHours(0, 0, 0, 0));
            
            // Get Active Loads Overview
            const activeLoads = await Load.findAll({
                where: {
                    userId,
                    status: {
                        [Op.in]: ['ACTIVE', 'ASSIGNED', 'IN_TRANSIT']
                    }
                }
            });

            // Get Assigned Jobs Count
            const assignedJobsCount = await Load.count({
                where: {
                    userId,
                    status: 'ASSIGNED'
                }
            });

            // Get Accepted Requests Count
            const acceptedRequestsCount = await Request.count({
                where: {
                    ownerId: userId,
                    status: 'ACCEPTED'
                }
            });

            // Get Recent Requests with status counts
            const recentRequests = await Request.findAll({
                where: {
                    ownerId: userId,
                    createdAt: {
                        [Op.gte]: startOfToday
                    }
                },
                include: [{
                    model: User,
                    as: 'requester',
                    attributes: ['companyName']
                }],
                limit: 10,
                order: [['createdAt', 'DESC']]
            });

            // Get status counts for all requests
            const requestStatusCounts = await Request.findAll({
                where: { ownerId: userId },
                attributes: [
                    'status',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['status']
            });

            // Get Recent Posts (Loads)
            const recentPosts = await Load.findAll({
                where: {
                    userId,
                    createdAt: {
                        [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                },
                include: [{
                    model: Request,
                    as: 'requests',
                    required: false,
                    attributes: ['id', 'status']
                }],
                order: [['createdAt', 'DESC']],
                limit: 10
            });

            // Format the response
            res.json({
                status: 'success',
                data: {
                    summary: {
                        totalActiveLoads: activeLoads.length,
                        assignedJobs: assignedJobsCount,
                        acceptedRequests: acceptedRequestsCount
                    },
                    activeLoads: {
                        total: activeLoads.length,
                        byStatus: {
                            active: activeLoads.filter(l => l.status === 'ACTIVE').length,
                            assigned: activeLoads.filter(l => l.status === 'ASSIGNED').length,
                            inTransit: activeLoads.filter(l => l.status === 'IN_TRANSIT').length
                        }
                    },
                    requests: {
                        recent: {
                            total: recentRequests.length,
                            pending: recentRequests.filter(r => r.status === 'PENDING').length,
                            items: recentRequests.map(r => ({
                                id: r.id,
                                loadId: r.loadId,
                                carrier: r.requester?.companyName || 'Unknown',
                                status: r.status,
                                proposedRate: r.proposedRate,
                                createdAt: r.createdAt
                            }))
                        },
                        statistics: {
                            total: requestStatusCounts.reduce((sum, item) => sum + parseInt(item.get('count')), 0),
                            byStatus: requestStatusCounts.reduce((acc, item) => {
                                acc[item.status.toLowerCase()] = parseInt(item.get('count'));
                                return acc;
                            }, {})
                        }
                    },
                    recentPosts: {
                        total: recentPosts.length,
                        items: recentPosts.map(post => ({
                            id: post.id,
                            loadType: post.loadType,
                            status: post.status,
                            origin: post.pickupLocation,
                            destination: post.deliveryLocation,
                            pickupDate: post.pickupDate,
                            deliveryDate: post.deliveryDate,
                            rate: post.rate,
                            weight: post.weight,
                            equipmentType: post.equipmentType,
                            requestsCount: post.requests?.length || 0,
                            pendingRequests: post.requests?.filter(r => r.status === 'PENDING').length || 0,
                            acceptedRequests: post.requests?.filter(r => r.status === 'ACCEPTED').length || 0,
                            createdAt: post.createdAt
                        }))
                    }
                }
            });

        } catch (error) {
            console.error('Dashboard error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error fetching dashboard data',
                error: error.message
            });
        }
    },
    getRFPCarrierDashboard: async (req, res) => {
        try {
            const userId = req.userData.userId;

            // Get available loads
            const availableLoads = await Load.findAll({
                where: {
                    status: 'ACTIVE',
                    loadType: 'RFP',
                    // Add any other relevant conditions
                },
                include: [{
                    model: User,
                    as: 'user', 
                    attributes: ['firstName', 'lastName', 'companyName', 'phone', 'email']  // Select only needed fields
                }],
                limit: 5,
                order: [['createdAt', 'DESC']]
            });

            // Get user's RFD loads
            const myRFDLoads = await Load.findAll({
                where: {
                    userId,
                    loadType: 'RFD'
                },
                limit: 5,
                order: [['createdAt', 'DESC']]
            });

            // Get statistics
            const stats = {
                availableLoads: await Load.count({
                    where: {
                        status: 'Active',
                        loadType: 'BROKER'
                    }
                }),
                postedRFDLoads: await Load.count({
                    where: {
                        userId,
                        loadType: 'RFD'
                    }
                }),
                activeDeliveries: await Load.count({
                    where: {
                        userId,
                        status: 'Active'
                    }
                }),
                revenue: await Load.sum('rate', {
                    where: {
                        userId,
                        status: 'Completed'
                    }
                }) || 0
            };

            res.json({
                status: 'success',
                data: {
                    stats,
                    availableLoads,
                    myRFDLoads
                }
            });

        } catch (error) {
            console.error('RFP Carrier Dashboard Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error fetching dashboard data'
            });
        }
    },
    getRFDCarrierDashboard: async (req, res) => {
        try {
            const userId = req.userData.userId;

            // Get my posted trucks (which are loads of type RFD)
            const myTrucks = await Load.findAll({
                where: {
                    userId,
                    loadType: 'TRUCK',
                    status: 'ACTIVE'
                },
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['firstName', 'lastName', 'companyName', 'phone', 'email']
                }],
                limit: 5,
                order: [['createdAt', 'DESC']]
            });

            const availableRFDLoads = await Load.findAll({
                where: {
                    status: 'ACTIVE',
                    loadType: 'RFD',
                    userId,
                    // userId: {
                    //     [Op.ne]: userId 
                    // }
                },
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['firstName', 'lastName', 'companyName', 'phone', 'email']
                }],
                limit: 5,
                order: [['createdAt', 'DESC']]
            });

            // Get statistics
            const stats = {
                openTrucks: await Load.count({
                    where: {
                        userId,
                        loadType: 'RFD',
                        status: 'ACTIVE'
                    }
                }),
                availableRFDLoads: await Load.count({
                    where: {
                        status: 'ACTIVE',
                        loadType: 'RFD',
                        userId: {
                            [Op.ne]: userId
                        }
                    }
                }),
                activeDeliveries: await Load.count({
                    where: {
                        userId,
                        status: 'IN_TRANSIT'
                    }
                }),
                revenue: await Load.sum('rate', {
                    where: {
                        userId,
                        status: 'COMPLETED'
                    }
                }) || 0
            };

            // Transform the data to match the frontend expectations
            const transformedTrucks = myTrucks.map(truck => ({
                id: truck.id,
                location: truck.pickupLocation,
                cubicFeet: truck.cubicFeet,
                availableDate: truck.pickupDate,
                status: truck.status === 'ACTIVE' ? 'Available' : 'In Use',
                equipmentType: truck.equipmentType
            }));

            const transformedLoads = availableRFDLoads.map(load => ({
                id: load.id,
                origin: load.pickupLocation,
                cubicFeet: load.cubicFeet,
                destination: load.deliveryLocation,
                rate: load.rate,
                broker: {
                    name: `${load.user.firstName} ${load.user.lastName}`,
                    company: load.user.companyName,
                    phone: load.user.phone
                }
            }));

            res.json({
                status: 'success',
                data: {
                    stats,
                    myTrucks: transformedTrucks,
                    availableRFDLoads: transformedLoads
                }
            });

        } catch (error) {
            console.error('RFD Carrier Dashboard Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error fetching dashboard data'
            });
        }
    }
};