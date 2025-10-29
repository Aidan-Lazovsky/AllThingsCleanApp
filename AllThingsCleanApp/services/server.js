// server.js - Complete Backend Server with Lightspeed R-Series Integration

// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const lightspeedService = require('./services/lightspeedRSeries');
const webhookHandler = require('./services/lightspeedWebhookHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ===== DATABASE CONNECTION =====
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/allthingsclean', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ===== MODELS =====
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Order = require('./models/Order');

// ===== HEALTH CHECK =====
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    service: 'AllThingsClean API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    lightspeed: lightspeedService.accessToken ? 'authenticated' : 'not authenticated'
  });
});

// ===== LIGHTSPEED OAUTH ROUTES =====

/**
 * Step 1: Get Lightspeed authorization URL
 * Frontend should redirect user to this URL
 */
app.get('/api/lightspeed/auth/start', (req, res) => {
  try {
    const state = Math.random().toString(36).substring(7);
    const authURL = lightspeedService.getAuthorizationURL(state);
    
    res.json({ 
      success: true,
      authURL,
      message: 'Redirect user to authURL to complete OAuth'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Step 2: OAuth callback - Lightspeed redirects here after authorization
 * This endpoint receives the authorization code and exchanges it for tokens
 */
app.get('/api/lightspeed/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.status(400).json({ 
      success: false, 
      error: error,
      message: 'OAuth authorization failed'
    });
  }

  if (!code) {
    return res.status(400).json({ 
      success: false, 
      error: 'No authorization code received' 
    });
  }

  try {
    const result = await lightspeedService.getAccessToken(code);
    
    res.json({ 
      success: true, 
      message: 'Successfully connected to Lightspeed!',
      accountId: result.accountId
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ===== LIGHTSPEED TEST & STATUS ROUTES =====

/**
 * Test Lightspeed API connection
 */
app.get('/api/lightspeed/test', async (req, res) => {
  try {
    const result = await lightspeedService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Get Lightspeed account info
 */
app.get('/api/lightspeed/account', async (req, res) => {
  try {
    await lightspeedService.ensureValidToken();
    const shop = await lightspeedService.request('/Shop.json');
    
    res.json({ 
      success: true, 
      shop: shop.Shop,
      accountId: lightspeedService.accountId
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ===== WEBHOOK ROUTES =====

/**
 * Receive webhook events from Lightspeed
 * Lightspeed sends POST requests to this endpoint when events occur
 */
app.post('/api/lightspeed/webhook', async (req, res) => {
  try {
    const event = req.body;
    
    console.log('📥 Webhook received:', {
      topic: event.topic,
      data: event.data
    });
    
    // Process webhook asynchronously
    webhookHandler.handleWebhook(event)
      .catch(err => console.error('Webhook processing error:', err));
    
    // Respond immediately to Lightspeed
    res.status(200).json({ 
      success: true,
      message: 'Webhook received and queued for processing'
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Register webhooks with Lightspeed
 */
app.post('/api/lightspeed/webhook/register', async (req, res) => {
  try {
    const webhookUrl = `${process.env.PUBLIC_URL}/api/lightspeed/webhook`;
    const topics = [
      'item.create',
      'item.update', 
      'item.delete',
      'customer.create',
      'customer.update',
      'customer.delete',
      'sale.create',
      'sale.update',
      'sale.delete'
    ];
    
    const webhook = await lightspeedService.registerWebhook(webhookUrl, topics);
    
    res.json({ 
      success: true, 
      webhook,
      message: 'Webhook registered successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Get all registered webhooks
 */
app.get('/api/lightspeed/webhooks', async (req, res) => {
  try {
    const webhooks = await lightspeedService.getWebhooks();
    res.json({ 
      success: true, 
      webhooks,
      count: Array.isArray(webhooks) ? webhooks.length : 1
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Delete a webhook
 */
app.delete('/api/lightspeed/webhook/:webhookId', async (req, res) => {
  try {
    await lightspeedService.deleteWebhook(req.params.webhookId);
    res.json({ 
      success: true,
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ===== MANUAL SYNC ROUTES =====

/**
 * Manually sync all products from Lightspeed
 * Use this for initial setup or troubleshooting
 */
app.post('/api/lightspeed/sync/products', async (req, res) => {
  try {
    console.log('🔄 Starting product sync...');
    
    const items = await lightspeedService.getItems({ limit: 1000 });
    const itemArray = Array.isArray(items) ? items : [items];
    
    let synced = 0;
    let errors = 0;
    
    for (const item of itemArray) {
      try {
        await webhookHandler.handleItemUpdate(item.itemID);
        synced++;
      } catch (error) {
        console.error(`Error syncing item ${item.itemID}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ Product sync complete: ${synced} synced, ${errors} errors`);
    
    res.json({ 
      success: true,
      synced,
      errors,
      total: itemArray.length
    });
  } catch (error) {
    console.error('Product sync error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Manually sync all customers from Lightspeed
 */
app.post('/api/lightspeed/sync/customers', async (req, res) => {
  try {
    console.log('🔄 Starting customer sync...');
    
    const customers = await lightspeedService.getCustomers({ limit: 1000 });
    const customerArray = Array.isArray(customers) ? customers : [customers];
    
    let synced = 0;
    let errors = 0;
    
    for (const customer of customerArray) {
      try {
        await webhookHandler.handleCustomerUpdate(customer.customerID);
        synced++;
      } catch (error) {
        console.error(`Error syncing customer ${customer.customerID}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ Customer sync complete: ${synced} synced, ${errors} errors`);
    
    res.json({ 
      success: true,
      synced,
      errors,
      total: customerArray.length
    });
  } catch (error) {
    console.error('Customer sync error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Manually sync all orders from Lightspeed
 */
app.post('/api/lightspeed/sync/orders', async (req, res) => {
  try {
    console.log('🔄 Starting order sync...');
    
    const sales = await lightspeedService.getSales({ limit: 1000 });
    const saleArray = Array.isArray(sales) ? sales : [sales];
    
    let synced = 0;
    let errors = 0;
    
    for (const sale of saleArray) {
      try {
        await webhookHandler.handleSaleUpdate(sale.saleID);
        synced++;
      } catch (error) {
        console.error(`Error syncing sale ${sale.saleID}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ Order sync complete: ${synced} synced, ${errors} errors`);
    
    res.json({ 
      success: true,
      synced,
      errors,
      total: saleArray.length
    });
  } catch (error) {
    console.error('Order sync error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ===== PRODUCT API ROUTES =====

/**
 * Get all products with filtering and pagination
 */
app.get('/api/products', async (req, res) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      sortBy = 'name',
      inStock,
      page = 1,
      limit = 20,
    } = req.query;

    // Build query
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (inStock !== undefined) {
      query.inStock = inStock === 'true';
    }

    // Build sort
    let sort = {};
    switch (sortBy) {
      case 'name':
        sort.name = 1;
        break;
      case 'price-asc':
        sort.price = 1;
        break;
      case 'price-desc':
        sort.price = -1;
        break;
      case 'newest':
        sort.dateAdded = -1;
        break;
      case 'popular':
        sort.popularity = -1;
        break;
      default:
        sort.name = 1;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message,
    });
  }
});

/**
 * Get single product by ID
 */
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message,
    });
  }
});

/**
 * Get all categories
 */
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    
    res.json({
      success: true,
      data: categories.filter(cat => cat), // Remove null/empty
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message,
    });
  }
});

/**
 * Get all brands
 */
app.get('/api/brands', async (req, res) => {
  try {
    const brands = await Product.distinct('brand');
    
    res.json({
      success: true,
      data: brands.filter(brand => brand).sort(), // Remove null/empty and sort
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching brands',
      error: error.message,
    });
  }
});

// ===== CUSTOMER API ROUTES =====

/**
 * Get all customers
 */
app.get('/api/customers', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const customers = await Customer.find()
      .sort({ dateAdded: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Customer.countDocuments();

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get customer by ID
 */
app.get('/api/customers/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ===== ORDER API ROUTES =====

/**
 * Get all orders
 */
app.get('/api/orders', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find()
      .sort({ dateCreated: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments();

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get order by ID
 */
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ===== ERROR HANDLING =====

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ===== START SERVER =====

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 AllThingsClean API Server Started');
  console.log('=====================================');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '⏳ Connecting...'}`);
  console.log(`💡 Lightspeed: ${lightspeedService.accessToken ? '✅ Authenticated' : '⚠️  Not authenticated (complete OAuth flow)'}`);
  console.log('');
  console.log('📚 Available endpoints:');
  console.log('   GET  /api/health');
  console.log('   GET  /api/lightspeed/auth/start');
  console.log('   GET  /api/lightspeed/test');
  console.log('   POST /api/lightspeed/webhook');
  console.log('   POST /api/lightspeed/sync/products');
  console.log('   GET  /api/products');
  console.log('   GET  /api/categories');
  console.log('');
});

module.exports = app;