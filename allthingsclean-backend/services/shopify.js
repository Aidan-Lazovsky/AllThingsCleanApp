i// services/shopify.js - Shopify API Integration

const fetch = require('node-fetch');

const SHOPIFY_CONFIG = {
  shopName: process.env.SHOPIFY_SHOP_NAME, // e.g., 'your-store'
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN, // Admin API access token
  apiVersion: '2024-01', // Current stable version
};

class ShopifyService {
  constructor() {
    this.baseURL = `https://${SHOPIFY_CONFIG.shopName}.myshopify.com/admin/api/${SHOPIFY_CONFIG.apiVersion}`;
    this.accessToken = SHOPIFY_CONFIG.accessToken;
  }

  /**
   * Make authenticated API request to Shopify
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log(`Shopify API Request: ${options.method || 'GET'} ${endpoint}`);
      const response = await fetch(url, config);
      
      // Check rate limit
      const rateLimitRemaining = response.headers.get('X-Shopify-Shop-Api-Call-Limit');
      if (rateLimitRemaining) {
        console.log(`Rate limit: ${rateLimitRemaining}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Shopify API Error:', error);
      throw error;
    }
  }

  // ===== PRODUCT METHODS =====

  /**
   * Get all products
   * @param {Object} params - Query parameters
   */
  async getProducts(params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 250, // Max 250 per request
      ...params,
    });

    const response = await this.request(`/products.json?${queryParams}`);
    return response.products || [];
  }

  /**
   * Get single product by ID
   */
  async getProductById(productId) {
    const response = await this.request(`/products/${productId}.json`);
    return response.product;
  }

  /**
   * Get products with pagination
   */
  async getAllProducts() {
    let allProducts = [];
    let pageInfo = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const params = pageInfo 
        ? { limit: 250, page_info: pageInfo }
        : { limit: 250 };

      const queryParams = new URLSearchParams(params);
      const response = await this.request(`/products.json?${queryParams}`);
      
      allProducts = allProducts.concat(response.products || []);

      // Check for next page (Link header)
      const linkHeader = response.headers?.get('Link');
      hasNextPage = linkHeader && linkHeader.includes('rel="next"');
      
      if (hasNextPage) {
        // Extract page_info from Link header
        const nextMatch = linkHeader.match(/page_info=([^&>]+)/);
        pageInfo = nextMatch ? nextMatch[1] : null;
      }
    }

    return allProducts;
  }

  /**
   * Search products
   */
  async searchProducts(query) {
    const response = await this.request(`/products.json?title=${encodeURIComponent(query)}`);
    return response.products || [];
  }

  /**
   * Get product inventory
   */
  async getProductInventory(productId) {
    const response = await this.request(`/products/${productId}.json`);
    const product = response.product;
    
    // Return inventory for each variant
    return product.variants.map(variant => ({
      variantId: variant.id,
      sku: variant.sku,
      inventoryQuantity: variant.inventory_quantity,
      inventoryPolicy: variant.inventory_policy,
    }));
  }

  // ===== CUSTOMER METHODS =====

  /**
   * Get all customers
   */
  async getCustomers(params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 250,
      ...params,
    });

    const response = await this.request(`/customers.json?${queryParams}`);
    return response.customers || [];
  }

  /**
   * Get single customer by ID
   */
  async getCustomerById(customerId) {
    const response = await this.request(`/customers/${customerId}.json`);
    return response.customer;
  }

  /**
   * Search customers by email
   */
  async searchCustomerByEmail(email) {
    const response = await this.request(`/customers/search.json?query=email:${encodeURIComponent(email)}`);
    return response.customers?.[0] || null;
  }

  // ===== ORDER METHODS =====

  /**
   * Get all orders
   */
  async getOrders(params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 250,
      status: params.status || 'any', // any, open, closed, cancelled
      ...params,
    });

    const response = await this.request(`/orders.json?${queryParams}`);
    return response.orders || [];
  }

  /**
   * Get single order by ID
   */
  async getOrderById(orderId) {
    const response = await this.request(`/orders/${orderId}.json`);
    return response.order;
  }

  /**
   * Get orders for a specific customer
   */
  async getOrdersByCustomer(customerId) {
    const response = await this.request(`/customers/${customerId}/orders.json`);
    return response.orders || [];
  }

  // ===== COLLECTION (CATEGORY) METHODS =====

  /**
   * Get all collections (categories)
   */
  async getCollections(params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 250,
      ...params,
    });

    // Get custom collections
    const customResponse = await this.request(`/custom_collections.json?${queryParams}`);
    const customCollections = customResponse.custom_collections || [];

    // Get smart collections
    const smartResponse = await this.request(`/smart_collections.json?${queryParams}`);
    const smartCollections = smartResponse.smart_collections || [];

    return [...customCollections, ...smartCollections];
  }

  /**
   * Get products in a collection
   */
  async getCollectionProducts(collectionId) {
    const response = await this.request(`/collections/${collectionId}/products.json`);
    return response.products || [];
  }

  // ===== WEBHOOK METHODS =====

  /**
   * Create a webhook
   */
  async createWebhook(topic, address) {
    const response = await this.request('/webhooks.json', {
      method: 'POST',
      body: JSON.stringify({
        webhook: {
          topic: topic,
          address: address,
          format: 'json',
        },
      }),
    });
    return response.webhook;
  }

  /**
   * Get all webhooks
   */
  async getWebhooks() {
    const response = await this.request('/webhooks.json');
    return response.webhooks || [];
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId) {
    await this.request(`/webhooks/${webhookId}.json`, {
      method: 'DELETE',
    });
    return true;
  }

  /**
   * Register all necessary webhooks
   */
  async registerWebhooks(baseUrl) {
    const webhookTopics = [
      'products/create',
      'products/update',
      'products/delete',
      'customers/create',
      'customers/update',
      'customers/delete',
      'orders/create',
      'orders/updated',
      'orders/cancelled',
    ];

    const webhooks = [];
    for (const topic of webhookTopics) {
      try {
        const webhook = await this.createWebhook(topic, `${baseUrl}/api/shopify/webhook`);
        webhooks.push(webhook);
        console.log(`✅ Webhook registered: ${topic}`);
      } catch (error) {
        console.error(`❌ Failed to register webhook: ${topic}`, error.message);
      }
    }

    return webhooks;
  }

  // ===== SHOP INFO =====

  /**
   * Get shop information
   */
  async getShopInfo() {
    const response = await this.request('/shop.json');
    return response.shop;
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const shop = await this.getShopInfo();
      return {
        success: true,
        shop: {
          name: shop.name,
          email: shop.email,
          domain: shop.domain,
          currency: shop.currency,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new ShopifyService();