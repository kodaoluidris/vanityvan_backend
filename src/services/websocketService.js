const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class WebSocketService {
  constructor() {
    this.clients = new Map();
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws) => {
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          await this.handleMessage(ws, data);
        } catch (error) {
          logger.error('WebSocket message handling error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        this.removeClient(ws);
      });
    });

    // Setup ping interval to keep connections alive
    this.setupPingInterval();
  }

  async handleMessage(ws, data) {
    switch (data.type) {
      case 'auth':
        await this.handleAuth(ws, data.token);
        break;
      case 'subscribe':
        this.handleSubscribe(ws, data.channels);
        break;
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Unknown message type'
        }));
    }
  }

  async handleAuth(ws, token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      ws.userId = decoded.userId;
      this.clients.set(decoded.userId, ws);
      
      ws.send(JSON.stringify({
        type: 'auth',
        status: 'success'
      }));
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'auth',
        status: 'error',
        message: 'Invalid token'
      }));
      ws.close();
    }
  }

  handleSubscribe(ws, channels) {
    ws.subscriptions = channels;
    ws.send(JSON.stringify({
      type: 'subscribe',
      status: 'success',
      channels
    }));
  }

  setupPingInterval() {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          this.removeClient(ws);
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping(() => {});
      });
    }, 30000); // Check every 30 seconds
  }

  removeClient(ws) {
    if (ws.userId) {
      this.clients.delete(ws.userId);
    }
  }

  sendToUser(userId, data) {
    const ws = this.clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  broadcast(data, channel) {
    this.wss.clients.forEach((client) => {
      if (
        client.readyState === WebSocket.OPEN &&
        (!channel || (client.subscriptions && client.subscriptions.includes(channel)))
      ) {
        client.send(JSON.stringify(data));
      }
    });
  }
}

module.exports = new WebSocketService(); 