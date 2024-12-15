require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const logger = require('./utils/logger');
const path = require('path');

const app = express();

// Set the correct path to the fbuild directory
const buildPath = path.join(__dirname, '../fbuild'); // Correct path to the fbuild directory

// Serve static files from the fbuild directory
app.use(express.static(buildPath));

// Handle requests to the root (index.html)
app.get("*", function(req, res) {
  res.sendFile(path.join(buildPath, 'index.html'), function(err) {
    if (err) {
      res.status(500).send(err);
    }
  });
});


// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Logging Middleware
app.use(morgan('combined'));

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', routes);
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

const PORT = process.env.PORT || 7000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; 