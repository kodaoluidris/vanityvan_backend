const { User, Load } = require('../models');
const { Op } = require('sequelize');

exports.getSuperAdminDashboard = async (req, res) => {
    try {
        const stats = {
            activeLoads: await Load.count({ where: { status: 'ACTIVE' } }),
            pendingRequests: await User.count({ where: { status: 'PENDING' } }),
            completedLoads: await Load.count({ where: { status: 'COMPLETED' } }),
            revenue: await Load.sum('rate', { where: { status: 'COMPLETED' } }) || 0
        };

        const recentLoads = await Load.findAll({
            limit: 5,
            order: [['createdAt', 'DESC']],
            include: [{
                model: User,
                as: 'user',
                attributes: ['firstName', 'lastName', 'companyName']
            }]
        });

        const recentRequests = await User.findAll({
            where: { status: 'PENDING' },
            limit: 5,
            order: [['createdAt', 'DESC']]
        });

        res.json({
            status: 'success',
            data: {
                stats,
                recentLoads,
                recentRequests
            }
        });
    } catch (error) {
        console.error('Super Admin Dashboard Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching dashboard data'
        });
    }
};

exports.manageUsers = async (req, res) => {
    try {
        const { status, userType, search, page = 1, limit = 10 } = req.query;
        
        const whereConditions = {};
        if (status) whereConditions.status = status;
        if (userType) whereConditions.userType = userType;
        if (search) {
            whereConditions[Op.or] = [
                { firstName: { [Op.like]: `%${search}%` } },
                { lastName: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { companyName: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows } = await User.findAndCountAll({
            where: whereConditions,
            limit: parseInt(limit),
            offset: (page - 1) * limit,
            order: [['createdAt', 'DESC']]
        });

        res.json({
            status: 'success',
            data: {
                users: rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    totalItems: count
                }
            }
        });
    } catch (error) {
        console.error('Manage Users Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching users'
        });
    }
};

exports.getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Fetching details for user ID: ${userId}`);

        const user = await User.findByPk(userId, {
            include: [{
                model: Load,
                as: 'loads',
                attributes: ['id', 'status', 'rate']
            }]
        });

        if (!user) {
            console.log(`User not found for ID: ${userId}`);
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        res.json({
            status: 'success',
            data: { user }
        });
    } catch (error) {
        console.error('Get User Details Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching user details',
            details: error.message
        });
    }
};

exports.updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        await user.update({ status });

        res.json({
            status: 'success',
            message: 'User status updated successfully',
            data: { userId, status }
        });
    } catch (error) {
        console.error('Update User Status Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating user status'
        });
    }
};

exports.getAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Add your analytics logic here
        const analytics = {
            userStats: {
                totalUsers: await User.count(),
                activeUsers: await User.count({ where: { status: 'ACTIVE' } })
            },
            loadStats: {
                totalLoads: await Load.count(),
                activeLoads: await Load.count({ where: { status: 'ACTIVE' } })
            }
        };

        res.json({
            status: 'success',
            data: analytics
        });
    } catch (error) {
        console.error('Analytics Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching analytics'
        });
    }
};

exports.getActivityLogs = async (req, res) => {
    try {
        // Implement activity logs logic here
        res.json({
            status: 'success',
            data: {
                logs: [],
                pagination: {
                    currentPage: 1,
                    totalPages: 0,
                    totalItems: 0
                }
            }
        });
    } catch (error) {
        console.error('Activity Logs Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching activity logs'
        });
    }
};

exports.updateLoadStatus = async (req, res) => {
    try {
        const { loadId } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['ACTIVE', 'ASSIGNED', 'COMPLETED', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Find the load
        const load = await Load.findByPk(loadId);
        if (!load) {
            return res.status(404).json({
                status: 'error',
                message: 'Load not found'
            });
        }

        // Update the status
        await load.update({ status });

        // Get updated load with user information
        const updatedLoad = await Load.findByPk(loadId, {
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email', 'companyName']
            }]
        });

        res.json({
            status: 'success',
            message: 'Load status updated successfully',
            data: {
                load: updatedLoad
            }
        });

    } catch (error) {
        console.error('Update Load Status Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating load status',
            details: error.message
        });
    }
}; 