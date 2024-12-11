const { User, Load } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');
const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');
const puppeteer = require('puppeteer');
const { getLocationByZip } = require('../utils/locationService');

exports.getAllLoadboardData = async (req, res) => {
    try {
        const users = await User.findAll({
            where: {
                loadBoardUrls: {
                    [Op.ne]: []
                }
            },
            attributes: ['id', 'companyName', 'loadBoardUrls']
        });

        const allLoadboardData = [];
        
        const axiosInstance = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 30000
        });

        for (const user of users) {
            if (!Array.isArray(user.loadBoardUrls)) {
                console.log(`LoadBoardUrls is not an array for user ${user.id}`);
                continue;
            }

            for (const url of user.loadBoardUrls) {
                try {
                    console.log(`Attempting to fetch URL: ${url}`);
                    const response = await axiosInstance.get(url);
                    console.log('Response received:', response.status);

                    const $ = cheerio.load(response.data);
                    
                    // Extract the URL of the frame containing the data
                    const frameSrc = $('frame[name="BODY"]').attr('src');
                    if (!frameSrc) {
                        console.log('No frame found with name "BODY"');
                        continue;
                    }

                    // Construct the full URL for the frame
                    const frameUrl = new URL(frameSrc, url).href;
                    console.log('Frame URL:', frameUrl);

                    // Fetch the content of the frame
                    const frameResponse = await axios({
                        method: 'get',
                        url: frameUrl,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5',
                            'Referer': url,
                            'Cookie': response.headers['set-cookie']?.join('; ') // Forward cookies if any
                        },
                        maxRedirects: 5,
                        validateStatus: status => status < 400
                    });

                    const frameData = cheerio.load(frameResponse.data);
                    
                    // Process the table with load data
                    frameData('table').each((tableIndex, table) => {
                        if (frameData(table).find('tr:first-child td:first-child').text().includes('Job No.')) {
                            console.log('Found loadboard table!');
                            
                            frameData(table).find('tr').each((index, element) => {
                                if (index === 0) return; // Skip header

                                const load = {
                                    userId: user.id,
                                    companyName: user.companyName,
                                    jobNumber: frameData(element).find('td:eq(0)').text().trim(),
                                    type: frameData(element).find('td:eq(1)').text().trim(),
                                    moveDate: frameData(element).find('td:eq(2)').text().trim(),
                                    movingFrom: {
                                        city: frameData(element).find('td:eq(5)').text().trim(),
                                        zip: frameData(element).find('td:eq(6)').text().trim()
                                    },
                                    movingTo: {
                                        city: frameData(element).find('td:eq(7)').text().trim(),
                                        zip: frameData(element).find('td:eq(8)').text().trim()
                                    },
                                    cubicFeet: frameData(element).find('td:eq(9)').text().trim(),
                                    miles: frameData(element).find('td:eq(10)').text().trim(),
                                    estimate: frameData(element).find('td:eq(11)').text().trim()
                                };

                                console.log('Parsed load:', load);
                                allLoadboardData.push(load);
                            });
                        }
                    });

                } catch (error) {
                    console.error(`Error scraping URL ${url} for user ${user.id}:`, error);
                    continue;
                }
            }
        }

        return res.json({
            status: 'success',
            message: `Found ${allLoadboardData.length} loads from ${users.length} users`,
            data: allLoadboardData
        });

    } catch (error) {
        console.error('Loadboard scraping error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Error fetching loadboard data',
            error: error.message
        });
    }
}; 


