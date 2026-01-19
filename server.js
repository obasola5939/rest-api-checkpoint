// server.js
/**
 * Main Server File
 * Entry point for the Express REST API application
 * Configures middleware, sets up routes, and starts the server
 */

// Load environment variables from .env file
require('dotenv').config({ path: './config/.env' });

// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const database = require('./config/database');
const userRoutes = require('./routes/userRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Initialize Express application
const app = express();

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

/**
 * 1. CORS (Cross-Origin Resource Sharing)
 * Allows requests from different origins (domains)
 * Configures which origins can access the API
 */
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Allow cookies and authentication headers
}));

/**
 * 2. Request Logging
 * Logs HTTP requests for debugging and monitoring
 * Uses Morgan middleware with custom format
 */
app.use(morgan(':method :url :status :response-time ms - :res[content-length]', {
  skip: (req) => req.url === '/health' // Skip logging for health checks
}));

/**
 * 3. Body Parsing Middleware
 * Parses incoming request bodies in JSON format
 * Limits request size to prevent abuse
 */
app.use(express.json({
  limit: '10mb', // Limit request body size to 10MB
  strict: true // Only accept arrays and objects
}));

app.use(express.urlencoded({
  extended: true, // Use qs library for parsing
  limit: '10mb'
}));

// ============================================
// HEALTH CHECK ENDPOINTS
// ============================================

/**
 * Health Check Route
 * Returns server status and database connection info
 * Useful for monitoring and load balancers
 */
app.get('/health', async (req, res) => {
  try {
    // Get database health status
    const dbHealth = await database.healthCheck();
    
    // Prepare health response
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbHealth,
      environment: process.env.NODE_ENV,
      version: process.version
    };
    
    // Determine overall health status
    const isHealthy = dbHealth.status === 'healthy';
    healthStatus.status = isHealthy ? 'healthy' : 'degraded';
    
    res.status(isHealthy ? 200 : 503).json(healthStatus);
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      database: { status: 'unreachable' }
    });
  }
});

/**
 * Root Route
 * Simple welcome message and API documentation
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to User Management REST API',
    version: '1.0.0',
    documentation: {
      endpoints: {
        users: '/api/users',
        health: '/health'
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================
// API ROUTES
// ============================================

/**
 * User Management Routes
 * All user-related endpoints are prefixed with /api/users
 */
const API_PREFIX = process.env.API_PREFIX || '/api';
app.use(`${API_PREFIX}/users`, userRoutes);

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

/**
 * 404 Not Found Handler
 * Catches requests to undefined routes
 */
app.use(notFound);

/**
 * Global Error Handler
 * Catches and formats all errors in the application
 */
app.use(errorHandler);

// ============================================
// SERVER INITIALIZATION
// ============================================

/**
 * Start Server Function
 * Connects to database and starts the Express server
 */
async function startServer() {
  try {
    console.log('🚀 Starting User Management REST API...');
    console.log('='.repeat(50));
    
    // Display configuration
    console.log('⚙️  Configuration:');
    console.log(`   Environment: ${process.env.NODE_ENV}`);
    console.log(`   Port: ${process.env.PORT}`);
    console.log(`   API Prefix: ${API_PREFIX}`);
    console.log(`   Database URI: ${process.env.MONGODB_URI ? 'Set (hidden for security)' : 'Not set'}`);
    
    // Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    await database.connect();
    
    // Get the port from environment or default to 3000
    const PORT = process.env.PORT || 3000;
    
    // Start Express server
    const server = app.listen(PORT, () => {
      console.log('\n✅ Server is running!');
      console.log('='.repeat(50));
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
      console.log(`📚 API Documentation:`);
      console.log(`   GET  ${API_PREFIX}/users       - Get all users`);
      console.log(`   POST ${API_PREFIX}/users       - Create new user`);
      console.log(`   GET  ${API_PREFIX}/users/:id   - Get user by ID`);
      console.log(`   PUT  ${API_PREFIX}/users/:id   - Update user by ID`);
      console.log(`   DELETE ${API_PREFIX}/users/:id - Delete user by ID`);
      console.log(`   GET  /health                   - Health check`);
      console.log('='.repeat(50));
      console.log('📋 Ready to accept requests...\n');
    });
    
    // Graceful shutdown handler
    const gracefulShutdown = async () => {
      console.log('\n⚠️  Shutting down gracefully...');
      
      // Close server
      server.close(async () => {
        console.log('✅ HTTP server closed');
        
        // Close database connection
        await database.disconnect();
        
        console.log('👋 Goodbye!');
        process.exit(0);
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };
    
    // Listen for termination signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown();
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server if this file is executed directly
if (require.main === module) {
  startServer();
}

// Export app for testing
module.exports = app;
