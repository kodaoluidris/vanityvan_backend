const { User } = require('../models');

const checkActiveUser = async (req, res, next) => {
    try {
        const userId = req.userData.userId;
        const user = await User.findByPk(userId);

        if (!user || user.status !== 'active') {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. User is not active.'
            });
        }

        next();
    } catch (error) {
        console.error('Error checking active user:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

module.exports = checkActiveUser; 