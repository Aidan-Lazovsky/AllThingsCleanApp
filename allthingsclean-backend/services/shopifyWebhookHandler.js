// services/shopifyWebhookHandler.js - Handle Shopify webhook events

const crypto = require('crypto');
const shopifyService = require('./shopify');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Order = require('../models/Order');

class ShopifyWebhookHandler {
  /**
   * Verify webhook authenticity
   */
  verifyWebhook(body, hmacHeader) {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET;
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');
    
    return hash === hmacHeader;
  }

  /**
   * Process webhook event
   */
  async handleWebhook(topic, data) {
    console.log(`📥 Processing webhook: ${topic}`);

    try {
      switch (topic) {
        case 'products/create':
        case 'products/update':
          await this.handleProductUpdate(data);
          break;

        case 'products/delete':
          await this.handleProductDelete(data);
          break;

        case 'customers/create':
        case 'customers/update':
          await this.handleCustomerUpdate(data);
          break;

        case 'customers/delete':
          await this.handleCustomerDelete(data);
          break;

        case 'orders/create':
        case 'orders/updated':
          await this.handleOrderUpdate(data);
          break;

        case 'orders/cancelled':
          await this.handleOrderCancelled(data);
          break;

        default:
          console.log(`Unhandled webhook topic: ${topic}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Webhook processing error:', error);
      return { success: false, error: error.message };
    }
  }

  // ===== PRODUCT HANDLERS =====

  async handleProductUpdate(shopifyProduct) {
    console.log(`Syncing product: ${shopifyProduct.id}`);

    try {
      const productData = this.convertShopifyProduct(shopifyProduct);

      await Product.findOneAndUpdate(
        { shopifyId: shopifyProduct.id.toString() },
        productData,
        { upsert: true, new: true }
      );

      console.log(`✅ Product ${shopifyProduct.id} synced`);
    } catch (error) {
      console.error(`Error syncing product ${shopifyProduct.id}:`, error);
      throw error;
    }
  }

  async handleProductDelete(data) {
    const productId = data.id;
    console.log(`Deleting product: ${productId}`);

    await Product.findOneAndDelete({ shopifyId: productId.toString() });

    console.log(`✅ Product ${productId} deleted`);
  }

  convertShopifyProduct(product) {
    // Get main variant (usually first one)
    const mainVariant = product.variants?.[0] || {};
    
    // Get main image
    const mainImage = product.images?.[0]?.src || product.image?.src || 'https://via.placeholder.com/400';
    
    // Get all images
    const images = product.images?.map(img => img.src) || [];

    return {
      shopifyId: product.id.toString(),
      name: product.title,
      brand: product.vendor || 'Unknown',
      category: product.product_type || 'Uncategorized',
      price: parseFloat(mainVariant.price || 0),
      compareAtPrice: parseFloat(mainVariant.compare_at_price || 0),
      description: product.body_html || '',
      imageUrl: mainImage,
      images: images,
      inStock: mainVariant.inventory_quantity > 0,
      stockQuantity: mainVariant.inventory_quantity || 0,
      sku: mainVariant.sku,
      barcode: mainVariant.barcode,
      tags: product.tags ? product.tags.split(', ') : [],
      variants: product.variants?.map(v => ({
        id: v.id,
        title: v.title,
        price: parseFloat(v.price),
        sku: v.sku,
        inventoryQuantity: v.inventory_quantity,
      })) || [],
      isNew: product.tags?.includes('new') || false,
      isFeatured: product.tags?.includes('featured') || false,
      dateAdded: product.created_at,
      lastUpdated: product.updated_at,
    };
  }

  // ===== CUSTOMER HANDLERS =====

  async handleCustomerUpdate(shopifyCustomer) {
    console.log(`Syncing customer: ${shopifyCustomer.id}`);

    try {
      const customerData = this.convertShopifyCustomer(shopifyCustomer);

      await Customer.findOneAndUpdate(
        { shopifyId: shopifyCustomer.id.toString() },
        customerData,
        { upsert: true, new: true }
      );

      console.log(`✅ Customer ${shopifyCustomer.id} synced`);
    } catch (error) {
      console.error(`Error syncing customer ${shopifyCustomer.id}:`, error);
      throw error;
    }
  }

  async handleCustomerDelete(data) {
    const customerId = data.id;
    console.log(`Deleting customer: ${customerId}`);

    await Customer.findOneAndDelete({ shopifyId: customerId.toString() });

    console.log(`✅ Customer ${customerId} deleted`);
  }

  convertShopifyCustomer(customer) {
    const defaultAddress = customer.default_address || {};

    return {
      shopifyId: customer.id.toString(),
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      ordersCount: customer.orders_count || 0,
      totalSpent: parseFloat(customer.total_spent || 0),
      address: {
        address1: defaultAddress.address1,
        address2: defaultAddress.address2,
        city: defaultAddress.city,
        province: defaultAddress.province,
        country: defaultAddress.country,
        zip: defaultAddress.zip,
      },
      tags: customer.tags ? customer.tags.split(', ') : [],
      dateAdded: customer.created_at,
      lastUpdated: customer.updated_at,
    };
  }

  // ===== ORDER HANDLERS =====

  async handleOrderUpdate(shopifyOrder) {
    console.log(`Syncing order: ${shopifyOrder.id}`);

    try {
      const orderData = this.convertShopifyOrder(shopifyOrder);

      await Order.findOneAndUpdate(
        { shopifyId: shopifyOrder.id.toString() },
        orderData,
        { upsert: true, new: true }
      );

      console.log(`✅ Order ${shopifyOrder.id} synced`);
    } catch (error) {
      console.error(`Error syncing order ${shopifyOrder.id}:`, error);
      throw error;
    }
  }

  async handleOrderCancelled(shopifyOrder) {
    console.log(`Order cancelled: ${shopifyOrder.id}`);

    await Order.findOneAndUpdate(
      { shopifyId: shopifyOrder.id.toString() },
      { 
        status: 'cancelled',
        cancelledAt: shopifyOrder.cancelled_at,
        lastUpdated: new Date(),
      }
    );

    console.log(`✅ Order ${shopifyOrder.id} marked as cancelled`);
  }

  convertShopifyOrder(order) {
    return {
      shopifyId: order.id.toString(),
      orderNumber: order.order_number,
      customerId: order.customer?.id?.toString(),
      customerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim(),
      customerEmail: order.email,
      items: order.line_items?.map(item => ({
        productId: item.product_id?.toString(),
        variantId: item.variant_id?.toString(),
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        total: parseFloat(item.price) * item.quantity,
        sku: item.sku,
      })) || [],
      subtotal: parseFloat(order.subtotal_price || 0),
      tax: parseFloat(order.total_tax || 0),
      shipping: parseFloat(order.total_shipping_price_set?.shop_money?.amount || 0),
      total: parseFloat(order.total_price || 0),
      currency: order.currency,
      status: order.financial_status, // pending, paid, refunded, etc.
      fulfillmentStatus: order.fulfillment_status, // fulfilled, partial, unfulfilled
      shippingAddress: order.shipping_address,
      billingAddress: order.billing_address,
      dateCreated: order.created_at,
      dateUpdated: order.updated_at,
      lastUpdated: new Date(),
    };
  }
}

module.exports = new ShopifyWebhookHandler();