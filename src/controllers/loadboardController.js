const { User } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');
const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');
const puppeteer = require('puppeteer');

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
                            // Process each row after the header
                            loadTable.find('tr').each((index, element) => {
                                if (index === 0) return; // Skip header row
                                
                                try {
                                    const row = frameData(element);
                                    const cells = row.find('td');
                                    
                                    // Only process rows that have data
                                    const jobNumber = cells.eq(0).text().trim();
                                    if (!jobNumber) return;

                                    // Extract move dates
                                    const moveDates = cells.eq(2).text().trim().split('\n');
                                    const pickupDate = moveDates[0];
                                    const deliveryDate = moveDates[1] || moveDates[0];

                                    // Extract origin location
                                    const originText = cells.eq(5).text().trim().replace(/\s+/g, ' ');
                                    const [originCity, originState] = originText.split(',').map(s => s.trim());
                                    const originZip = cells.eq(6).text().trim();

                                    // Extract destination location
                                    const destText = cells.eq(7).text().trim().replace(/\s+/g, ' ');
                                    const [destCity, destState] = destText.split(',').map(s => s.trim());
                                    const destZip = cells.eq(8).text().trim();

                                    // Extract cubic feet and weight
                                    const cfText = cells.eq(9).text().trim();
                                    const cfMatch = cfText.match(/(\d+)\s*cf\s*\/\s*(\d+)\s*lbs/);
                                    const cubicFeet = cfMatch ? parseInt(cfMatch[1]) : null;
                                    const weight = cfMatch ? parseInt(cfMatch[2]) : null;

                                    // Extract miles and estimate
                                    const miles = parseInt(cells.eq(10).text().trim()) || 0;
                                    const estimate = parseFloat(cells.eq(11).text().trim().replace('$', '').replace(',', '')) || 0;

                                    brokerLoads.push({
                                        jobNumber,
                                        userId: broker.id,
                                        status: 'PENDING',
                                        loadType: 'BROKER_LOAD',
                                        pickupDate,
                                        deliveryDate,
                                        originAddress: {
                                            city: originCity,
                                            state: originState,
                                            zipCode: originZip,
                                            country: 'USA'
                                        },
                                        destinationAddress: {
                                            city: destCity,
                                            state: destState,
                                            zipCode: destZip,
                                            country: 'USA'
                                        },
                                        cubicFeet,
                                        weight,
                                        distance: miles,
                                        rate: estimate,
                                        source: 'LOADBOARD',
                                        sourceUrl: url,
                                        mobilePhone: '561-201-7453' // Added from the header phone number
                                    });

                                } catch (rowError) {
                                    console.error('Error processing row:', rowError);
                                }
                            });

                            // Save loads to database
                            for (const loadData of brokerLoads) {
                                try {
                                    const existingLoad = await Load.findOne({
                                        where: {
                                            jobNumber: loadData.jobNumber,
                                            userId: broker.id
                                        }
                                    });

                                    if (!existingLoad) {
                                        await Load.create(loadData);
                                        totalLoadsSaved++;
                                    }
                                } catch (saveError) {
                                    console.error('Error saving load:', saveError);
                                }
                            }

                            scrapingSummary.push({
                                brokerId: broker.id,
                                companyName: broker.companyName,
                                loadsFound: brokerLoads.length,
                                url
                            });
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
