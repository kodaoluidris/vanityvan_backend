require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const logger = require('./utils/logger');
const path = require('path');
const cors = require('cors');
const fileUpload = require('express-fileupload');

const app = express();


const corsOptions = {
  origin: 'https://mymovingmaps.com', // Replace with your frontend's URL
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, // Include cookies or authentication headers if needed
};

app.use(cors(corsOptions));

// 
// Security Middleware
app.use(helmet());

// Logging Middleware
app.use(morgan('combined'));

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Add this before your routes
app.use(fileUpload({
    createParentPath: true,
    limits: { 
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    },
}));
// API Routes
app.use('/api', routes);
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

const PORT = process.env.PORT || 9001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; 