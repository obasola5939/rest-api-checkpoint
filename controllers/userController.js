// controllers/userController.js
const User = require('../models/User');

/**
 * User Controller
 * Contains all business logic for user-related operations
 * Follows REST API conventions and best practices
 */
class UserController {
  
  /**
   * GET /api/users
   * Retrieve all users from the database
   * Supports pagination, sorting, and filtering
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async getAllUsers(req, res) {
    try {
      console.log('📋 GET /api/users - Retrieving all users');
      
      // Extract query parameters for pagination and filtering
      const { 
        page = 1, 
        limit = 10, 
        sortBy = 'createdAt', 
        order = 'desc',
        name,
        email,
        minAge,
        maxAge,
        hobby,
        isActive 
      } = req.query;
      
      // Build query object for filtering
      const query = {};
      
      // Filter by name (case-insensitive partial match)
      if (name) {
        query.name = { $regex: name, $options: 'i' };
      }
      
      // Filter by email (exact match, case-insensitive)
      if (email) {
        query.email = { $regex: `^${email}$`, $options: 'i' };
      }
      
      // Filter by age range
      if (minAge || maxAge) {
        query.age = {};
        if (minAge) query.age.$gte = parseInt(minAge);
        if (maxAge) query.age.$lte = parseInt(maxAge);
      }
      
      // Filter by hobby
      if (hobby) {
        query.hobbies = hobby;
      }
      
      // Filter by active status
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }
      
      // Parse pagination parameters
      const pageNumber = parseInt(page);
      const pageSize = parseInt(limit);
      const skip = (pageNumber - 1) * pageSize;
      
      // Determine sort order
      const sortOrder = order === 'desc' ? -1 : 1;
      const sortOptions = { [sortBy]: sortOrder };
      
      // Execute query with pagination
      const [users, totalUsers] = await Promise.all([
        User.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(pageSize)
          .select('-__v') // Exclude version key
          .lean(), // Return plain JavaScript objects for better performance
        
        User.countDocuments(query) // Get total count for pagination metadata
      ]);
      
      // Calculate pagination metadata
      const totalPages = Math.ceil(totalUsers / pageSize);
      const hasNextPage = pageNumber < totalPages;
      const hasPreviousPage = pageNumber > 1;
      
      // Prepare response with pagination metadata
      const response = {
        success: true,
        message: 'Users retrieved successfully',
        data: users,
        pagination: {
          currentPage: pageNumber,
          pageSize: pageSize,
          totalUsers: totalUsers,
          totalPages: totalPages,
          hasNextPage: hasNextPage,
          hasPreviousPage: hasPreviousPage
        },
        filters: {
          applied: Object.keys(query).length > 0,
          details: query
        },
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Found ${users.length} users (Total: ${totalUsers})`);
      res.status(200).json(response);
      
    } catch (error) {
      console.error('❌ Error retrieving users:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/users/:id
   * Retrieve a single user by ID
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async getUserById(req, res) {
    try {
      const { id } = req.params;
      console.log(`🔍 GET /api/users/${id} - Retrieving user by ID`);
      
      // Validate ID format
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
          timestamp: new Date().toISOString()
        });
      }
      
      // Find user by ID
      const user = await User.findById(id)
        .select('-__v') // Exclude version key
        .lean(); // Return plain JavaScript object
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          timestamp: new Date().toISOString()
        });
      }
      
      // Prepare response
      const response = {
        success: true,
        message: 'User retrieved successfully',
        data: user,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Found user: ${user.name} (Email: ${user.email})`);
      res.status(200).json(response);
      
    } catch (error) {
      console.error('❌ Error retrieving user:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * POST /api/users
   * Create a new user in the database
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async createUser(req, res) {
    try {
      console.log('📝 POST /api/users - Creating new user');
      
      // Extract user data from request body
      const { name, email, age, hobbies } = req.body;
      
      // Validate required fields
      if (!name || !email) {
        return res.status(400).json({
          success: false,
          message: 'Name and email are required fields',
          missingFields: {
            name: !name,
            email: !email
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Check if user with email already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists',
          conflictField: 'email',
          timestamp: new Date().toISOString()
        });
      }
      
      // Prepare user data
      const userData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        age: age ? parseInt(age) : null,
        hobbies: Array.isArray(hobbies) ? hobbies.map(h => h.trim()) : []
      };
      
      // Create new user instance
      const newUser = new User(userData);
      
      // Save user to database using callback pattern as per instructions
      newUser.save((err, savedUser) => {
        if (err) {
          console.error('❌ Error saving user:', err.message);
          
          // Handle validation errors
          if (err.name === 'ValidationError') {
            const errors = {};
            Object.keys(err.errors).forEach(key => {
              errors[key] = err.errors[key].message;
            });
            
            return res.status(400).json({
              success: false,
              message: 'Validation failed',
              errors: errors,
              timestamp: new Date().toISOString()
            });
          }
          
          // Handle duplicate key error
          if (err.code === 11000) {
            return res.status(409).json({
              success: false,
              message: 'Duplicate key error',
              error: 'Email already exists',
              timestamp: new Date().toISOString()
            });
          }
          
          // Generic error
          return res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
            timestamp: new Date().toISOString()
          });
        }
        
        // Remove sensitive/technical fields from response
        const userResponse = savedUser.toObject();
        delete userResponse.__v;
        delete userResponse._id;
        
        // Prepare success response
        const response = {
          success: true,
          message: 'User created successfully',
          data: userResponse,
          timestamp: new Date().toISOString()
        };
        
        console.log(`✅ User created: ${savedUser.name} (Email: ${savedUser.email})`);
        res.status(201).json(response);
      });
      
    } catch (error) {
      console.error('❌ Error in createUser:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to create user',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * PUT /api/users/:id
   * Update an existing user by ID
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      console.log(`✏️ PUT /api/users/${id} - Updating user`);
      
      // Validate ID format
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
          timestamp: new Date().toISOString()
        });
      }
      
      // Extract update data from request body
      const updateData = { ...req.body };
      
      // Clean and validate update data
      if (updateData.email) {
        updateData.email = updateData.email.toLowerCase().trim();
        
        // Check if new email already exists for another user
        const existingUserWithEmail = await User.findOne({ 
          email: updateData.email,
          _id: { $ne: id } // Exclude current user from check
        });
        
        if (existingUserWithEmail) {
          return res.status(409).json({
            success: false,
            message: 'Email already exists for another user',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      if (updateData.name) {
        updateData.name = updateData.name.trim();
      }
      
      if (updateData.hobbies && Array.isArray(updateData.hobbies)) {
        updateData.hobbies = updateData.hobbies.map(h => h.trim());
      }
      
      if (updateData.age) {
        updateData.age = parseInt(updateData.age);
      }
      
      // Find and update user
      const updatedUser = await User.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true, // Return the updated document
          runValidators: true, // Run schema validators on update
          context: 'query', // Required for some validators
          select: '-__v' // Exclude version key from response
        }
      ).lean(); // Return plain JavaScript object
      
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          timestamp: new Date().toISOString()
        });
      }
      
      // Prepare response
      const response = {
        success: true,
        message: 'User updated successfully',
        data: updatedUser,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ User updated: ${updatedUser.name}`);
      res.status(200).json(response);
      
    } catch (error) {
      console.error('❌ Error updating user:', error.message);
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const errors = {};
        Object.keys(error.errors).forEach(key => {
          errors[key] = error.errors[key].message;
        });
        
        return res.status(400).json({
          success: false,
          message: 'Validation failed during update',
          errors: errors,
          timestamp: new Date().toISOString()
        });
      }
      
      // Handle duplicate key error
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Duplicate key error',
          error: 'Email already exists',
          timestamp: new Date().toISOString()
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update user',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * DELETE /api/users/:id
   * Delete a user by ID
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      console.log(`🗑️ DELETE /api/users/${id} - Deleting user`);
      
      // Validate ID format
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
          timestamp: new Date().toISOString()
        });
      }
      
      // Find and delete user
      const deletedUser = await User.findByIdAndDelete(id)
        .select('-__v') // Exclude version key
        .lean(); // Return plain JavaScript object
      
      if (!deletedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          timestamp: new Date().toISOString()
        });
      }
      
      // Prepare response
      const response = {
        success: true,
        message: 'User deleted successfully',
        data: deletedUser,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ User deleted: ${deletedUser.name}`);
      res.status(200).json(response);
      
    } catch (error) {
      console.error('❌ Error deleting user:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/users/search
   * Advanced search for users with multiple criteria
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async searchUsers(req, res) {
    try {
      console.log('🔍 GET /api/users/search - Advanced user search');
      
      const { q, field = 'all' } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query (q) is required',
          timestamp: new Date().toISOString()
        });
      }
      
      let query = {};
      const searchRegex = { $regex: q, $options: 'i' };
      
      // Build search query based on specified field
      switch (field) {
        case 'name':
          query.name = searchRegex;
          break;
        case 'email':
          query.email = searchRegex;
          break;
        case 'hobby':
          query.hobbies = searchRegex;
          break;
        case 'all':
          query.$or = [
            { name: searchRegex },
            { email: searchRegex },
            { hobbies: searchRegex }
          ];
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid search field',
            validFields: ['name', 'email', 'hobby', 'all'],
            timestamp: new Date().toISOString()
          });
      }
      
      // Execute search
      const users = await User.find(query)
        .select('-__v')
        .limit(50) // Limit results for performance
        .lean();
      
      const response = {
        success: true,
        message: `Found ${users.length} user(s) matching "${q}" in ${field}`,
        data: users,
        search: {
          query: q,
          field: field,
          results: users.length
        },
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Search completed: ${users.length} results`);
      res.status(200).json(response);
      
    } catch (error) {
      console.error('❌ Error searching users:', error.message);
      res.status(500).json({
        success: false,
        message: 'Search failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/users/stats
   * Get statistics about users
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async getUserStats(req, res) {
    try {
      console.log('📊 GET /api/users/stats - Retrieving user statistics');
      
      // Aggregate user statistics
      const stats = await User.aggregate([
        {
          $facet: {
            // Total counts
            totalCount: [{ $count: 'count' }],
            activeCount: [
              { $match: { isActive: true } },
              { $count: 'count' }
            ],
            
            // Age statistics
            ageStats: [
              { $match: { age: { $ne: null } } },
              {
                $group: {
                  _id: null,
                  averageAge: { $avg: '$age' },
                  minAge: { $min: '$age' },
                  maxAge: { $max: '$age' },
                  totalAges: { $sum: 1 }
                }
              }
            ],
            
            // Hobby statistics
            popularHobbies: [
              { $unwind: '$hobbies' },
              { $group: { _id: '$hobbies', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 10 }
            ],
            
            // Age groups
            ageGroups: [
              { $match: { age: { $ne: null } } },
              {
                $bucket: {
                  groupBy: '$age',
                  boundaries: [0, 18, 30, 50, 100],
                  default: 'Other',
                  output: {
                    count: { $sum: 1 },
                    users: { $push: { name: '$name', age: '$age' } }
                  }
                }
              }
            ],
            
            // Profile completion
            profileScores: [
              {
                $group: {
                  _id: null,
                  averageScore: { $avg: '$profileScore' },
                  minScore: { $min: '$profileScore' },
                  maxScore: { $max: '$profileScore' }
                }
              }
            ]
          }
        }
      ]);
      
      // Format response
      const formattedStats = {
        totals: {
          users: stats[0].totalCount[0]?.count || 0,
          active: stats[0].activeCount[0]?.count || 0,
          inactive: (stats[0].totalCount[0]?.count || 0) - (stats[0].activeCount[0]?.count || 0)
        },
        age: {
          average: stats[0].ageStats[0]?.averageAge || 0,
          min: stats[0].ageStats[0]?.minAge || 0,
          max: stats[0].ageStats[0]?.maxAge || 0,
          groups: stats[0].ageGroups || []
        },
        hobbies: {
          popular: stats[0].popularHobbies || []
        },
        profile: {
          averageScore: stats[0].profileScores[0]?.averageScore || 0,
          minScore: stats[0].profileScores[0]?.minScore || 0,
          maxScore: stats[0].profileScores[0]?.maxScore || 0
        },
        generatedAt: new Date().toISOString()
      };
      
      const response = {
        success: true,
        message: 'User statistics retrieved successfully',
        data: formattedStats,
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Statistics retrieved successfully');
      res.status(200).json(response);
      
    } catch (error) {
      console.error('❌ Error retrieving statistics:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Export controller instance
module.exports = new UserController();
