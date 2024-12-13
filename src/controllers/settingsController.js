const { User } = require('../models');

exports.getSettings = async (req, res) => {
    try {
        const user = await User.findByPk(req.userData.userId);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        res.json({
            status: 'success',
            data: {
                loadBoardUrls: user.loadBoardUrls,
                notifications: user.notifications,
                emailAlerts: user.email_alerts,
                language: user.language,
                timezone: user.timezone,
                serviceAreas: user.serviceAreas ? user.serviceAreas : [],
                alertPreferences: user.alertPreferences ? user.alertPreferences : {},
                routeAlerts: user.routeAlerts ? user.routeAlerts : [],
            }
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching settings'
        });
    }
};

exports.updateGeneralSettings = async (req, res) => {
    try {
        const {
            notifications,
            emailAlerts,
            language,
            timezone,
            alertPreferences,
            routeAlerts,
            serviceAreas
        } = req.body;

        console.log('Request Body:', req.body);
        console.log('route alerts before update:', routeAlerts);

        const updateResult = await User.update({
            notifications,
            email_alerts: emailAlerts,
            language,
            timezone,
            alertPreferences: alertPreferences,
            routeAlerts: routeAlerts,
            serviceAreas: serviceAreas
        }, {
            where: { id: req.userData.userId },
            returning: true
        });

        console.log('Update Result:', updateResult);

        const updatedUser = await User.findByPk(req.userData.userId);
        console.log('Updated User Route Alerts:', updatedUser.routeAlerts);

        res.json({
            status: 'success',
            message: 'Settings updated successfully',
            data: {
                serviceAreas: updatedUser.serviceAreas
            }
        });
    } catch (error) {
        console.error('Update settings error:', error);
        console.error('Error details:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Error updating settings',
            error: error.message
        });
    }
};

exports.updateLoadBoardUrls = async (req, res) => {
    try {
        const { loadBoardUrls } = req.body;

        await User.update({
            loadBoardUrls: loadBoardUrls
        }, {
            where: { id: req.userData.userId }
        });

        res.json({
            status: 'success',
            message: 'Load board URLs updated successfully'
        });
    } catch (error) {
        console.error('Update load board URLs error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating load board URLs'
        });
    }
}; 