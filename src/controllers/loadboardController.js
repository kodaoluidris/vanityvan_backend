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
        var j_num = [];
        if (broker) {
            console.log(broker.loadBoardUrls, broker.loadBoardUrls.length, "broker.loadBoardUrls")
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

                    // Add verification and retry logic here
                    let retryCount = 0;
                    let frameData;
                    while (retryCount < 3) {
                        frameData = cheerio.load(frameResponse.data);
                        const loadTable = frameData('table[border="2"]');
                        
                        if (loadTable.length > 0) {
                            break; // Content loaded successfully
                        }
                        
                        console.log(`Content not fully loaded, attempt ${retryCount + 1} of 3`);
                        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
                        retryCount++;
                        
                        if (retryCount < 3) {
                            const newResponse = await axiosInstance.get(frameUrl, {
                                headers: {
                                    ...axiosInstance.defaults.headers,
                                    'Referer': url,
                                    'Cookie': response.headers['set-cookie']?.join('; '),
                                }
                            });
                            frameResponse.data = newResponse.data;
                        }
                    }

                    if (frameResponse.status === 200) {
                        const frameData = cheerio.load(frameResponse.data);

                        // Extract phone number from the table with border="0"
                        const phoneNumber = frameData('table[border="0"] tr:nth-child(2) td b font').text().trim();
                        console.log('Extracted Phone Number:', phoneNumber);

                        // Find the main table with the load data (the one with border=2)
                        const loadTable = frameData('table[border="2"]');
                        // console.log('load table:', loadTable);
                        if (loadTable.length) {
                            // Get headers to detect format
                            const headerRow = frameData(loadTable.find('tr').first());
                            const headers = headerRow.find('td').map((i, el) => frameData(el).text().trim()).get();
                            
                            // Check if it's the new format by looking for separate CF and Lbs columns
                            const isNewFormat = headers.includes('CF') && headers.includes('Lbs');
                            
                            for (const element of loadTable.find('tr').toArray()) {
                                if (frameData(element).index() === 0) continue; // Skip header
                                
                                try {
                                    console.log('\n=== Processing Row ===');
                                    const row = frameData(element);
                                    const cells = row.find('td');
                                    
                                    const jobNumber = cells.eq(0).text().trim();
                                    if (!jobNumber) continue;
                                    else j_num.push(jobNumber);
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

                                    // Modified location and data extraction based on format
                                    let originZip, destZip, originLocation, destLocation, cubicFeet, weight, miles, estimate;

                                    if (isNewFormat) {
                                        // Parse location with ZIP code included in the cell
                                        const fromText = cells.eq(5).text().trim();
                                        const toText = cells.eq(7).text().trim();
                                        
                                        // Extract ZIP from location string
                                        originZip = fromText.match(/\d{5}$/)?.[0] || '';
                                        destZip = toText.match(/\d{5}$/)?.[0] || '';

                                        // Get location data
                                        [originLocation, destLocation] = await Promise.all([
                                            getLocationByZip(originZip),
                                            getLocationByZip(destZip)
                                        ]);

                                        // Handle separate CF and Lbs columns
                                        cubicFeet = parseInt(cells.eq(8).text().trim()) || null;
                                        weight = parseInt(cells.eq(9).text().trim()) || null;
                                        miles = parseInt(cells.eq(10).text().trim()) || 0;
                                        estimate = parseFloat(cells.eq(11).text().trim().replace('$', '').replace(',', '')) || 0;
                                    } else {
                                        // Original format processing
                                        originZip = cells.eq(6).text().trim();
                                        destZip = cells.eq(8).text().trim();
                                        
                                        [originLocation, destLocation] = await Promise.all([
                                            getLocationByZip(originZip),
                                            getLocationByZip(destZip)
                                        ]);

                                        const cfText = cells.eq(9).text().trim();
                                        const cfMatch = cfText.match(/(\d+)\s*cf\s*\/\s*(\d+)\s*lbs/);
                                        cubicFeet = cfMatch ? parseInt(cfMatch[1]) : null;
                                        weight = cfMatch ? parseInt(cfMatch[2]) : null;
                                        miles = parseInt(cells.eq(10).text().trim()) || 0;
                                        estimate = parseFloat(cells.eq(11).text().trim().replace('$', '').replace(',', '')) || 0;
                                    }

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

        console.log('j_num:', j_num);
        // update loads that are in the db and not coming again from sync
        const loadToUpdate = await Load.findAll(
            {
                where: {
                    user_id: req.userData.userId,
                    status: 'ACTIVE', 
                    [Op.and]: [
                        {
                            job_number: {
                                [Op.notIn]: j_num,
                                [Op.not]: null
                            }
                        }
                    ]
                }
            }
        );
            // Update each load individually to preserve existing data
        console.log('loadToUpdate:', loadToUpdate);
        for (const load of loadToUpdate) {
            await load.update({ status: 'COMPLETED' });
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
        const users = await User.findAll({
            where: {
                loadBoardUrls: {
                    [Op.ne]: []
                }
            },
            attributes: ['id', 'companyName', 'loadBoardUrls', 'userType']
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
        const allJobNumbers = {};  // Track job numbers per user

        // Reuse the same parsing functions
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
                    while (retryCount < 3) {
                        frameData = cheerio.load(frameResponse.data);
                        const loadTable = frameData('table[border="2"]');
                        
                        if (loadTable.length > 0) break;
                        
                        console.log(`Content not fully loaded, attempt ${retryCount + 1} of 3`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        retryCount++;
                        
                        if (retryCount < 3) {
                            const newResponse = await axiosInstance.get(frameUrl, {
                                headers: {
                                    ...axiosInstance.defaults.headers,
                                    'Referer': url,
                                    'Cookie': response.headers['set-cookie']?.join('; '),
                                }
                            });
                            frameResponse.data = newResponse.data;
                        }
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
