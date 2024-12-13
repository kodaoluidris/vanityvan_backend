const notificationService = require('../services/notificationService');

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user?.id || req.userData?.userId;
        
        if (!userId) {
            return res.status(401).json({
                status: 'error',
                message: 'User not authenticated'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const { notifications, pagination } = await notificationService.getUserNotifications(
            userId,
            page,
            limit
        );
        
        res.json({
            status: 'success',
            data: {
                notifications,
                pagination
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch notifications'
        });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.userData.userId;
        const count = await notificationService.getUnreadCount(userId);
        
        res.json({
            status: 'success',
            data: { count }
        });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch unread count'
        });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const userId = req.userData.userId;
        const notificationId = req.params.id;
        
        await notificationService.markAsRead(notificationId, userId);
        
        res.json({
            status: 'success',
            message: 'Notification marked as read'
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to mark notification as read'
        });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        console.log('Request user data:', req.user, req.userData);
        
        if (!req.user && !req.userData) {
            return res.status(401).json({
                status: 'error',
                message: 'User not authenticated'
            });
        }

        const userId = req.user?.id || req.userData?.userId;
        
        if (!userId) {
            return res.status(401).json({
                status: 'error',
                message: 'User ID not found'
            });
        }

        await notificationService.markAllAsRead(userId);
        
        res.json({
            status: 'success',
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to mark all notifications as read'
        });
    }
}; 