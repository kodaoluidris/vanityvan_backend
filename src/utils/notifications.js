const db = require('../config/database');
const WebSocket = require('ws');

let wss;

exports.initializeWebSocket = (server) => {
    wss = new WebSocket.Server({ server });
    
    wss.on('connection', (ws) => {
        ws.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'auth') {
                ws.userId = data.userId;
            }
        });
    });
};

exports.sendNotification = async (userId, notification) => {
    try {
        // Save notification to database
        const [result] = await db.execute(
            `INSERT INTO notifications (
                user_id,
                type,
                content,
                reference_id
            ) VALUES (?, ?, ?, ?)`,
            [userId, notification.type, JSON.stringify(notification), notification.referenceId]
        );

        // Send real-time notification if user is connected
        wss.clients.forEach((client) => {
            if (client.userId === userId && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'notification',
                    data: {
                        id: result.insertId,
                        ...notification
                    }
                }));
            }
        });

        return result.insertId;
    } catch (error) {
        console.error('Notification error:', error);
    }
}; 