const { User } = require('../models');

class SettingsService {
    async getSettings(userId) {
        const user = await User.findByPk(userId);
        if (!user) throw new Error('User not found');

        return {
            notifications: user.notifications,
            emailAlerts: user.emailAlerts,
            language: user.language,
            timezone: user.timezone,
            loadBoardUrls: user.loadBoardUrls || []
        };
    }

    async updateLoadBoardUrls(userId, urls) {
        const user = await User.findByPk(userId);
        if (!user) throw new Error('User not found');
        
        await user.update({ loadBoardUrls: urls });
        return { loadBoardUrls: user.loadBoardUrls };
    }

    async updateGeneralSettings(userId, settings) {
        const user = await User.findByPk(userId);
        if (!user) throw new Error('User not found');
        
        const { notifications, emailAlerts, language, timezone } = settings;
        await user.update({ 
            notifications, 
            emailAlerts, 
            language, 
            timezone 
        });
        
        return {
            notifications,
            emailAlerts,
            language,
            timezone
        };
    }

    async updateAlertPreferences(userId, preferences) {
        const user = await User.findByPk(userId);
        if (!user) throw new Error('User not found');
        
        await user.update({ 
            alertPreferences: preferences 
        });
        
        return {
            alertPreferences: user.alertPreferences
        };
    }

    async updateServiceAreas(userId, serviceAreas) {
        const user = await User.findByPk(userId);
        if (!user) throw new Error('User not found');
        
        await user.update({ 
            serviceAreas: serviceAreas 
        });
        
        return {
            serviceAreas: user.serviceAreas
        };
    }

    async updateRouteAlerts(userId, routeAlerts) {
        const user = await User.findByPk(userId);
        if (!user) throw new Error('User not found');
        
        await user.update({ 
            routeAlerts: routeAlerts 
        });
        
        return {
            routeAlerts: user.routeAlerts
        };
    }
}

module.exports = new SettingsService(); 