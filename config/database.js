// config/database.js
const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Database Connection Manager
 * Handles MongoDB connection using Mongoose with robust error handling
 * and connection management
 */
class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.connection = null;
    this.maxRetries = 3; // Maximum connection retry attempts
    this.retryCount = 0;
  }

  /**
   * Establishes connection to MongoDB
   * Supports both local MongoDB and MongoDB Atlas
   * 
   * @returns {Promise<mongoose.Connection>} MongoDB connection instance
   * @throws {Error} If connection fails after max retries
   */
  async connect() {
    try {
      // Validate that MONGODB_URI is set in environment variables
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined in environment variables');
      }

      // Clean the URI (remove quotes if present)
      const mongoUri = process.env.MONGODB_URI.replace(/['"]+/g, '');

      console.log('🔌 Attempting to connect to MongoDB...');
      
      // Connection options for optimal performance and reliability
      const connectionOptions = {
        useNewUrlParser: true,      // Use new URL string parser
        useUnifiedTopology: true,   // Use new server discovery and monitoring engine
        serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
        socketTimeoutMS: 45000,     // Close sockets after 45 seconds of inactivity
        family: 4,                  // Use IPv4, skip trying IPv6
        maxPoolSize: 10,            // Maintain up to 10 socket connections
        minPoolSize: 5,             // Maintain at least 5 socket connections
        heartbeatFrequencyMS: 2000, // How often to send heartbeat pings
        retryWrites: true,          // Retry write operations on network errors
        w: 'majority'               // Write concern: require majority of replicas to acknowledge
      };

      // Attempt connection
      await mongoose.connect(mongoUri, connectionOptions);
      
      this.connection = mongoose.connection;
      this.isConnected = true;
      this.retryCount = 0; // Reset retry count on successful connection

      // Set up event listeners for connection monitoring
      this.setupEventListeners();

      console.log('✅ MongoDB connected successfully!');
      console.log(`📊 Database: ${this.connection.db.databaseName}`);
      console.log(`👤 Host: ${this.connection.host}`);
      console.log(`📈 Connection state: ${this.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
      
      return this.connection;
      
    } catch (error) {
      this.retryCount++;
      
      // Attempt reconnection if max retries not reached
      if (this.retryCount < this.maxRetries) {
        console.warn(`⚠️ Connection attempt ${this.retryCount} failed. Retrying in 2 seconds...`);
        console.error('Error details:', error.message);
        
        // Wait 2 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.connect(); // Recursive retry
      }
      
      // Max retries reached - fail permanently
      console.error('❌ MongoDB connection failed after maximum retries');
      console.error('Error details:', error.message);
      console.error('Please check:');
      console.error('1. MongoDB service is running (for local)');
      console.error('2. MongoDB Atlas credentials are correct');
      console.error('3. Network connection is stable');
      console.error('4. IP is whitelisted in MongoDB Atlas (if using Atlas)');
      
      process.exit(1); // Exit process with failure
    }
  }

  /**
   * Sets up event listeners for database connection monitoring
   */
  setupEventListeners() {
    // Connection successful
    this.connection.on('connected', () => {
      console.log('📡 Mongoose connected to MongoDB');
      this.isConnected = true;
    });

    // Connection error
    this.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err.message);
      this.isConnected = false;
    });

    // Connection disconnected
    this.connection.on('disconnected', () => {
      console.log('🔌 Mongoose disconnected from MongoDB');
      this.isConnected = false;
      
      // Attempt reconnection after 5 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          console.log('🔄 Attempting to reconnect to MongoDB...');
          this.connect().catch(console.error);
        }
      }, 5000);
    });

    // Graceful shutdown on app termination
    process.on('SIGINT', async () => {
      await this.connection.close();
      console.log('👋 Mongoose connection closed due to app termination');
      process.exit(0);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  /**
   * Closes the database connection gracefully
   * 
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.isConnected && this.connection) {
      try {
        await mongoose.disconnect();
        this.isConnected = false;
        console.log('🔌 MongoDB connection closed gracefully');
      } catch (error) {
        console.error('❌ Error closing MongoDB connection:', error.message);
      }
    }
  }

  /**
   * Returns the current connection status
   * 
   * @returns {boolean} True if connected, false otherwise
   */
  getStatus() {
    return this.isConnected;
  }

  /**
   * Returns the Mongoose connection instance
   * 
   * @returns {mongoose.Connection|null} Connection instance or null
   */
  getConnection() {
    return this.connection;
  }

  /**
   * Health check for database connection
   * 
   * @returns {Promise<Object>} Health status object
   */
  async healthCheck() {
    try {
      const adminDb = this.connection.db.admin();
      const pingResult = await adminDb.ping();
      
      return {
        status: 'healthy',
        database: this.connection.db.databaseName,
        ping: pingResult.ok === 1 ? 'successful' : 'failed',
        connectionState: this.connection.readyState,
        host: this.connection.host
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connectionState: this.connection.readyState
      };
    }
  }
}

// Export a singleton instance
module.exports = new DatabaseConnection();
