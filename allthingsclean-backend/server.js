// server.js - Complete Backend Server with Shopify Integration

// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const shopifyService = require('./services/shopify');
const shopifyWebhookHandler = require('./services/shopifyWebhookHandler');

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
const User = require('./models/User');

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
    shopify: shopifyService.accessToken ? 'configured' : 'not configured'
  });
});

// ===== SHOPIFY ROUTES =====

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

/**
 * Test Shopify connection
 */
app.get('/api/shopify/test', async (req, res) => {
  try {
    const result = await shopifyService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get shop info
 */
app.get('/api/shopify/shop', async (req, res) => {
  try {
    const shop = await shopifyService.getShopInfo();
    res.json({ success: true, shop });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Webhook endpoint - receives events from Shopify
 * IMPORTANT: This must handle raw body for HMAC verification
 */
app.post('/api/shopify/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Get headers
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const topic = req.headers['x-shopify-topic'];
    const shop = req.headers['x-shopify-shop-domain'];

    console.log(`📥 Webhook received from ${shop}: ${topic}`);

    // Verify webhook signature
    const rawBody = req.body.toString('utf8');
    const isValid = shopifyWebhookHandler.verifyWebhook(rawBody, hmac);

    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse the body
    const data = JSON.parse(rawBody);

    // Process webhook asynchronously
    shopifyWebhookHandler.handleWebhook(topic, data)
      .catch(err => console.error('Webhook processing error:', err));

    // Respond immediately to Shopify (they expect 200 within 5 seconds)
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Register all webhooks with Shopify
 */
app.post('/api/shopify/webhooks/register', async (req, res) => {
  try {
    const baseUrl = process.env.PUBLIC_URL || 'https://your-domain.com';
    
    if (baseUrl.includes('localhost')) {
      return res.status(400).json({
        success: false,
        error: 'Cannot register webhooks with localhost URL. Please deploy your backend or use ngrok.',
        message: 'Run: ngrok http 3000, then update PUBLIC_URL in .env'
      });
    }

    const webhooks = await shopifyService.registerWebhooks(baseUrl);
    
    res.json({ 
      success: true, 
      webhooks,
      count: webhooks.length,
      message: `Registered ${webhooks.length} webhooks`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all registered webhooks
 */
app.get('/api/shopify/webhooks', async (req, res) => {
  try {
    const webhooks = await shopifyService.getWebhooks();
    res.json({ 
      success: true, 
      webhooks,
      count: webhooks.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a specific webhook
 */
app.delete('/api/shopify/webhooks/:id', async (req, res) => {
  try {
    await shopifyService.deleteWebhook(req.params.id);
    res.json({ success: true, message: 'Webhook deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete all webhooks
 */
app.delete('/api/shopify/webhooks', async (req, res) => {
  try {
    const webhooks = await shopifyService.getWebhooks();
    
    for (const webhook of webhooks) {
      await shopifyService.deleteWebhook(webhook.id);
    }
    
    res.json({ 
      success: true, 
      message: `Deleted ${webhooks.length} webhooks` 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== MANUAL SYNC ROUTES =====

/**
 * Sync all products from Shopify
 */
app.post('/api/shopify/sync/products', async (req, res) => {
  try {
    console.log('🔄 Starting product sync from Shopify...');
    
    const products = await shopifyService.getProducts({ limit: 250 });
    
    let synced = 0;
    let errors = 0;
    
    for (const product of products) {
      try {
        await shopifyWebhookHandler.handleProductUpdate(product);
        synced++;
      } catch (error) {
        console.error(`Error syncing product ${product.id}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ Product sync complete: ${synced} synced, ${errors} errors`);
    
    res.json({ 
      success: true, 
      synced, 
      errors, 
      total: products.length,
      message: `Synced ${synced} of ${products.length} products`
    });
  } catch (error) {
    console.error('Product sync error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Sync all customers from Shopify
 */
app.post('/api/shopify/sync/customers', async (req, res) => {
  try {
    console.log('🔄 Starting customer sync from Shopify...');
    
    const customers = await shopifyService.getCustomers({ limit: 250 });
    
    let synced = 0;
    let errors = 0;
    
    for (const customer of customers) {
      try {
        await shopifyWebhookHandler.handleCustomerUpdate(customer);
        synced++;
      } catch (error) {
        console.error(`Error syncing customer ${customer.id}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ Customer sync complete: ${synced} synced, ${errors} errors`);
    
    res.json({ 
      success: true, 
      synced, 
      errors, 
      total: customers.length,
      message: `Synced ${synced} of ${customers.length} customers`
    });
  } catch (error) {
    console.error('Customer sync error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Sync all orders from Shopify
 */
app.post('/api/shopify/sync/orders', async (req, res) => {
  try {
    console.log('🔄 Starting order sync from Shopify...');
    
    const orders = await shopifyService.getOrders({ limit: 250, status: 'any' });
    
    let synced = 0;
    let errors = 0;
    
    for (const order of orders) {
      try {
        await shopifyWebhookHandler.handleOrderUpdate(order);
        synced++;
      } catch (error) {
        console.error(`Error syncing order ${order.id}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ Order sync complete: ${synced} synced, ${errors} errors`);
    
    res.json({ 
      success: true, 
      synced, 
      errors, 
      total: orders.length,
      message: `Synced ${synced} of ${orders.length} orders`
    });
  } catch (error) {
    console.error('Order sync error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Sync all data (products, customers, orders)
 */
app.post('/api/shopify/sync/all', async (req, res) => {
  try {
    console.log('🔄 Starting full sync from Shopify...');
    
    const results = {
      products: { synced: 0, errors: 0, total: 0 },
      customers: { synced: 0, errors: 0, total: 0 },
      orders: { synced: 0, errors: 0, total: 0 },
    };

    // Sync products
    try {
      const products = await shopifyService.getProducts({ limit: 250 });
      results.products.total = products.length;
      
      for (const product of products) {
        try {
          await shopifyWebhookHandler.handleProductUpdate(product);
          results.products.synced++;
        } catch (error) {
          results.products.errors++;
        }
      }
    } catch (error) {
      console.error('Error syncing products:', error);
    }

    // Sync customers
    try {
      const customers = await shopifyService.getCustomers({ limit: 250 });
      results.customers.total = customers.length;
      
      for (const customer of customers) {
        try {
          await shopifyWebhookHandler.handleCustomerUpdate(customer);
          results.customers.synced++;
        } catch (error) {
          results.customers.errors++;
        }
      }
    } catch (error) {
      console.error('Error syncing customers:', error);
    }

    // Sync orders
    try {
      const orders = await shopifyService.getOrders({ limit: 250 });
      results.orders.total = orders.length;
      
      for (const order of orders) {
        try {
          await shopifyWebhookHandler.handleOrderUpdate(order);
          results.orders.synced++;
        } catch (error) {
          results.orders.errors++;
        }
      }
    } catch (error) {
      console.error('Error syncing orders:', error);
    }

    console.log('✅ Full sync complete:', results);
    
    res.json({ 
      success: true, 
      results,
      message: 'Full sync completed'
    });
  } catch (error) {
    console.error('Full sync error:', error);
    res.status(500).json({ success: false, error: error.message });
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
        { tags: { $in: [new RegExp(search, 'i')] } },
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
 * Get featured products
 */
app.get('/api/products/featured/list', async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true })
      .sort({ popularity: -1 })
      .limit(10);

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
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
      data: categories.filter(cat => cat && cat !== 'Uncategorized').sort(),
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
      data: brands.filter(brand => brand && brand !== 'Unknown').sort(),
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

// ===== INVENTORY API ROUTES =====

/**
 * Get inventory for a product
 */
app.get('/api/products/:id/inventory', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Get inventory from Shopify
    const inventory = await shopifyService.getProductInventory(product.shopifyId);

    res.json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update inventory quantity for a product
 */
app.put('/api/products/:id/inventory', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const { quantity, variantId } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Quantity is required',
      });
    }

    // Get locations
    const primaryLocation = await shopifyService.getPrimaryLocation();

    // Get product variants
    const shopifyProduct = await shopifyService.getProductById(product.shopifyId);
    const variant = variantId 
      ? shopifyProduct.variants.find(v => v.id.toString() === variantId)
      : shopifyProduct.variants[0];

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found',
      });
    }

    // Update inventory in Shopify
    const inventoryLevel = await shopifyService.updateInventoryLevel(
      variant.inventory_item_id,
      primaryLocation.id,
      parseInt(quantity)
    );

    // Update in our database
    product.stockQuantity = parseInt(quantity);
    product.inStock = parseInt(quantity) > 0;
    await product.save();

    res.json({
      success: true,
      data: {
        product: product,
        inventory: inventoryLevel,
      },
      message: 'Inventory updated successfully',
    });
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Adjust inventory (add or subtract)
 */
app.post('/api/products/:id/inventory/adjust', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const { adjustment, variantId, reason } = req.body;

    if (adjustment === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Adjustment amount is required',
      });
    }

    // Get locations
    const primaryLocation = await shopifyService.getPrimaryLocation();

    // Get product variants
    const shopifyProduct = await shopifyService.getProductById(product.shopifyId);
    const variant = variantId 
      ? shopifyProduct.variants.find(v => v.id.toString() === variantId)
      : shopifyProduct.variants[0];

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found',
      });
    }

    // Adjust inventory in Shopify
    const inventoryLevel = await shopifyService.adjustInventoryLevel(
      variant.inventory_item_id,
      primaryLocation.id,
      parseInt(adjustment)
    );

    // Update in our database
    product.stockQuantity = product.stockQuantity + parseInt(adjustment);
    product.inStock = product.stockQuantity > 0;
    await product.save();

    res.json({
      success: true,
      data: {
        product: product,
        inventory: inventoryLevel,
        adjustment: parseInt(adjustment),
        reason: reason || 'manual adjustment',
      },
      message: `Inventory adjusted by ${adjustment}`,
    });
  } catch (error) {
    console.error('Adjust inventory error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get all locations
 */
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await shopifyService.getLocations();
    
    res.json({
      success: true,
      data: locations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
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

/**
 * Create a new customer in Shopify
 */
app.post('/api/customers', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address, tags, note } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Check if customer already exists
    const existingCustomer = await shopifyService.searchCustomerByEmail(email);
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this email already exists',
        customerId: existingCustomer.id,
      });
    }

    // Create in Shopify
    const shopifyCustomer = await shopifyService.createCustomer({
      firstName,
      lastName,
      email,
      phone,
      address,
      tags,
      note,
    });

    // Sync to our database
    await shopifyWebhookHandler.handleCustomerUpdate(shopifyCustomer);

    // Get from our database
    const customer = await Customer.findOne({ shopifyId: shopifyCustomer.id.toString() });

    res.status(201).json({
      success: true,
      data: customer,
      message: 'Customer created successfully',
    });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update customer in Shopify
 */
app.put('/api/customers/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const { firstName, lastName, email, phone, tags, note } = req.body;

    // Update in Shopify
    const shopifyCustomer = await shopifyService.updateCustomer(customer.shopifyId, {
      firstName,
      lastName,
      email,
      phone,
      tags,
      note,
    });

    // Sync to our database
    await shopifyWebhookHandler.handleCustomerUpdate(shopifyCustomer);

    // Get updated customer
    const updatedCustomer = await Customer.findById(req.params.id);

    res.json({
      success: true,
      data: updatedCustomer,
      message: 'Customer updated successfully',
    });
  } catch (error) {
    console.error('Update customer error:', error);
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
    const { page = 1, limit = 50, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ dateCreated: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

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

/**
 * Create a new order in Shopify
 */
app.post('/api/orders', async (req, res) => {
  try {
    const { 
      customerId, 
      email, 
      items, 
      shippingAddress, 
      billingAddress, 
      note, 
      tags,
      financialStatus 
    } = req.body;

    // Validate required fields
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item',
      });
    }

    // Get customer if customerId provided
    let customer = null;
    if (customerId) {
      const customerDoc = await Customer.findById(customerId);
      if (customerDoc) {
        customer = { id: customerDoc.shopifyId };
      }
    }

    // Create order in Shopify
    const shopifyOrder = await shopifyService.createOrder({
      customer,
      email,
      items,
      shippingAddress,
      billingAddress,
      note,
      tags,
      financialStatus: financialStatus || 'pending',
    });

    // Sync to our database
    await shopifyWebhookHandler.handleOrderUpdate(shopifyOrder);

    // Get from our database
    const order = await Order.findOne({ shopifyId: shopifyOrder.id.toString() });

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully',
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update order in Shopify
 */
app.put('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const { note, tags, email } = req.body;

    // Update in Shopify
    const shopifyOrder = await shopifyService.updateOrder(order.shopifyId, {
      note,
      tags,
      email,
    });

    // Sync to our database
    await shopifyWebhookHandler.handleOrderUpdate(shopifyOrder);

    // Get updated order
    const updatedOrder = await Order.findById(req.params.id);

    res.json({
      success: true,
      data: updatedOrder,
      message: 'Order updated successfully',
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Cancel an order
 */
app.post('/api/orders/:id/cancel', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const { reason } = req.body;

    // Cancel in Shopify
    const shopifyOrder = await shopifyService.cancelOrder(
      order.shopifyId, 
      reason || 'customer'
    );

    // Sync to our database
    await shopifyWebhookHandler.handleOrderCancelled(shopifyOrder);

    // Get updated order
    const cancelledOrder = await Order.findById(req.params.id);

    res.json({
      success: true,
      data: cancelledOrder,
      message: 'Order cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ===== STATS & ANALYTICS =====

/**
 * Get dashboard statistics
 */
app.get('/api/stats', async (req, res) => {
  try {
    const [
      totalProducts,
      totalCustomers,
      totalOrders,
      inStockProducts,
      lowStockProducts
    ] = await Promise.all([
      Product.countDocuments(),
      Customer.countDocuments(),
      Order.countDocuments(),
      Product.countDocuments({ inStock: true }),
      Product.countDocuments({ stockQuantity: { $lt: 10, $gt: 0 } })
    ]);

    const totalRevenue = await Order.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    res.json({
      success: true,
      stats: {
        products: {
          total: totalProducts,
          inStock: inStockProducts,
          lowStock: lowStockProducts,
        },
        customers: {
          total: totalCustomers,
        },
        orders: {
          total: totalOrders,
        },
        revenue: {
          total: totalRevenue[0]?.total || 0,
        }
      }
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
  console.log(`🛍️  Shopify: ${shopifyService.accessToken ? '✅ Configured' : '⚠️  Not configured (check .env)'}`);
  console.log('');
  console.log('📚 Available endpoints:');
  console.log('   GET  /api/health');
  console.log('   GET  /api/shopify/test');
  console.log('   POST /api/shopify/webhook');
  console.log('   POST /api/shopify/sync/products');
  console.log('   POST /api/shopify/sync/all');
  console.log('   GET  /api/products');
  console.log('   GET  /api/categories');
  console.log('   GET  /api/stats');
  console.log('');
});

module.exports = app;