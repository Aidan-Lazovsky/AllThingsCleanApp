// services/lightspeedWebhookHandler.js - Handle Lightspeed webhook events

const lightspeedService = require('./lightspeedRSeries');
const Product = require('../models/Product'); // Your product model
const Customer = require('../models/Customer'); // Your customer model
const Order = require('../models/Order'); // Your order model

class WebhookHandler {
  /**
   * Process webhook event
   */
  async handleWebhook(event) {
    const { topic, data } = event;

    console.log(`Received webhook: ${topic}`, data);

    try {
      switch (topic) {
        case 'item.update':
        case 'item.create':
          await this.handleItemUpdate(data.itemID);
          break;

        case 'item.delete':
          await this.handleItemDelete(data.itemID);
          break;

        case 'customer.update':
        case 'customer.create':
          await this.handleCustomerUpdate(data.customerID);
          break;

        case 'customer.delete':
          await this.handleCustomerDelete(data.customerID);
          break;

        case 'sale.update':
        case 'sale.create':
          await this.handleSaleUpdate(data.saleID);
          break;

        case 'sale.delete':
          await this.handleSaleDelete(data.saleID);
          break;

        default:
          console.log(`Unhandled webhook topic: ${topic}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Webhook handling error:', error);
      return { success: false, error: error.message };
    }
  }

  // ===== ITEM/PRODUCT HANDLERS =====

  async handleItemUpdate(itemId) {
    console.log(`Syncing product ${itemId}...`);
    
    try {
      // Fetch item from Lightspeed
      const item = await lightspeedService.getItemById(itemId);
      
      // Convert to our product format
      const productData = this.convertItemToProduct(item);
      
      // Update or create in database
      await Product.findOneAndUpdate(
        { lightspeedId: itemId },
        productData,
        { upsert: true, new: true }
      );
      
      console.log(`Product ${itemId} synced successfully`);
    } catch (error) {
      console.error(`Error syncing product ${itemId}:`, error);
      throw error;
    }
  }

  async handleItemDelete(itemId) {
    console.log(`Deleting product ${itemId}...`);
    
    await Product.findOneAndDelete({ lightspeedId: itemId });
    
    console.log(`Product ${itemId} deleted`);
  }

  convertItemToProduct(item) {
    return {
      lightspeedId: item.itemID,
      name: item.description || item.customSku,
      brand: item.Manufacturer?.name || 'Unknown',
      category: item.Category?.name || 'Uncategorized',
      price: parseFloat(item.Prices?.ItemPrice?.[0]?.amount || 0),
      description: item.longDescription || item.description || '',
      imageUrl: item.Images?.Image?.[0]?.baseImageURL || 'https://via.placeholder.com/400',
      images: item.Images?.Image?.map(img => img.baseImageURL) || [],
      inStock: parseInt(item.ItemShops?.ItemShop?.[0]?.qoh || 0) > 0,
      stockQuantity: parseInt(item.ItemShops?.ItemShop?.[0]?.qoh || 0),
      sku: item.customSku,
      dateAdded: item.createTime,
      lastUpdated: item.timeStamp || new Date(),
    };
  }

  // ===== CUSTOMER HANDLERS =====

  async handleCustomerUpdate(customerId) {
    console.log(`Syncing customer ${customerId}...`);
    
    try {
      const customer = await lightspeedService.getCustomerById(customerId);
      
      const customerData = this.convertCustomer(customer);
      
      await Customer.findOneAndUpdate(
        { lightspeedId: customerId },
        customerData,
        { upsert: true, new: true }
      );
      
      console.log(`Customer ${customerId} synced successfully`);
    } catch (error) {
      console.error(`Error syncing customer ${customerId}:`, error);
      throw error;
    }
  }

  async handleCustomerDelete(customerId) {
    console.log(`Deleting customer ${customerId}...`);
    
    await Customer.findOneAndDelete({ lightspeedId: customerId });
    
    console.log(`Customer ${customerId} deleted`);
  }

  convertCustomer(customer) {
    return {
      lightspeedId: customer.customerID,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.Contact?.Emails?.ContactEmail?.address || '',
      phone: customer.Contact?.Phones?.ContactPhone?.number || '',
      company: customer.company,
      dateAdded: customer.createTime,
      lastUpdated: customer.timeStamp || new Date(),
    };
  }

  // ===== SALE/ORDER HANDLERS =====

  async handleSaleUpdate(saleId) {
    console.log(`Syncing order ${saleId}...`);
    
    try {
      const sale = await lightspeedService.getSaleById(saleId);
      
      const orderData = this.convertSale(sale);
      
      await Order.findOneAndUpdate(
        { lightspeedId: saleId },
        orderData,
        { upsert: true, new: true }
      );
      
      console.log(`Order ${saleId} synced successfully`);
    } catch (error) {
      console.error(`Error syncing order ${saleId}:`, error);
      throw error;
    }
  }

  async handleSaleDelete(saleId) {
    console.log(`Deleting order ${saleId}...`);
    
    await Order.findOneAndDelete({ lightspeedId: saleId });
    
    console.log(`Order ${saleId} deleted`);
  }

  convertSale(sale) {
    return {
      lightspeedId: sale.saleID,
      customerId: sale.customerID,
      customerName: `${sale.Customer?.firstName || ''} ${sale.Customer?.lastName || ''}`.trim(),
      items: sale.SaleLines?.SaleLine?.map(line => ({
        itemId: line.itemID,
        quantity: parseInt(line.unitQuantity),
        price: parseFloat(line.unitPrice),
        total: parseFloat(line.calcTotal),
      })) || [],
      subtotal: parseFloat(sale.calcSubtotal || 0),
      tax: parseFloat(sale.calcTax1 || 0) + parseFloat(sale.calcTax2 || 0),
      total: parseFloat(sale.calcTotal || 0),
      completed: sale.completed === 'true',
      dateCreated: sale.createTime,
      dateCompleted: sale.completeTime,
      lastUpdated: sale.timeStamp || new Date(),
    };
  }
}

module.exports = new WebhookHandler();