// models/Customer.js - Customer Schema for MongoDB

const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  // Shopify Integration
  shopifyId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  
  // Personal Information
  firstName: {
    type: String,
    default: '',
  },
  lastName: {
    type: String,
    default: '',
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  phone: {
    type: String,
    default: '',
  },
  
  // Purchase History
  ordersCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Address Information
  address: {
    address1: String,
    address2: String,
    city: String,
    province: String,
    country: String,
    zip: String,
  },
  
  // Customer Tags (from Shopify)
  tags: [{
    type: String,
  }],
  
  // Customer Status
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  acceptsMarketing: {
    type: Boolean,
    default: false,
  },
  
  // Notes
  note: {
    type: String,
    default: '',
  },
  
  // Timestamps
  dateAdded: {
    type: Date,
    default: Date.now,
    index: true,
  },
  lastOrderDate: {
    type: Date,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
});

// Indexes for better query performance
customerSchema.index({ firstName: 1, lastName: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ totalSpent: -1 });

// Virtual for full name
customerSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim() || 'Guest';
});

// Pre-save middleware to update lastUpdated
customerSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Instance method to check if customer is VIP
customerSchema.methods.isVIP = function(threshold = 1000) {
  return this.totalSpent >= threshold;
};

// Instance method to check if customer is new
customerSchema.methods.isNewCustomer = function(days = 30) {
  const daysSinceJoined = (Date.now() - this.dateAdded) / (1000 * 60 * 60 * 24);
  return daysSinceJoined <= days;
};

// Instance method to check if customer is at risk (hasn't ordered in a while)
customerSchema.methods.isAtRisk = function(days = 90) {
  if (!this.lastOrderDate) return false;
  const daysSinceLastOrder = (Date.now() - this.lastOrderDate) / (1000 * 60 * 60 * 24);
  return daysSinceLastOrder > days && this.ordersCount > 0;
};

// Static method to get VIP customers
customerSchema.statics.getVIPs = function(threshold = 1000) {
  return this.find({ totalSpent: { $gte: threshold } }).sort({ totalSpent: -1 });
};

// Static method to get customers by tag
customerSchema.statics.findByTag = function(tag) {
  return this.find({ tags: tag, isActive: true });
};

// Static method to search customers
customerSchema.statics.search = function(query) {
  return this.find({
    $or: [
      { firstName: { $regex: query, $options: 'i' } },
      { lastName: { $regex: query, $options: 'i' } },
      { email: { $regex: query, $options: 'i' } },
    ],
  });
};

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;