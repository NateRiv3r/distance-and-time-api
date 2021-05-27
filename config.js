require('dotenv').config();
const config = {
  apiEndpoint: process.env.API_URL,
  googleMapKey: process.env.GOOGLE_API_KEY,
  port: process.env.API_PORT
};
module.exports = config;
