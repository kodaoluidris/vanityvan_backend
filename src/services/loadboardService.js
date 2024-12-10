require('dotenv').config();

const getProxyConfig = async () => {
    // Windscribe typically uses SOCKS protocol
    const proxyConfig = {
        protocol: 'http', // or 'socks5' depending on your Windscribe configuration
        host: process.env.PROXY_HOST || 'socks-nl.windscribe.com', // Use the correct Windscribe server
        port: process.env.PROXY_PORT || '443', // Default Windscribe port
        auth: {
            username: process.env.PROXY_USERNAME,
            password: process.env.PROXY_PASSWORD
        }
    };

    // Format: protocol://username:password@host:port
    return `${proxyConfig.protocol}://${proxyConfig.auth.username}:${proxyConfig.auth.password}@${proxyConfig.host}:${proxyConfig.port}`;
};

module.exports = {
    getProxyConfig
}; 