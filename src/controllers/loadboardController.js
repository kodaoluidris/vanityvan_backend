const { User, Load } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');
const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');
const puppeteer = require('puppeteer');
const { getLocationByZip } = require('../utils/locationService');
const moment = require('moment');

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
            httpsAgent: new HttpsProxyAgent(`http://brd-customer-hl_3380cf13-zone-datacenter_proxy1:58s3ebtyqtb7@brd.superproxy.io:33335`),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
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
            attributes: ['id', 'companyName', 'loadBoardUrls', 'userType']
        });

        const axiosInstance = axios.create({
            httpsAgent: new HttpsProxyAgent(`http://brd-customer-hl_3380cf13-zone-datacenter_proxy1:58s3ebtyqtb7@brd.superproxy.io:33335`),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            },
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: status => true, // Accept all status codes to handle them manually
        });

        let totalLoadsSaved = 0;
        const scrapingSummary = [];
        const j_num = []; // To track job numbers

        const formatDate = (dateStr) => {
            if (!dateStr || !dateStr.trim()) return null;
        
            const dates = dateStr.match(/\d{2}\/\d{2}\/\d{4}/g); // Regex to match MM/DD/YYYY dates
            if (!dates) return null;
        
            return dates.map((date) => {
                const [month, day, year] = date.split('/');
                return `${month}-${day}-${year} :00:00:00`;
            });
        };

        if (broker) {
            for (const url of broker.loadBoardUrls) {
                try {
                    // Get the initial page
                    console.log('\n=== Processing Initial URL ===');
                    console.log('URL:', url);
                    const response = await axiosInstance.get(url);
                    console.log('Initial Response Status:', response.status);
                    
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

                    console.log('\n=== Frame URL Details ===');
                    console.log('Original frameSrc:', frameSrc);
                    console.log('Constructed frameUrl:', frameUrl);
                    console.log('URL origin:', new URL(url).origin);

                    // Try to get the frame content with modified headers
                    const frameResponse = await axiosInstance.get(frameUrl, {
                        headers: {
                            ...axiosInstance.defaults.headers,
                            'Referer': url,
                            'Host': new URL(frameUrl).hostname,
                            'Origin': new URL(url).origin,
                        }
                    });

                    console.log('\n=== Frame Response Details ===');
                    console.log('Status:', frameResponse.status);
                    console.log('Content Type:', frameResponse.headers['content-type']);
                    console.log('Content Length:', frameResponse.data.length);
                    console.log('Raw Content (first 500 chars):', frameResponse.data.substring(0, 500));

                    // Check if we got an error page
                    if (frameResponse.data.includes('An error occurred')) {
                        console.error('Received error page from server');
                        console.log('Full error content:', frameResponse.data);
                        throw new Error('Server returned error page');
                    }

                    const frameData = cheerio.load(frameResponse.data);

                    // Log all HTML elements to see structure
                    console.log('\n=== Page Structure ===');
                    console.log('Body content:', frameData('body').html());
                    
                    // Find all tables and their attributes
                    const tables = frameData('table');
                    console.log('\n=== All Tables ===');
                    console.log('Number of tables found:', tables.length);
                    tables.each((i, table) => {
                        const $table = frameData(table);
                        console.log(`\nTable ${i + 1}:`);
                        console.log('Attributes:', $table.attr());
                        console.log('First row content:', $table.find('tr:first').text());
                    });

                    // Try different table selectors
                    console.log('\n=== Table Selector Attempts ===');
                    console.log('Tables with border=2:', frameData('table[border="2"]').length);
                    console.log('Tables with any border:', frameData('table[border]').length);
                    console.log('All tables:', frameData('table').length);

                    // Extract phone number
                    const phoneNumber = frameData('table[border="0"] tr:nth-child(2) td b font').text().trim();
                    console.log('\n=== Phone Number ===');
                    console.log('Phone Number:', phoneNumber);

                    // Find the load table
                    const loadTable = frameData('table[border="2"]');
                    console.log('\n=== Load Table ===');
                    console.log('Load table found:', loadTable.length > 0);
                    if (loadTable.length > 0) {
                        console.log('Load table HTML:', loadTable.html());
                    }

                    if (!loadTable.length) {
                        console.error('No table found with border="2"');
                        // Try alternative selectors
                        console.log('\nTrying alternative selectors...');
                        const tableWithBorder = frameData('table[border]');
                        console.log('Tables with any border:', tableWithBorder.length);
                        tableWithBorder.each((i, table) => {
                            console.log(`Table ${i} border value:`, frameData(table).attr('border'));
                        });
                        continue;
                    }

                    // Process the table with load data
                    frameData('table[border="2"]').each(async (tableIndex, table) => {
                        const $table = frameData(table);
                        
                        // Skip if not the load table
                        if (!$table.find('tr:first-child td:first-child').text().includes('Job No.')) {
                            return;
                        }

                        // Process each row
                        $table.find('tr').each(async (index, element) => {
                            if (index === 0) return; // Skip header row

                            try {
                                const $row = frameData(element);
                                const cells = $row.find('td');

                                // Get all fields and log them
                                const jobNumber = cells.eq(0).text().trim();
                                const pickupLocation = cells.eq(5).text().trim();
                                const pickupZip = cells.eq(6).text().trim();
                                const deliveryLocation = cells.eq(7).text().trim();
                                const deliveryZip = cells.eq(8).text().trim();

                                console.log('\n=== Row Data Debug ===');
                                console.log('1. Basic Fields:', {
                                    jobNumber,
                                    pickupLocation,
                                    pickupZip,
                                    deliveryLocation,
                                    deliveryZip
                                });

                                // Get and format dates
                                const dateText = cells.eq(2).text().trim();
                                const formattedDates = formatDate(dateText);

                                console.log('2. Date Processing:', {
                                    rawDateText: dateText,
                                    formattedDates
                                });

                                // Parse CF and weight
                                const cfText = cells.eq(9).text().trim();
                                const cfMatch = cfText.match(/(\d+)\s*cf\s*\/\s*(\d+)\s*lbs/i);
                                const cubicFeet = cfMatch ? parseFloat(cfMatch[1]) : null;
                                const weight = cfMatch ? parseInt(cfMatch[2]) : null;

                                console.log('3. Measurements:', {
                                    rawCfText: cfText,
                                    cubicFeet,
                                    weight
                                });

                                // Parse rate
                                const rateText = cells.eq(11).text().trim();
                                const rate = parseFloat(rateText.replace(/[^0-9.]/g, '')) || 0;

                                const loadData = {
                                    userId: broker.id,
                                    loadType: 'RFP',
                                    status: 'ACTIVE',
                                    pickupLocation,
                                    pickupZip,
                                    pickupDate: formattedDates[0],
                                    deliveryLocation,
                                    deliveryZip,
                                    deliveryDate: formattedDates[1],
                                    balance: rate,
                                    cubicFeet,
                                    rate,
                                    equipmentType: 'SYNCED',
                                    jobNumber,
                                    details: {
                                        weight,
                                        source: 'LOADBOARD',
                                        sourceUrl: url,
                                        distance: parseInt(cells.eq(10).text().trim()) || 0,
                                        coordinates: {}
                                    },
                                    mobilePhone: phoneNumber??NULL // Use extracted phone number
                                };

                                console.log('4. Final Load Data:', JSON.stringify(loadData, null, 2));

                                // Try to find existing load
                                const existingLoad = await Load.findOne({
                                    where: { jobNumber }
                                });

                                if (existingLoad) {
                                    console.log('5. Updating existing load:', jobNumber);
                                    await existingLoad.update(loadData);
                                } else {
                                    console.log('5. Creating new load:', jobNumber);
                                    await Load.create(loadData);
                                    totalLoadsSaved++;
                                }

                                console.log('6. Operation completed successfully');

                            } catch (error) {
                                console.error('\n=== Error Processing Row ===');
                                console.error('Error message:', error.message);
                                console.error('Stack trace:', error.stack);
                                console.error('Row HTML:', $row?.html());
                            }
                        });
                    });

                } catch (error) {
                    console.error(`Error processing URL ${url}:`, error);
                    scrapingSummary.push({
                        brokerId: broker.id,
                        companyName: broker.companyName,
                        error: error.message,
                        url
                    });
                }
            }

            // After processing all loads, update status of old loads
            if (j_num.length > 0) {
                await Load.update(
                    { status: 'COMPLETED' },
                    {
                        where: {
                            userId: broker.id,
                            status: 'ACTIVE',
                            jobNumber: {
                                [Op.notIn]: j_num
                            }
                        }
                    }
                );
            }
        }

        return res.json({
            status: 'success',
            message: `Successfully saved ${totalLoadsSaved} new loads`,
            summary: {
                brokersProcessed: broker ? broker.loadBoardUrls.length : 0,
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
        const users = await User.findAll({
            where: {
                loadBoardUrls: {
                    [Op.ne]: []
                }
            },
            attributes: ['id', 'companyName', 'loadBoardUrls', 'userType']
        });

        const axiosInstance = axios.create({
            httpsAgent: new HttpsProxyAgent(`http://brd-customer-hl_3380cf13-zone-datacenter_proxy1:58s3ebtyqtb7@brd.superproxy.io:33335`),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            },
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: status => true, // Accept all status codes to handle them manually
        });

        let totalLoadsSaved = 0;
        const scrapingSummary = [];
        const allJobNumbers = {};  // Track job numbers per user

        // Reuse the same parsing functions
        const formatDate = (dateStr) => {
            if (!dateStr || !dateStr.trim()) return null;
            
            const [month, day, year] = dateStr.trim().split('/');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} 00:00:00`;
        };

        for (const user of users) {
            console.log(`Processing user ${user.id} with company ${user.companyName}`);
            allJobNumbers[user.id] = [];  // Initialize job numbers array for this user

            for (const url of user.loadBoardUrls) {
                try {
                    // Use the same scraping logic as scrapeAndSaveLoadboardData
                    const response = await axiosInstance.get(url);
                    const $ = cheerio.load(response.data);
                    
                    const frameSrc = $('frame[name="BODY"]').attr('src');
                    if (!frameSrc) {
                        console.log('No frame found with name "BODY"');
                        continue;
                    }

                    const frameUrl = frameSrc.startsWith('http') 
                        ? frameSrc 
                        : frameSrc.startsWith('/') 
                            ? `${new URL(url).origin}${frameSrc}`
                            : `${new URL(url).origin}/${frameSrc}`;

                    const frameResponse = await axiosInstance.get(frameUrl, {
                        headers: {
                            ...axiosInstance.defaults.headers,
                            'Referer': url,
                            'Cookie': response.headers['set-cookie']?.join('; '),
                        }
                    });

                    // Same verification and retry logic
                    let retryCount = 0;
                    let frameData;
                    let loadTable;

                    while (retryCount < 5) { // Increased retries to 5
                        try {
                            await delay(3000); // Wait 3 seconds between attempts
                            
                            const newResponse = await axiosInstance.get(frameUrl, {
                                headers: {
                                    ...axiosInstance.defaults.headers,
                                    'Referer': url,
                                    'Cookie': response.headers['set-cookie']?.join('; '),
                                }
                            });
                            
                            frameData = cheerio.load(newResponse.data);
                            loadTable = frameData('table[border="2"]');
                            
                            // Check if we got the expected content
                            if (loadTable.length > 0 && loadTable.find('tr').length > 1) {
                                console.log('Successfully loaded table with data');
                                frameResponse.data = newResponse.data;
                                break;
                            }
                            
                            console.log(`Content not fully loaded, attempt ${retryCount + 1} of 5`);
                            retryCount++;
                            
                        } catch (retryError) {
                            console.error('Retry attempt failed:', retryError.message);
                            retryCount++;
                            await delay(5000); // Wait longer after an error
                        }
                    }

                    if (!loadTable || loadTable.length === 0) {
                        console.error('Failed to load table data after all retries');
                        throw new Error('Failed to load table data');
                    }

                    if (frameResponse.status === 200) {
                        const frameData = cheerio.load(frameResponse.data);
                        const phoneNumber = frameData('table[border="0"] tr:nth-child(2) td b font').text().trim();
                        const loadTable = frameData('table[border="2"]');

                        if (loadTable.length) {
                            const headerRow = frameData(loadTable.find('tr').first());
                            const headers = headerRow.find('td').map((i, el) => frameData(el).text().trim()).get();
                            const isNewFormat = headers.includes('CF') && headers.includes('Lbs');
                            
                            for (const element of loadTable.find('tr').toArray()) {
                                if (frameData(element).index() === 0) continue;
                                
                                try {
                                    console.log('\n=== Processing Row ===');
                                    const row = frameData(element);
                                    const cells = row.find('td');
                                    
                                    const jobNumber = cells.eq(0).text().trim();
                                    if (!jobNumber) continue;
                                    
                                    allJobNumbers[user.id].push(jobNumber);

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
                                    
                                    const pickupDate = formatDate(pickupDateStr?.trim());
                                    const deliveryDate = formatDate(deliveryDateStr?.trim());
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

                                    switch(user.userType){
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
                                        userId: user.id,
                                        loadType: loadType,
                                        status: 'ACTIVE',
                                        pickupLocation: originLocation.location,
                                        pickupZip: originZip,
                                        pickupDate,
                                        deliveryLocation: destLocation.location,
                                        deliveryZip: destZip,
                                        deliveryDate,
                                        balance: estimate,
                                        cubicFeet: cubicFeet,
                                        rate: estimate,
                                        equipmentType: 'SYNCED',
                                        details: {
                                            miles: parseInt($row.find('td:eq(10)').text().trim()),
                                            weight: parseInt($row.find('td:eq(9)').text().match(/(\d+)\s*lbs/)[1])
                                        },
                                        mobilePhone: phoneNumber??NULL // Use extracted phone number
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
                                    console.error(`Error processing row for user ${user.id}:`, rowError);
                                }
                            }
                        }
                    }

                } catch (error) {
                    console.error(`Error processing URL ${url} for user ${user.id}:`, error);
                    scrapingSummary.push({
                        userId: user.id,
                        companyName: user.companyName,
                        error: error.message,
                        url
                    });
                }
            }

            // Update status of loads not found in current sync for this user
            const loadsToUpdate = await Load.findAll({
                where: {
                    userId: user.id,
                    status: 'ACTIVE',
                    jobNumber: {
                        [Op.notIn]: allJobNumbers[user.id],
                        [Op.not]: null
                    }
                }
            });

            for (const load of loadsToUpdate) {
                await load.update({ status: 'COMPLETED' });
            }
        }

        return res.json({
            status: 'success',
            message: `Successfully saved ${totalLoadsSaved} new loads`,
            summary: {
                usersProcessed: users.length,
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

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
