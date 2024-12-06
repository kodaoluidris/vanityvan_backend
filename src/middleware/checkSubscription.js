const db = require('../config/database');

module.exports = async (req, res, next) => {
    try {
        const userId = req.userData.userId;
        
        // Check for active subscription
        const [subscriptions] = await db.execute(
            'SELECT * FROM subscriptions WHERE user_id = ? AND status = "active"',
            [userId]
        );

        if (subscriptions.length === 0) {
            return res.status(403).json({ 
                message: 'Active subscription required',
                code: 'SUBSCRIPTION_REQUIRED'
            });
        }

        req.subscription = subscriptions[0];
        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
}; 