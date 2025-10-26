// services/lightspeed.js - Lightspeed API Integration

const LIGHTSPEED_CONFIG = {
  // Get these from Lightspeed Back Office
  accountID: process.env.LIGHTSPEED_ACCOUNT_ID || 'YOUR_ACCOUNT_ID',
  apiKey: process.env.LIGHTSPEED_API_KEY || 'YOUR_API_KEY',
  apiSecret: process.env.LIGHTSPEED_API_SECRET || 'YOUR_API_SECRET',
  
  // API Base URLs
  baseURL: 'https://api.lightspeedapp.com/API/Account',
  version: 'V3', // or 'V3' depending on your version
};

class LightspeedService {
  constructor() {
    this.baseURL = `${LIGHTSPEED_CONFIG.baseURL}/${LIGHTSPEED_CONFIG.accountID}`;
    this.authHeader = this.getAuthHeader();
  }

  // Generate Basic Auth header
  getAuthHeader() {
    const credentials = Buffer.from(
      `${LIGHTSPEED_CONFIG.apiKey}:${LIGHTSPEED_CONFIG.apiSecret}`
    ).toString('base64');
    return `Basic ${credentials}`;
  }

  // Make API request to Lightspeed
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log('Lightspeed API Request:', url);
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
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
   * Get all items (products) from Lightspeed
   * @param {Object} params - Query parameters (limit, offset, etc.)
   */
  async getItems(params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 100,
      offset: params.offset || 0,
      ...params,
    });

    const response = await this.request(`/Item.json?${queryParams}`);
    return response.Item || [];
  }

  /**
   * Get a single item by ID
   * @param {string} itemId - Lightspeed Item ID
   */
  async getItemById(itemId) {
    const response = await this.request(`/Item/${itemId}.json`);
    return response.Item;
  }

  /**
   * Search items by description or custom SKU
   * @param {string} query - Search query
   */
  async searchItems(query) {
    const response = await this.request(
      `/Item.json?or=description=~${encodeURIComponent(query)},customSku=~${encodeURIComponent(query)}`
    );
    return response.Item || [];
  }

  /**
   * Get items by category
   * @param {string} categoryId - Lightspeed Category ID
   */
  async getItemsByCategory(categoryId) {
    const response = await this.request(`/Item.json?categoryID=${categoryId}`);
    return response.Item || [];
  }

  /**
   * Update item inventory
   * @param {string} itemId - Lightspeed Item ID
   * @param {number} quantity - New quantity
   */
  async updateItemInventory(itemId, quantity) {
    const itemShopId = await this.getItemShopId(itemId);
    
    const response = await this.request(`/ItemShop/${itemShopId}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        ItemShop: {
          qoh: quantity, // Quantity on Hand
        },
      }),
    });
    
    return response.ItemShop;
  }

  /**
   * Get ItemShop ID (needed for inventory updates)
   */
  async getItemShopId(itemId) {
    const response = await this.request(`/ItemShop.json?itemID=${itemId}`);
    return response.ItemShop?.itemShopID || null;
  }

  // ===== CATEGORY METHODS =====

  /**
   * Get all categories
   */
  async getCategories() {
    const response = await this.request('/Category.json');
    return response.Category || [];
  }

  /**
   * Get category by ID
   * @param {string} categoryId - Lightspeed Category ID
   */
  async getCategoryById(categoryId) {
    const response = await this.request(`/Category/${categoryId}.json`);
    return response.Category;
  }

  // ===== CUSTOMER METHODS =====

  /**
   * Get all customers
   * @param {Object} params - Query parameters
   */
  async getCustomers(params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 100,
      offset: params.offset || 0,
      ...params,
    });

    const response = await this.request(`/Customer.json?${queryParams}`);
    return response.Customer || [];
  }

  /**
   * Get customer by ID
   * @param {string} customerId - Lightspeed Customer ID
   */
  async getCustomerById(customerId) {
    const response = await this.request(`/Customer/${customerId}.json`);
    return response.Customer;
  }

  /**
   * Search customer by email
   * @param {string} email - Customer email
   */
  async getCustomerByEmail(email) {
    const response = await this.request(`/Customer.json?Contact.email=${encodeURIComponent(email)}`);
    return response.Customer?.[0] || null;
  }

  /**
   * Create a new customer
   * @param {Object} customerData - Customer information
   */
  async createCustomer(customerData) {
    const response = await this.request('/Customer.json', {
      method: 'POST',
      body: JSON.stringify({
        Customer: {
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          Contact: {
            Emails: {
              ContactEmail: {
                address: customerData.email,
              },
            },
            Phones: {
              ContactPhone: customerData.phone ? {
                number: customerData.phone,
              } : undefined,
            },
          },
        },
      }),
    });
    
    return response.Customer;
  }

  // ===== SALE (ORDER) METHODS =====

  /**
   * Get all sales (orders)
   * @param {Object} params - Query parameters
   */
  async getSales(params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 100,
      offset: params.offset || 0,
      ...params,
    });

    const response = await this.request(`/Sale.json?${queryParams}`);
    return response.Sale || [];
  }

  /**
   * Get sale by ID
   * @param {string} saleId - Lightspeed Sale ID
   */
  async getSaleById(saleId) {
    const response = await this.request(`/Sale/${saleId}.json`);
    return response.Sale;
  }

  /**
   * Create a new sale (order)
   * @param {Object} saleData - Order information
   */
  async createSale(saleData) {
    const response = await this.request('/Sale.json', {
      method: 'POST',
      body: JSON.stringify({
        Sale: {
          customerID: saleData.customerId,
          completed: saleData.completed || false,
          SaleLines: {
            SaleLine: saleData.items.map(item => ({
              itemID: item.itemId,
              unitQuantity: item.quantity,
              unitPrice: item.price,
            })),
          },
        },
      }),
    });
    
    return response.Sale;
  }

  /**
   * Complete a sale (mark as paid)
   * @param {string} saleId - Lightspeed Sale ID
   */
  async completeSale(saleId) {
    const response = await this.request(`/Sale/${saleId}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        Sale: {
          completed: true,
        },
      }),
    });
    
    return response.Sale;
  }

  // ===== HELPER METHODS =====

  /**
   * Test connection to Lightspeed
   */
  async testConnection() {
    try {
      const response = await this.request('/Shop.json');
      return {
        success: true,
        shop: response.Shop,
        message: 'Connected to Lightspeed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get shop information
   */
  async getShopInfo() {
    const response = await this.request('/Shop.json');
    return response.Shop;
  }
}

// Export singleton instance
const lightspeedService = new LightspeedService();
export default lightspeedService;