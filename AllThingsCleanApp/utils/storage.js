import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage helper utilities for AsyncStorage
 */

const STORAGE_KEYS = {
  USER_TOKEN: 'userToken',
  USER_DATA: 'userData',
  CART_DATA: 'cartData',
  RECENT_SEARCHES: 'recentSearches',
  FAVORITES: 'favorites',
};

class StorageService {
  /**
   * Save data to storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store (will be JSON stringified)
   */
  async setItem(key, value) {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
      return true;
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
      return false;
    }
  }

  /**
   * Get data from storage
   * @param {string} key - Storage key
   * @returns {Promise<any>} Parsed value or null
   */
  async getItem(key) {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error(`Error reading ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove item from storage
   * @param {string} key - Storage key
   */
  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all storage
   */
  async clearAll() {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      return false;
    }
  }

  /**
   * Get multiple items at once
   * @param {string[]} keys - Array of keys to retrieve
   */
  async multiGet(keys) {
    try {
      const values = await AsyncStorage.multiGet(keys);
      const result = {};
      values.forEach(([key, value]) => {
        result[key] = value ? JSON.parse(value) : null;
      });
      return result;
    } catch (error) {
      console.error('Error reading multiple items:', error);
      return null;
    }
  }

  /**
   * Set multiple items at once
   * @param {Object} keyValuePairs - Object with key-value pairs
   */
  async multiSet(keyValuePairs) {
    try {
      const pairs = Object.entries(keyValuePairs).map(([key, value]) => [
        key,
        JSON.stringify(value),
      ]);
      await AsyncStorage.multiSet(pairs);
      return true;
    } catch (error) {
      console.error('Error saving multiple items:', error);
      return false;
    }
  }

  // ===== AUTH METHODS =====

  async saveAuthToken(token) {
    return this.setItem(STORAGE_KEYS.USER_TOKEN, token);
  }

  async getAuthToken() {
    return this.getItem(STORAGE_KEYS.USER_TOKEN);
  }

  async removeAuthToken() {
    return this.removeItem(STORAGE_KEYS.USER_TOKEN);
  }

  async saveUserData(userData) {
    return this.setItem(STORAGE_KEYS.USER_DATA, userData);
  }

  async getUserData() {
    return this.getItem(STORAGE_KEYS.USER_DATA);
  }

  async removeUserData() {
    return this.removeItem(STORAGE_KEYS.USER_DATA);
  }

  // ===== CART METHODS =====

  async saveCart(cartData) {
    return this.setItem(STORAGE_KEYS.CART_DATA, cartData);
  }

  async getCart() {
    return this.getItem(STORAGE_KEYS.CART_DATA);
  }

  async clearCart() {
    return this.removeItem(STORAGE_KEYS.CART_DATA);
  }

  // ===== SEARCH HISTORY METHODS =====

  async addRecentSearch(searchTerm) {
    try {
      const recentSearches = (await this.getItem(STORAGE_KEYS.RECENT_SEARCHES)) || [];
      
      // Remove if already exists
      const filtered = recentSearches.filter(term => term !== searchTerm);
      
      // Add to beginning
      filtered.unshift(searchTerm);
      
      // Keep only last 10
      const updated = filtered.slice(0, 10);
      
      return this.setItem(STORAGE_KEYS.RECENT_SEARCHES, updated);
    } catch (error) {
      console.error('Error adding recent search:', error);
      return false;
    }
  }

  async getRecentSearches() {
    return this.getItem(STORAGE_KEYS.RECENT_SEARCHES) || [];
  }

  async clearRecentSearches() {
    return this.removeItem(STORAGE_KEYS.RECENT_SEARCHES);
  }

  // ===== FAVORITES METHODS =====

  async addFavorite(productId) {
    try {
      const favorites = (await this.getItem(STORAGE_KEYS.FAVORITES)) || [];
      
      if (!favorites.includes(productId)) {
        favorites.push(productId);
        return this.setItem(STORAGE_KEYS.FAVORITES, favorites);
      }
      
      return true;
    } catch (error) {
      console.error('Error adding favorite:', error);
      return false;
    }
  }

  async removeFavorite(productId) {
    try {
      const favorites = (await this.getItem(STORAGE_KEYS.FAVORITES)) || [];
      const updated = favorites.filter(id => id !== productId);
      return this.setItem(STORAGE_KEYS.FAVORITES, updated);
    } catch (error) {
      console.error('Error removing favorite:', error);
      return false;
    }
  }

  async getFavorites() {
    return this.getItem(STORAGE_KEYS.FAVORITES) || [];
  }

  async isFavorite(productId) {
    const favorites = await this.getFavorites();
    return favorites.includes(productId);
  }

  async clearFavorites() {
    return this.removeItem(STORAGE_KEYS.FAVORITES);
  }

  // ===== UTILITY METHODS =====

  /**
   * Get all keys in storage
   */
  async getAllKeys() {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('Error getting all keys:', error);
      return [];
    }
  }

  /**
   * Get storage size (for debugging)
   */
  async getStorageSize() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const items = await AsyncStorage.multiGet(keys);
      let totalSize = 0;

      items.forEach(([key, value]) => {
        totalSize += key.length + (value ? value.length : 0);
      });

      return {
        itemCount: keys.length,
        totalBytes: totalSize,
        totalKB: (totalSize / 1024).toFixed(2),
      };
    } catch (error) {
      console.error('Error calculating storage size:', error);
      return null;
    }
  }
}

// Export singleton instance
const storageService = new StorageService();
export default storageService;

// Also export the keys for direct use if needed
export { STORAGE_KEYS };

