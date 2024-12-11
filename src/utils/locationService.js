const axios = require('axios');

const getLocationByZip = async (zip) => {
  try {
    const response = await axios.get(`https://api.zippopotam.us/us/${zip}`);
    if (response.status !== 200) {
      throw new Error('Invalid ZIP code');
    }
    
    const data = response.data;
    const place = data.places[0];
    
    return {
      city: place['place name'],
      state: place['state abbreviation'],
      location: `${place['place name']}, ${place['state abbreviation']}`,
      coordinates: {
        latitude: place.latitude,
        longitude: place.longitude
      }
    };
  } catch (error) {
    console.error('ZIP code lookup error:', error);
    throw new Error('Unable to fetch location');
  }
};

module.exports = { getLocationByZip }; 