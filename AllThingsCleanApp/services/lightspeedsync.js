// services/lightspeedSync.js - Sync data between AllThingsClean and Lightspeed

import lightspeedService from './lightspeed';

class LightspeedSyncService {
  /**
   * Convert Lightspeed Item to our Product format
   */
  convertLightspeedItemToProduct(item) {
    return {
      id: item.itemID,
      lightspeedId: item.itemID,
      name: item.description || item.customSku,
      brand: item.manufacturerName || 'Unknown',
      category: item.Category?.name || 'Uncategorized',
      price: parseFloat(item.Prices?.ItemPrice?.[0]?.amount || 0),
      description: item.longDescription || item.description || '',
      imageUrl: item.Images?.Image?.[0]?.baseImageURL || 'https://via.placeholder.com/400',
      images: item.Images?.Image?.map(img => img.baseImageURL) || [],
      inStock: parseInt(item.ItemShops?.ItemShop?.[0]?.qoh || 0) > 0,
      stockQuantity: parseInt(item.ItemShops?.ItemShop?.[0]?.qoh || 0),
      isNew: false,
      isFeatured: false,
      popularity: 0,
      ratings: { average: 0, count: 0 },
      dateAdded: item.createTime,
      sku: item.customSku,
    };
  }

  /**
   * Sync all products from Lightspeed
   */
  async syncProducts() {
    try {
      console.log('Starting product sync from Lightspeed...');
      
      // Get all items from Lightspeed
      const lightspeedItems = await lightspeedService.getItems({ limit: 1000 });
      
      // Convert to our product format
      const products = Array.isArray(lightspeedItems)
        ? lightspeedItems.map(item => this.convertLightspeedItemToProduct(item))
        : [this.convertLightspeedItemToProduct(lightspeedItems)];
      
      console.log(`Synced ${products.length} products from Lightspeed`);
      
      // TODO: Save to your database
      // For now, return the products
      return {
        success: true,
        products,
        count: products.length,
      };
    } catch (error) {
      console.error('Product sync error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Sync categories from Lightspeed
   */
  async syncCategories() {
    try {
      console.log('Starting category sync from Lightspeed...');
      
      const lightspeedCategories = await lightspeedService.getCategories();
      
      const categories = Array.isArray(lightspeedCategories)
        ? lightspeedCategories.map(cat => cat.name)
        : [lightspeedCategories.name];
      
      console.log(`Synced ${categories.length} categories from Lightspeed`);
      
      return {
        success: true,
        categories,
        count: categories.length,
      };
    } catch (error) {
      console.error('Category sync error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create order in Lightspeed
   */
  async createLightspeedOrder(orderData) {
    try {
      // 1. Find or create customer
      let customer = await lightspeedService.getCustomerByEmail(orderData.customerEmail);
      
      if (!customer) {
        customer = await lightspeedService.createCustomer({
          firstName: orderData.customerName.split(' ')[0],
          lastName: orderData.customerName.split(' ').slice(1).join(' '),
          email: orderData.customerEmail,
          phone: orderData.customerPhone,
        });
      }

      // 2. Create sale with line items
      const saleData = {
        customerId: customer.customerID,
        completed: false,
        items: orderData.items.map(item => ({
          itemId: item.lightspeedId || item.id,
          quantity: item.quantity,
          price: item.price,
        })),
      };

      const sale = await lightspeedService.createSale(saleData);

      // 3. Complete the sale if payment is confirmed
      if (orderData.paid) {
        await lightspeedService.completeSale(sale.saleID);
      }

      return {
        success: true,
        saleId: sale.saleID,
        sale,
      };
    } catch (error) {
      console.error('Create order error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update product inventory in Lightspeed
   */
  async updateInventory(productId, quantity) {
    try {
      await lightspeedService.updateItemInventory(productId, quantity);
      
      return {
        success: true,
        message: 'Inventory updated successfully',
      };
    } catch (error) {
      console.error('Inventory update error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Test Lightspeed connection
   */
  async testConnection() {
    return await lightspeedService.testConnection();
  }
}

// Export singleton instance
const lightspeedSyncService = new LightspeedSyncService();
export default lightspeedSyncService;