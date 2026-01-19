// models/User.js
const mongoose = require('mongoose');

/**
 * User Schema Definition
 * Defines the structure, validation rules, and behavior for User documents
 * 
 * @schema User
 * @property {String} name - User's full name (required)
 * @property {String} email - User's email address (required, unique)
 * @property {Number} age - User's age (optional, with constraints)
 * @property {Array} hobbies - User's hobbies/interests (optional)
 * @property {Date} createdAt - Document creation timestamp
 * @property {Date} updatedAt - Document last update timestamp
 */
const userSchema = new mongoose.Schema(
  {
    /**
     * User's full name
     * Required field with length validation
     */
    name: {
      type: String,
      required: [true, 'Name is required'], // Custom error message
      trim: true, // Remove whitespace from both ends
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
      // Custom validator for name format
      validate: {
        validator: function(v) {
          // Allows letters, spaces, hyphens, and apostrophes
          return /^[a-zA-Z\s\-']{2,100}$/.test(v);
        },
        message: props => `${props.value} is not a valid name!`
      }
    },

    /**
     * User's email address
     * Required, unique field with email format validation
     */
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // Ensures no duplicate emails in the database
      lowercase: true, // Convert email to lowercase before saving
      trim: true,
      // Email format validation using regex
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please enter a valid email address'
      ],
      // Custom validator for email domain
      validate: {
        validator: function(v) {
          // Prevent common disposable email domains
          const disposableDomains = ['tempmail.com', 'throwaway.com'];
          const domain = v.split('@')[1];
          return !disposableDomains.includes(domain.toLowerCase());
        },
        message: 'Disposable email addresses are not allowed'
      }
    },

    /**
     * User's age
     * Optional field with numerical constraints
     */
    age: {
      type: Number,
      min: [13, 'Age must be at least 13'], // Minimum age requirement
      max: [120, 'Age cannot exceed 120 years'], // Reasonable maximum age
      default: null // Default value if not provided
    },

    /**
     * User's hobbies/interests
     * Array of strings with validation
     */
    hobbies: {
      type: [{
        type: String,
        trim: true,
        minlength: [2, 'Hobby must be at least 2 characters'],
        maxlength: [50, 'Hobby cannot exceed 50 characters']
      }],
      default: [], // Default to empty array
      // Validate array length
      validate: {
        validator: function(array) {
          return array.length <= 10; // Limit to 10 hobbies
        },
        message: 'Cannot have more than 10 hobbies'
      }
    },

    /**
     * User's status
     * Indicates if the user is active
     */
    isActive: {
      type: Boolean,
      default: true // Users are active by default
    },

    /**
     * Profile completion score
     * Calculated virtual field
     */
    profileScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  {
    // Schema options
    timestamps: true, // Automatically adds createdAt and updatedAt fields
    versionKey: false, // Disable __v field
    toJSON: { 
      virtuals: true, // Include virtuals in JSON output
      transform: function(doc, ret) {
        // Remove sensitive/technical fields from JSON output
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    },
    toObject: { virtuals: true } // Include virtuals in Object output
  }
);

/**
 * Virtual Property: Full Profile Summary
 * Not stored in database, calculated on-the-fly
 * Provides a formatted summary of the user's profile
 */
userSchema.virtual('profileSummary').get(function() {
  const ageText = this.age ? `${this.age} years old` : 'age not specified';
  const hobbiesText = this.hobbies.length 
    ? `Hobbies: ${this.hobbies.join(', ')}` 
    : 'No hobbies listed';
  
  return `${this.name} (${ageText}) - ${hobbiesText}`;
});

/**
 * Virtual Property: User's Age Group
 * Categorizes user based on age
 */
userSchema.virtual('ageGroup').get(function() {
  if (!this.age) return 'Not specified';
  if (this.age < 18) return 'Minor';
  if (this.age < 30) return 'Young Adult';
  if (this.age < 50) return 'Adult';
  return 'Senior';
});

/**
 * Instance Method: Add a Hobby
 * Adds a new hobby to the user's hobbies array
 * @param {String} hobby - Hobby to add
 * @returns {Promise<User>} Updated user document
 */
userSchema.methods.addHobby = function(hobby) {
  // Check if hobby already exists
  if (!this.hobbies.includes(hobby) && this.hobbies.length < 10) {
    this.hobbies.push(hobby);
    return this.save();
  }
  return Promise.resolve(this);
};

/**
 * Instance Method: Remove a Hobby
 * Removes a hobby from the user's hobbies array
 * @param {String} hobby - Hobby to remove
 * @returns {Promise<User>} Updated user document
 */
userSchema.methods.removeHobby = function(hobby) {
  const index = this.hobbies.indexOf(hobby);
  if (index > -1) {
    this.hobbies.splice(index, 1);
    return this.save();
  }
  return Promise.resolve(this);
};

/**
 * Instance Method: Update Profile Score
 * Calculates and updates the user's profile completion score
 * @returns {Promise<User>} Updated user document
 */
userSchema.methods.updateProfileScore = function() {
  let score = 0;
  
  // Name: 20 points
  if (this.name && this.name.length >= 2) score += 20;
  
  // Email: 30 points
  if (this.email) score += 30;
  
  // Age: 20 points
  if (this.age) score += 20;
  
  // Hobbies: Up to 30 points (3 points per hobby, max 10 hobbies)
  score += Math.min(this.hobbies.length * 3, 30);
  
  this.profileScore = score;
  return this.save();
};

/**
 * Static Method: Find Active Users
 * Returns all users with isActive = true
 * @returns {Promise<Array<User>>} Array of active users
 */
userSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

/**
 * Static Method: Find Users by Age Range
 * Returns users within specified age range
 * @param {Number} minAge - Minimum age
 * @param {Number} maxAge - Maximum age
 * @returns {Promise<Array<User>>} Users within age range
 */
userSchema.statics.findByAgeRange = function(minAge, maxAge) {
  return this.find({ 
    age: { 
      $gte: minAge, 
      $lte: maxAge 
    } 
  });
};

/**
 * Static Method: Find Users by Hobby
 * Returns users who have a specific hobby
 * @param {String} hobby - Hobby to search for
 * @returns {Promise<Array<User>>} Users with the specified hobby
 */
userSchema.statics.findByHobby = function(hobby) {
  return this.find({ hobbies: hobby });
};

/**
 * Pre-save Middleware
 * Runs before saving a document
 * Updates profile score automatically
 */
userSchema.pre('save', async function(next) {
  // Update profile score before saving
  await this.updateProfileScore();
  
  // Ensure email is lowercase
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  
  next();
});

/**
 * Post-save Middleware
 * Runs after successfully saving a document
 * Logs the save operation
 */
userSchema.post('save', function(doc) {
  console.log(`✅ User saved: ${doc.name} (Email: ${doc.email})`);
});

/**
 * Pre-remove Middleware
 * Runs before removing a document
 * Can be used for cleanup operations
 */
userSchema.pre('remove', function(next) {
  console.log(`🗑️ Removing user: ${this.name}`);
  next();
});

/**
 * Indexes for Performance Optimization
 * Creates indexes on frequently queried fields
 */
userSchema.index({ email: 1 }); // Index for email (unique)
userSchema.index({ name: 1 }); // Index for name search
userSchema.index({ age: 1 }); // Index for age-based queries
userSchema.index({ hobbies: 1 }); // Index for hobby-based queries
userSchema.index({ isActive: 1 }); // Index for active status queries

// Create and export the User model
const User = mongoose.model('User', userSchema);

module.exports = User;
