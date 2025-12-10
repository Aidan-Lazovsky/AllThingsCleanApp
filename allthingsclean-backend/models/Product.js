// models/Product.js - Product Schema for MongoDB

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Shopify Integration
  shopifyId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  
  // Basic Product Info
  name: {
    type: String,
    required: true,
    index: true,
  },
  brand: {
    type: String,
    default: 'Unknown',
    index: true,
  },
  category: {
    type: String,
    default: 'Uncategorized',
    index: true,
  },
  
  // Pricing
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  compareAtPrice: {
    type: Number,
    default: 0,
  },
  
  // Product Details
  description: {
    type: String,
    default: '',
  },
  
  // Images
  imageUrl: {
    type: String,
    default: 'https://via.placeholder.com/400',
  },
  images: [{
    type: String,
  }],
  
  // Inventory
  inStock: {
    type: Boolean,
    default: true,
    index: true,
  },
  stockQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Product Identifiers
  sku: {
    type: String,
    sparse: true,
    index: true,
  },
  barcode: {
    type: String,
    sparse: true,
  },
  
  // Tags & Categories
  tags: [{
    type: String,
  }],
  
  // Variants (if product has multiple options)
  variants: [{
    id: String,
    title: String,
    price: Number,
    sku: String,
    inventoryQuantity: Number,
  }],
  
  // Product Flags
  isNew: {
    type: Boolean,
    default: false,
    index: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  // Ratings (for future use)
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  
  // Analytics
  popularity: {
    type: Number,
    default: 0,
    index: true,
  },
  viewCount: {
    type: Number,
    default: 0,
  },
  
  // Timestamps
  dateAdded: {
    type: Date,
    default: Date.now,
    index: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
});

// Indexes for better query performance
productSchema.index({ name: 'text', brand: 'text', tags: 'text' });
productSchema.index({ price: 1, inStock: 1 });
productSchema.index({ category: 1, inStock: 1 });

// Pre-save middleware to update lastUpdated
productSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Instance method to check if product is low stock
productSchema.methods.isLowStock = function(threshold = 10) {
  return this.inStock && this.stockQuantity <= threshold && this.stockQuantity > 0;
};

// Instance method to check if product is on sale
productSchema.methods.isOnSale = function() {
  return this.compareAtPrice > 0 && this.compareAtPrice > this.price;
};

// Instance method to calculate discount percentage
productSchema.methods.getDiscountPercentage = function() {
  if (!this.isOnSale()) return 0;
  return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
};

// Static method to get products by category
productSchema.statics.findByCategory = function(category) {
  return this.find({ category, inStock: true }).sort({ popularity: -1 });
};

// Static method to get featured products
productSchema.statics.getFeatured = function(limit = 10) {
  return this.find({ isFeatured: true, inStock: true })
    .sort({ popularity: -1 })
    .limit(limit);
};

// Static method to search products
productSchema.statics.search = function(query, options = {}) {
  const searchQuery = {
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { brand: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } },
    ],
  };
  
  if (options.inStockOnly) {
    searchQuery.inStock = true;
  }
  
  return this.find(searchQuery).sort({ popularity: -1 });
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;