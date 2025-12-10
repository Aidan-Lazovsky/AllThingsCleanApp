// models/Order.js - Order Schema for MongoDB

const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
  },
  variantId: String,
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  sku: String,
}, { _id: false });

const addressSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  company: String,
  address1: String,
  address2: String,
  city: String,
  province: String,
  country: String,
  zip: String,
  phone: String,
}, { _id: false });

const orderSchema = new mongoose.Schema({
  // Shopify Integration
  shopifyId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  orderNumber: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  
  // Customer Information
  customerId: {
    type: String,
    index: true,
  },
  customerName: {
    type: String,
    default: 'Guest',
  },
  customerEmail: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
  },
  
  // Order Items
  items: [orderItemSchema],
  
  // Pricing
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  tax: {
    type: Number,
    default: 0,
    min: 0,
  },
  shipping: {
    type: Number,
    default: 0,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'USD',
  },
  
  // Order Status
  status: {
    type: String,
    enum: ['pending', 'authorized', 'paid', 'partially_paid', 'refunded', 'voided', 'cancelled'],
    default: 'pending',
    index: true,
  },
  fulfillmentStatus: {
    type: String,
    enum: ['fulfilled', 'partial', 'unfulfilled', null],
    default: null,
    index: true,
  },
  
  // Addresses
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  
  // Payment Information
  paymentMethod: {
    type: String,
    default: 'unknown',
  },
  
  // Tracking
  trackingNumber: String,
  trackingCompany: String,
  trackingUrl: String,
  
  // Notes
  note: String,
  customerNote: String,
  
  // Tags
  tags: [{
    type: String,
  }],
  
  // Cancellation
  cancelledAt: Date,
  cancelReason: String,
  
  // Timestamps
  dateCreated: {
    type: Date,
    default: Date.now,
    index: true,
  },
  dateUpdated: Date,
  dateFulfilled: Date,
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
});

// Indexes for better query performance
orderSchema.index({ customerId: 1, dateCreated: -1 });
orderSchema.index({ status: 1, dateCreated: -1 });
orderSchema.index({ fulfillmentStatus: 1, dateCreated: -1 });
orderSchema.index({ orderNumber: 1 });

// Virtual for item count
orderSchema.virtual('itemCount').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Pre-save middleware to update lastUpdated
orderSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Instance method to check if order is paid
orderSchema.methods.isPaid = function() {
  return this.status === 'paid';
};

// Instance method to check if order is fulfilled
orderSchema.methods.isFulfilled = function() {
  return this.fulfillmentStatus === 'fulfilled';
};

// Instance method to check if order is cancelled
orderSchema.methods.isCancelled = function() {
  return this.status === 'cancelled';
};

// Instance method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  return !this.isFulfilled() && !this.isCancelled();
};

// Instance method to get order summary
orderSchema.methods.getSummary = function() {
  return {
    orderNumber: this.orderNumber,
    customer: this.customerName,
    itemCount: this.itemCount,
    total: this.total,
    status: this.status,
    date: this.dateCreated,
  };
};

// Static method to get orders by customer
orderSchema.statics.findByCustomer = function(customerId) {
  return this.find({ customerId }).sort({ dateCreated: -1 });
};

// Static method to get orders by status
orderSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ dateCreated: -1 });
};

// Static method to get recent orders
orderSchema.statics.getRecent = function(limit = 10) {
  return this.find().sort({ dateCreated: -1 }).limit(limit);
};

// Static method to calculate total revenue
orderSchema.statics.calculateRevenue = async function(startDate, endDate) {
  const match = {
    status: 'paid',
  };
  
  if (startDate || endDate) {
    match.dateCreated = {};
    if (startDate) match.dateCreated.$gte = startDate;
    if (endDate) match.dateCreated.$lte = endDate;
  }
  
  const result = await this.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$total' } } },
  ]);
  
  return result[0]?.total || 0;
};

// Static method to get order statistics
orderSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        total: { $sum: '$total' },
      },
    },
  ]);
  
  return stats;
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;