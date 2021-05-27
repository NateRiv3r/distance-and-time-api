const express = require("express");
const axios = require('axios');

const app = express();

// environments variables
const {port, apiEndpoint, googleMapKey} = require('./config');

// API base Url
const baseURL = `http://${apiEndpoint}:${port}/`;

// Middleware to parse POST requests
app.use(express.json())

// Asynchronous function to retrieve Map data
async function getMapData(data) {
    const targetDate = new Date() // Current date/time
    const timestamp = targetDate.getTime() / 1000 + targetDate.getTimezoneOffset() * 60 // Current UTC date/time expressed as seconds
    try {
        const [startTimezoneRequest, endTimezoneRequest, distanceRequest] = await axios.all([
            axios.get(`https://maps.googleapis.com/maps/api/timezone/json?location=${data.start.lat},${data.start.lng}&timestamp=${timestamp}&key=${googleMapKey}`),
            axios.get(`https://maps.googleapis.com/maps/api/timezone/json?location=${data.end.lat},${data.end.lng}&timestamp=${timestamp}&key=${googleMapKey}`),
            axios.get(`https://maps.googleapis.com/maps/api/distancematrix/json?units=${data.units}&origins=${data.start.lat},${data.start.lng}&destinations=${data.end.lat},${data.end.lng}&key=${googleMapKey}`),
        ]);

        if (distanceRequest.data.status === 'OK' && startTimezoneRequest.data.status === 'OK' && endTimezoneRequest.data.status === 'OK') {
            // Parsing of responses data
            const start = distanceRequest.data.origin_addresses[0].split(/[\s,]+/);
            const start_country = start[start.length - 1];
            const end = distanceRequest.data.destination_addresses[0].split(/[\s,]+/);
            const end_country = end[end.length - 1];
            const matrix = distanceRequest.data.rows;
            const startTimezoneOffset = startTimezoneRequest.data.rawOffset;
            const endTimezoneOffset = endTimezoneRequest.data.rawOffset;
            const startTimezoneDst = Math.round(startTimezoneOffset / 3600);
            const endTimezoneDst = Math.round(endTimezoneOffset / 3600);


            if (matrix[0].elements[0].status === "ZERO_RESULTS") {
                return JSON.stringify({"Google API request error": "No route could be found between the start and end."})
            }
            if (matrix[0].elements[0].status === "NOT_FOUND") {
                return JSON.stringify({"Google API request error": "The origin and/or destination of this pairing could not be geocoded."})
            }
            if (matrix[0].elements[0].status === "MAX_ROUTE_LENGTH_EXCEEDED") {
                return JSON.stringify({"Google API request error": "The requested route is too long and cannot be processed."})
            }

            const limit_hour = 60; // one hour in minutes
            const limit_km = 1000; // on kilometer in meters

            const distance_value = matrix[0].elements[0].distance.value; // distance value
            const time_value = matrix[0].elements[0].duration.value; // time value in seconds
            const time_diff_value = time_value >= 3600 ? Math.round(time_value / 3600) : Math.round(time_value / 60); // get the time value and round it

            // getting distance and time units
            const distance_units = limit_km >= distance_value ? "m" : "km";
            const time_diff_units = time_value / 60 >= limit_hour ? "hours" : "minutes";


            // return api data
            return {
                start: {
                    country: start_country,
                    timezone: `GMT+${startTimezoneDst}`,
                    location: {lat: data.start.lat, lng: data.start.lng}
                },
                end: {
                    country: end_country,
                    timezone: `GMT+${endTimezoneDst}`,
                    location: {lat: data.end.lat, lng: data.end.lng}
                },
                distance: {
                    value: distance_value,
                    units: distance_units
                },
                time_diff: {
                    value: time_diff_value,
                    units: time_diff_units
                }
            };
        }
        return {"Google API request error": "Something looking wrong with the API.."};

    } catch (error) {
        // log the error
        return error;
    }
}

app.get('/api/', (req, res) => {
    res.status(200).send("A simple API that return country, timezone info and the time difference in hours between two geolocations.");
});

app.post('/api/get_distance_and_time', (req, res) => {
    const data = req.body;
    (async () => {
        const map_data = await getMapData(data); // getting map data
        res.status(200).json(map_data); // send response
    })()
});

app.listen(port, () => {
    console.log(`API Server running on ${baseURL}`);
});