exports.scrapeAndSaveLoadboardData = async (req, res) => {
    try {
        const brokers = await User.findAll({
            where: {
                userType: 'BROKER',
                loadBoardUrls: {
                    [Op.ne]: []
                }
            },
            attributes: ['id', 'companyName', 'loadBoardUrls']
        });

        

        const axiosInstance = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: status => status < 400
        });

        let totalLoadsSaved = 0;
        const scrapingSummary = [];

        // Helper function to parse dates
        const parseDate = (dateStr) => {
            if (!dateStr) return null;
            
            // Remove any extra whitespace
            dateStr = dateStr.trim();
            
            // Expected format: MM/DD/YYYY
            const [month, day, year] = dateStr.split('/');
            
            if (!month || !day || !year) {
                console.error('Invalid date format:', dateStr);
                return null;
            }

            // Create a new date object
            const date = new Date(year, month - 1, day); // month is 0-based in JS
            
            // Validate the date
            if (isNaN(date.getTime())) {
                console.error('Invalid date:', dateStr);
                return null;
            }
            
            return date;
        };

        for (const broker of brokers) {
            console.log(`Processing broker ${broker.id} with company ${broker.companyName}`);
            
            for (const url of broker.loadBoardUrls) {
                try {
                    // Initialize brokerLoads array at the start of each URL processing
                    const brokerLoads = [];

                    // Get the main page
                    const response = await axiosInstance.get(url);
                    const $ = cheerio.load(response.data);
                    
                    // Extract the frame URL
                    const frameSrc = $('frame[name="BODY"]').attr('src');
                    if (!frameSrc) {
                        console.log('No frame found with name "BODY"');
                        continue;
                    }

                    // Construct frame URL
                    const frameUrl = frameSrc.startsWith('http') 
                        ? frameSrc 
                        : frameSrc.startsWith('/') 
                            ? `${new URL(url).origin}${frameSrc}`
                            : `${new URL(url).origin}/${frameSrc}`;

                    console.log('Frame URL:', frameUrl);
                    // Get frame content with cookies
                    const frameResponse = await axiosInstance.get(frameUrl, {
                        headers: {
                            ...axiosInstance.defaults.headers,
                            'Referer': url,
                            'Cookie': response.headers['set-cookie']?.join('; '),
                        }
                    });
              
                    if (frameResponse.status === 200) {
                        const frameData = cheerio.load(frameResponse.data);
                        
                        // Find the main table with the load data (the one with border=2)
                        const loadTable = frameData('table[border="2"]');
                        
                        if (loadTable.length) {
                            for (const element of loadTable.find('tr').toArray()) {
                                if (frameData(element).index() === 0) continue; // Skip header
                                
                                try {
                                    const row = frameData(element);
                                    const cells = row.find('td');
                                    
                                    const jobNumber = cells.eq(0).text().trim();
                                    if (!jobNumber) continue;

                                    // Get dates
                                    const moveDates = cells.eq(2).text().trim().split('\n');
                                    const pickupDateStr = moveDates[0];
                                    const deliveryDateStr = moveDates[1] || moveDates[0];

                                    // Parse the dates
                                    const pickupDate = parseDate(pickupDateStr);
                                    const deliveryDate = parseDate(deliveryDateStr);

                                    // Only create the load if we have valid dates
                                    if (!pickupDate || !deliveryDate) {
                                        console.error('Invalid dates:', { pickupDateStr, deliveryDateStr });
                                        continue; // Skip this row
                                    }

                                    // Get ZIP codes
                                    const originZip = cells.eq(6).text().trim();
                                    const destZip = cells.eq(8).text().trim();

                                    // Fetch location data using ZIP codes
                                    const [originLocation, destLocation] = await Promise.all([
                                        getLocationByZip(originZip),
                                        getLocationByZip(destZip)
                                    ]);

                                    // Extract other data
                                    const cfText = cells.eq(9).text().trim();
                                    const cfMatch = cfText.match(/(\d+)\s*cf\s*\/\s*(\d+)\s*lbs/);
                                    const cubicFeet = cfMatch ? parseInt(cfMatch[1]) : null;
                                    const weight = cfMatch ? parseInt(cfMatch[2]) : null;

                                    const miles = parseInt(cells.eq(10).text().trim()) || 0;
                                    const estimate = parseFloat(cells.eq(11).text().trim().replace('$', '').replace(',', '')) || 0;

                                    const dbLoadData = {
                                        userId: broker.id,
                                        loadType: 'RFP',
                                        status: 'ACTIVE',
                                        pickupLocation: originLocation.location,
                                        pickupZip: originZip,
                                        pickupDate: pickupDate,           // Use the parsed date
                                        deliveryLocation: destLocation.location,
                                        deliveryZip: destZip,
                                        deliveryDate: deliveryDate,       // Use the parsed date
                                        balance: estimate,
                                        cubicFeet: cubicFeet,
                                        rate: estimate,
                                        equipmentType: 'MOVING_TRUCK',
                                        details: {
                                            jobNumber,
                                            weight,
                                            source: 'LOADBOARD',
                                            sourceUrl: url,
                                            distance: miles,
                                            coordinates: {
                                                origin: originLocation.coordinates,
                                                destination: destLocation.coordinates
                                            }
                                        },
                                        mobilePhone: '561-201-7453'
                                    };

                                    // Add validation before creating
                                    if (!dbLoadData.deliveryLocation) {
                                        throw new Error('Delivery location is required');
                                    }

                                    // Debug log to verify dates
                                    console.log('Parsed dates:', {
                                        original: {
                                            pickup: pickupDateStr,
                                            delivery: deliveryDateStr
                                        },
                                        parsed: {
                                            pickup: pickupDate,
                                            delivery: deliveryDate
                                        }
                                    });

                                    // Check for existing load
                                    const existingLoad = await Load.findOne({
                                        where: {
                                            userId: broker.id,
                                            details: {
                                                jobNumber: jobNumber
                                            }
                                        }
                                    });

                                    if (!existingLoad && pickupDate && deliveryDate) {
                                        await Load.create(dbLoadData);
                                        totalLoadsSaved++;
                                    }

                                } catch (rowError) {
                                    console.error('Error processing row:', rowError);
                                    continue; // Skip this row and continue with next
                                }
                            }
                        }
                    }

                } catch (error) {
                    console.error(`Error processing URL ${url} for broker ${broker.id}:`, error);
                    scrapingSummary.push({
                        brokerId: broker.id,
                        companyName: broker.companyName,
                        error: error.message,
                        url
                    });
                }
            }
        }

        return res.json({
            status: 'success',
            message: `Successfully saved ${totalLoadsSaved} new loads`,
            summary: {
                brokersProcessed: brokers.length,
                totalLoadsSaved,
                details: scrapingSummary
            }
        });

    } catch (error) {
        console.error('Loadboard scraping error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Error scraping and saving loadboard data',
            error: error.message
        });
    }
}; 


async function scrapeLoadboard(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Set user agent to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Navigate to the URL
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait for the table to load
    await page.waitForSelector('table');

    // Extract data from the table
    const data = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tr'));
        return rows.map(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            return cells.map(cell => cell.innerText.trim());
        });
    });

    console.log(data);

    await browser.close();
}
