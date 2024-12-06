const cheerio = require('cheerio');
const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');

class LoadboardService {
    constructor() {
        this.proxyConfig = {
            host: 'us.windscribe.com',
            port: 443,
            auth: {
                username: process.env.PROXY_USERNAME,
                password: process.env.PROXY_PASSWORD
            }
        };

        this.axiosInstance = axios.create({
            httpsAgent: new HttpsProxyAgent(this.proxyConfig),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 30000 // 30 second timeout
        });
    }

    async scrapeLoadboard(url) {
        try {
            const response = await this.axiosInstance.get(url);
            const $ = cheerio.load(response.data);
            
            const loads = [];
            
            $('table tbody tr').each((index, element) => {
                if (index === 0) return; // Skip header row
                
                const load = this.parseLoadRow($, element);
                if (load) loads.push(load);
            });
            
            return loads;
        } catch (error) {
            console.error(`Error scraping URL ${url}:`, error);
            throw error;
        }
    }

    parseLoadRow($, element) {
        try {
            return {
                jobNumber: $(element).find('td:nth-child(1)').text().trim(),
                type: $(element).find('td:nth-child(2)').text().trim(),
                moveDate: $(element).find('td:nth-child(3)').text().trim(),
                movingFrom: {
                    city: $(element).find('td:nth-child(6)').text().trim(),
                    zip: $(element).find('td:nth-child(7)').text().trim()
                },
                movingTo: {
                    city: $(element).find('td:nth-child(8)').text().trim(),
                    zip: $(element).find('td:nth-child(9)').text().trim()
                },
                cubicFeet: this.parseCubicFeet($(element).find('td:nth-child(10)').text().trim()),
                miles: parseInt($(element).find('td:nth-child(11)').text().trim(), 10),
                estimate: this.parseEstimate($(element).find('td:nth-child(12)').text().trim())
            };
        } catch (error) {
            console.error('Error parsing row:', error);
            return null;
        }
    }

    parseCubicFeet(text) {
        const match = text.match(/(\d+)\s*cf/);
        return match ? parseInt(match[1], 10) : null;
    }

    parseEstimate(text) {
        const match = text.match(/\$?([\d,]+\.?\d*)/);
        return match ? parseFloat(match[1].replace(',', '')) : null;
    }
}

module.exports = new LoadboardService(); 