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
        const broker = await User.findOne({
            where: {
                id: req.userData.userId,
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

        const parseCompoundDate = (dateStr) => {
            if (!dateStr) return null;
            const dates = dateStr.match(/(\d{2}\/\d{2}\/\d{4})/g);
            return dates;
        };

        const parseDate = (dateStr) => {
            if (!dateStr) return null;
            const [month, day, year] = dateStr.split('/');
            if (!month || !day || !year) return null;
            const mysqlDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} 00:00:00`;
            const testDate = new Date(mysqlDate);
            return isNaN(testDate.getTime()) ? null : mysqlDate;
        };

        if (broker) {
            for (const url of broker.loadBoardUrls) {
                try {
                    const brokerLoads = [];
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

                        // Extract phone number from the table with border="0"
                        const phoneNumber = frameData('table[border="0"] tr:nth-child(2) td b font').text().trim();
                        console.log('Extracted Phone Number:', phoneNumber);

                        // Find the main table with the load data (the one with border=2)
                        const loadTable = frameData('table[border="2"]');
                        
                        if (loadTable.length) {
                            for (const element of loadTable.find('tr').toArray()) {
                                if (frameData(element).index() === 0) continue; // Skip header
                                
                                try {
                                    console.log('\n=== Processing Row ===');
                                    const row = frameData(element);
                                    const cells = row.find('td');
                                    
                                    const jobNumber = cells.eq(0).text().trim();
                                    if (!jobNumber) continue;

                                    // Check if the job number already exists
                                    const existingLoad = await Load.findOne({
                                        where: { jobNumber }
                                    });
                                    if (existingLoad) {
                                        console.log(`Job number ${jobNumber} already exists, skipping.`);
                                        continue;
                                    }

                                    // Get dates
                                    const dateText = cells.eq(2).text().trim();
                                    console.log('Original date text from cell:', dateText);
                                    
                                    const dates = parseCompoundDate(dateText);
                                    console.log('Parsed compound dates:', dates);
                                    
                                    if (!dates || dates.length === 0) {
                                        console.log('No valid dates found, skipping row');
                                        return;
                                    }
                                    
                                    const pickupDateStr = dates[0];
                                    const deliveryDateStr = dates[1] || dates[0];
                                    console.log('Selected date strings:', { pickup: pickupDateStr, delivery: deliveryDateStr });
                                    
                                    const pickupDate = parseDate(pickupDateStr);
                                    const deliveryDate = parseDate(deliveryDateStr);
                                    console.log('Final parsed dates:', { pickup: pickupDate, delivery: deliveryDate });
                                    
                                    if (!pickupDate || !deliveryDate) {
                                        console.log('Invalid dates after parsing, skipping row');
                                        return;
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
                                    
                                    switch(broker.userType){
                                        case 'BROKER':
                                            loadType = 'RFP';
                                            break;
                                        case 'RFP_CARRIER':
                                            loadType = 'RFD';
                                            break;
                                        case 'RFD_CARRIER':
                                            loadType = 'TRUCK';
                                            break;
                                        default:
                                            loadType='RFP'
                                    }

                                    const dbLoadData = {
                                        userId: broker.id,
                                        loadType: loadType,
                                        status: 'ACTIVE',
                                        pickupLocation: originLocation.location,
                                        pickupZip: originZip,
                                        pickupDate: pickupDate,
                                        deliveryLocation: destLocation.location,
                                        deliveryZip: destZip,
                                        deliveryDate: deliveryDate,
                                        balance: estimate,
                                        cubicFeet: cubicFeet,
                                        rate: estimate,
                                        equipmentType: 'SYNCED',
                                        jobNumber: jobNumber, // Add job number here
                                        details: {
                                            weight,
                                            source: 'LOADBOARD',
                                            sourceUrl: url,
                                            distance: miles,
                                            coordinates: {
                                                origin: originLocation.coordinates,
                                                destination: destLocation.coordinates
                                            }
                                        },
                                        mobilePhone: phoneNumber??NULL // Use extracted phone number
                                    };

                                    console.log('\n=== Final Data Check ===');
                                    console.log('pickupDate type:', typeof dbLoadData.pickupDate);
                                    console.log('pickupDate type:', typeof dbLoadData.pickupDate);
                                    console.log('pickupDate value:', dbLoadData.pickupDate);
                                    console.log('deliveryDate type:', typeof dbLoadData.deliveryDate);
                                    console.log('deliveryDate value:', dbLoadData.deliveryDate);
                                    console.log('deliphoneNumberveryDate value:', dbLoadData.phoneNumber);

                                    // Before creating the load, log the exact data being sent
                                    console.log('\n=== Database Insert Data ===');
                                    console.log(JSON.stringify(dbLoadData, null, 2));

                                    // Create the load
                                    const createdLoad = await Load.create(dbLoadData);
                                    console.log('\n=== Load Created Successfully ===');
                                    console.log('Created Load ID:', createdLoad.id);
                                    
                                    totalLoadsSaved++;

                                } catch (rowError) {
                                    console.error('\n=== Error Processing Row ===');
                                    console.error('Error details:', {
                                        message: rowError.message,
                                        stack: rowError.stack,
                                        sqlMessage: rowError.sqlMessage,
                                        sql: rowError.sql,
                                        parameters: rowError.parameters
                                    });
                                    throw rowError;
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
                brokersProcessed: broker.loadBoardUrls.length,
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


exports.scrapeAndSaveAllLoadboardData = async (req, res) => {
    try {
        const brokers = await User.findAll({
            where: {
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
        const parseCompoundDate = (dateStr) => {
            console.log('\n=== parseCompoundDate ===');
            console.log('Input dateStr:', dateStr);
            
            if (!dateStr) {
                console.log('Empty date string received');
                return null;
            }
            
            const dates = dateStr.match(/(\d{2}\/\d{2}\/\d{4})/g);
            console.log('Matched dates:', dates);
            
            if (!dates) {
                console.log('No dates matched the pattern');
                return null;
            }

            return dates;
        };

        const parseDate = (dateStr) => {
            console.log('\n=== parseDate ===');
            console.log('Input dateStr:', dateStr);
            
            if (!dateStr) {
                console.log('Empty date string received');
                return null;
            }
            
            // Expected format: MM/DD/YYYY
            const [month, day, year] = dateStr.split('/');
            console.log('Split date parts:', { month, day, year });
            
            if (!month || !day || !year) {
                console.log('Invalid date parts');
                return null;
            }

            try {
                // Create date string in MySQL format
                const mysqlDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} 00:00:00`;
                console.log('Formatted MySQL date:', mysqlDate);
                
                // Validate the date by trying to parse it
                const testDate = new Date(mysqlDate);
                if (isNaN(testDate.getTime())) {
                    console.log('Invalid date created');
                    return null;
                }
                
                return mysqlDate;
            } catch (error) {
                console.error('Error formatting date:', error);
                return null;
            }
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
                                    console.log('\n=== Processing Row ===');
                                    const row = frameData(element);
                                    const cells = row.find('td');
                                    
                                    const jobNumber = cells.eq(0).text().trim();
                                    if (!jobNumber) continue;

                                    // Get dates
                                    const dateText = cells.eq(2).text().trim();
                                    console.log('Original date text from cell:', dateText);
                                    
                                    const dates = parseCompoundDate(dateText);
                                    console.log('Parsed compound dates:', dates);
                                    
                                    if (!dates || dates.length === 0) {
                                        console.log('No valid dates found, skipping row');
                                        return;
                                    }
                                    
                                    const pickupDateStr = dates[0];
                                    const deliveryDateStr = dates[1] || dates[0];
                                    console.log('Selected date strings:', { pickup: pickupDateStr, delivery: deliveryDateStr });
                                    
                                    const pickupDate = parseDate(pickupDateStr);
                                    const deliveryDate = parseDate(deliveryDateStr);
                                    console.log('Final parsed dates:', { pickup: pickupDate, delivery: deliveryDate });
                                    
                                    if (!pickupDate || !deliveryDate) {
                                        console.log('Invalid dates after parsing, skipping row');
                                        return;
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

                                    switch(broker.userType){
                                        case 'BROKER':
                                            loadType = 'RFP';
                                            break;
                                        case 'RFP_CARRIER':
                                            loadType = 'RFD';
                                            break;
                                        case 'RFD_CARRIER':
                                            loadType = 'TRUCK';
                                            break;
                                        default:
                                            loadType='RFP'
                                    }

                                    const dbLoadData = {
                                        userId: broker.id,
                                        loadType: loadType,
                                        status: 'ACTIVE',
                                        pickupLocation: originLocation.location,
                                        pickupZip: originZip,
                                        pickupDate: pickupDate,
                                        deliveryLocation: destLocation.location,
                                        deliveryZip: destZip,
                                        deliveryDate: deliveryDate,
                                        balance: estimate,
                                        cubicFeet: cubicFeet,
                                        rate: estimate,
                                        equipmentType: 'SYNCED',
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

                                    console.log('\n=== Final Data Check ===');
                                    console.log('pickupDate type:', typeof dbLoadData.pickupDate);
                                    console.log('pickupDate value:', dbLoadData.pickupDate);
                                    console.log('deliveryDate type:', typeof dbLoadData.deliveryDate);
                                    console.log('deliveryDate value:', dbLoadData.deliveryDate);

                                    // Before creating the load, log the exact data being sent
                                    console.log('\n=== Database Insert Data ===');
                                    console.log(JSON.stringify(dbLoadData, null, 2));

                                    // Create the load
                                    const createdLoad = await Load.create(dbLoadData);
                                    console.log('\n=== Load Created Successfully ===');
                                    console.log('Created Load ID:', createdLoad.id);
                                    
                                    totalLoadsSaved++;

                                } catch (rowError) {
                                    console.error('\n=== Error Processing Row ===');
                                    console.error('Error details:', {
                                        message: rowError.message,
                                        stack: rowError.stack,
                                        sqlMessage: rowError.sqlMessage,
                                        sql: rowError.sql,
                                        parameters: rowError.parameters
                                    });
                                    throw rowError;
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
