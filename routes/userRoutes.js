// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

/**
 * User Routes
 * Defines REST API endpoints for user operations
 * Follows RESTful conventions and includes proper HTTP methods
 */

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination, sorting, and filtering
 * @access  Public
 * @query   {Number} page - Page number (default: 1)
 * @query   {Number} limit - Results per page (default: 10)
 * @query   {String} sortBy - Field to sort by (default: createdAt)
 * @query   {String} order - Sort order (asc/desc, default: desc)
 * @query   {String} name - Filter by name (partial match)
 * @query   {String} email - Filter by email (exact match)
 * @query   {Number} minAge - Minimum age filter
 * @query   {Number} maxAge - Maximum age filter
 * @query   {String} hobby - Filter by hobby
 * @query   {Boolean} isActive - Filter by active status
 * @returns {Array} List of users with pagination metadata
 */
router.get('/', userController.getAllUsers);

/**
 * @route   GET /api/users/search
 * @desc    Search users by name, email, or hobbies
 * @access  Public
 * @query   {String} q - Search query (required)
 * @query   {String} field - Search field (name/email/hobby/all, default: all)
 * @returns {Array} List of matching users
 */
router.get('/search', userController.searchUsers);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics (counts, averages, popular hobbies, etc.)
 * @access  Public
 * @returns {Object} User statistics
 */
router.get('/stats', userController.getUserStats);

/**
 * @route   GET /api/users/:id
 * @desc    Get a single user by ID
 * @access  Public
 * @param   {String} id - User's MongoDB ID (required)
 * @returns {Object} User object
 */
router.get('/:id', userController.getUserById);

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Public
 * @body    {Object} user - User data
 * @body    {String} user.name - User's name (required)
 * @body    {String} user.email - User's email (required, unique)
 * @body    {Number} user.age - User's age (optional)
 * @body    {Array} user.hobbies - User's hobbies (optional)
 * @returns {Object} Created user object
 */
router.post('/', userController.createUser);

/**
 * @route   PUT /api/users/:id
 * @desc    Update an existing user by ID
 * @access  Public
 * @param   {String} id - User's MongoDB ID (required)
 * @body    {Object} updates - Fields to update
 * @body    {String} updates.name - Updated name (optional)
 * @body    {String} updates.email - Updated email (optional, unique)
 * @body    {Number} updates.age - Updated age (optional)
 * @body    {Array} updates.hobbies - Updated hobbies (optional)
 * @body    {Boolean} updates.isActive - Updated active status (optional)
 * @returns {Object} Updated user object
 */
router.put('/:id', userController.updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user by ID
 * @access  Public
 * @param   {String} id - User's MongoDB ID (required)
 * @returns {Object} Deleted user object
 */
router.delete('/:id', userController.deleteUser);

module.exports = router;
