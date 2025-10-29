// services/lightspeedRSeries.js - Lightspeed R-Series API Integration

const fetch = require('node-fetch');

const LIGHTSPEED_CONFIG = {
  clientId: process.env.LIGHTSPEED_CLIENT_ID,
  clientSecret: process.env.LIGHTSPEED_CLIENT_SECRET,
  redirectUri: process.env.LIGHTSPEED_REDIRECT_URI,
  baseURL: 'https://api.lightspeedapp.com/API/V3/Account',
  authURL: 'https://cloud.lightspeedapp.com/oauth',
};

class LightspeedRSeriesService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.accountId = null;
    this.tokenExpiry = null;
  }

  // ===== OAUTH METHODS =====

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationURL(state = 'random_state_string') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: LIGHTSPEED_CONFIG.clientId,
      scope: 'employee:all',
      state: state,
    });
    
    return `${LIGHTSPEED_CONFIG.authURL}/authorize.php?${params}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from callback
   */
  async getAccessToken(code) {
    try {
      const response = await fetch(`${LIGHTSPEED_CONFIG.authURL}/access_token.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: LIGHTSPEED_CONFIG.clientId,
          client_secret: LIGHTSPEED_CONFIG.clientSecret,
          code: code,
          grant_type: 'authorization_code',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || 'Failed to get access token');
      }

      // Store tokens
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.accountId = data.account_id;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);

      // Save to database for persistence
      await this.saveTokens({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        accountId: this.accountId,
        expiresAt: new Date(this.tokenExpiry),
      });

      return {
        success: true,
        accountId: this.accountId,
      };
    } catch (error) {
      console.error('OAuth token error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    try {
      const response = await fetch(`${LIGHTSPEED_CONFIG.authURL}/access_token.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: this.refreshToken,
          client_id: LIGHTSPEED_CONFIG.clientId,
          client_secret: LIGHTSPEED_CONFIG.clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);

      await this.saveTokens({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        accountId: this.accountId,
        expiresAt: new Date(this.tokenExpiry),
      });

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  /**
   * Check if token is expired and refresh if needed
   */
  async ensureValidToken() {
    if (!this.accessToken) {
      // Load tokens from database
      await this.loadTokens();
    }

    if (!this.accessToken) {
      throw new Error('Not authenticated. Please complete OAuth flow.');
    }

    // Refresh if expired or expiring soon (5 minutes buffer)
    if (Date.now() >= this.tokenExpiry - (5 * 60 * 1000)) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Save tokens to database (implement based on your database)
   */
  async saveTokens(tokens) {
    // TODO: Implement database save
    // Example with MongoDB:
    // await TokenModel.updateOne(
    //   { provider: 'lightspeed' },
    //   { $set: tokens },
    //   { upsert: true }
    // );
    console.log('Tokens saved:', { accountId: tokens.accountId });
  }

  /**
   * Load tokens from database
   */
  async loadTokens() {
    // TODO: Implement database load
    // Example with MongoDB:
    // const tokenDoc = await TokenModel.findOne({ provider: 'lightspeed' });
    // if (tokenDoc) {
    //   this.accessToken = tokenDoc.accessToken;
    //   this.refreshToken = tokenDoc.refreshToken;
    //   this.accountId = tokenDoc.accountId;
    //   this.tokenExpiry = tokenDoc.expiresAt.getTime();
    // }
  }

  // ===== API REQUEST METHOD =====

  /**
   * Make authenticated API request
   */
  async request(endpoint, options = {}) {
    await this.ensureValidToken();

    const url = `${LIGHTSPEED_CONFIG.baseURL}/${this.accountId}${endpoint}`;
    const config = {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Token might be invalid, try refresh once
        if (response.status === 401) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            // Retry request with new token
            config.headers.Authorization = `Bearer ${this.accessToken}`;
            const retryResponse = await fetch(url, config);
            return await retryResponse.json();
          }
        }
        
        throw new Error(data.message || 'Lightspeed API Error');
      }

      return data;
    } catch (error) {
      console.error('Lightspeed API Error:', error);
      throw error;
    }
  }

  // ===== PRODUCT METHODS =====

  /**
   * Get all items (products)
   */
  async getItems(params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 100,
      offset: params.offset || 0,
      load_relations: JSON.stringify(['Category', 'ItemShops', 'Images', 'Manufacturer']),
      ...params,
    });

    const response = await this.request(`/Item.json?${queryParams}`);
    return response.Item || [];
  }

  /**
   * Get single item by ID
   */
  async getItemById(itemId) {
    const response = await this.request(
      `/Item/${itemId}.json?load_relations=${JSON.stringify(['Category', 'ItemShops', 'Images', 'Manufacturer'])}`
    );
    return response.Item;
  }

  /**
   * Get items updated after a specific time
   */
  async getItemsUpdatedSince(timestamp) {
    const response = await this.request(
      `/Item.json?timeStamp=>,${timestamp}&load_relations=${JSON.stringify(['Category', 'ItemShops', 'Images'])}`
    );
    return response.Item || [];
  }

  // ===== CUSTOMER METHODS =====

  /**
   * Get all customers
   */
  async getCustomers(params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 100,
      offset: params.offset || 0,
      load_relations: JSON.stringify(['Contact']),
      ...params,
    });

    const response = await this.request(`/Customer.json?${queryParams}`);
    return response.Customer || [];
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId) {
    const response = await this.request(
      `/Customer/${customerId}.json?load_relations=${JSON.stringify(['Contact'])}`
    );
    return response.Customer;
  }

  /**
   * Get customers updated after a specific time
   */
  async getCustomersUpdatedSince(timestamp) {
    const response = await this.request(
      `/Customer.json?timeStamp=>,${timestamp}&load_relations=${JSON.stringify(['Contact'])}`
    );
    return response.Customer || [];
  }

  // ===== SALE (ORDER) METHODS =====

  /**
   * Get all sales (orders)
   */
  async getSales(params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 100,
      offset: params.offset || 0,
      load_relations: JSON.stringify(['Customer', 'SaleLines']),
      ...params,
    });

    const response = await this.request(`/Sale.json?${queryParams}`);
    return response.Sale || [];
  }

  /**
   * Get sale by ID
   */
  async getSaleById(saleId) {
    const response = await this.request(
      `/Sale/${saleId}.json?load_relations=${JSON.stringify(['Customer', 'SaleLines', 'SalePayments'])}`
    );
    return response.Sale;
  }

  /**
   * Get sales updated after a specific time
   */
  async getSalesUpdatedSince(timestamp) {
    const response = await this.request(
      `/Sale.json?timeStamp=>,${timestamp}&load_relations=${JSON.stringify(['Customer', 'SaleLines'])}`
    );
    return response.Sale || [];
  }

  // ===== CATEGORY METHODS =====

  /**
   * Get all categories
   */
  async getCategories() {
    const response = await this.request('/Category.json');
    return response.Category || [];
  }

  // ===== WEBHOOK METHODS =====

  /**
   * Register webhook for events
   */
  async registerWebhook(webhookUrl, topics = ['item.update', 'customer.update', 'sale.update']) {
    try {
      const response = await this.request('/Webhook.json', {
        method: 'POST',
        body: JSON.stringify({
          Webhook: {
            url: webhookUrl,
            topic: topics.join(','),
            format: 'json',
          },
        }),
      });
      
      return response.Webhook;
    } catch (error) {
      console.error('Webhook registration error:', error);
      throw error;
    }
  }

  /**
   * Get all registered webhooks
   */
  async getWebhooks() {
    const response = await this.request('/Webhook.json');
    return response.Webhook || [];
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId) {
    await this.request(`/Webhook/${webhookId}.json`, {
      method: 'DELETE',
    });
    return true;
  }

  // ===== UTILITY METHODS =====

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      await this.ensureValidToken();
      const response = await this.request('/Shop.json');
      return {
        success: true,
        shop: response.Shop,
        accountId: this.accountId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new LightspeedRSeriesService();