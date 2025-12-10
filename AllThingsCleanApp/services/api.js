// services/api.js - API Service for connecting React Native to Backend

// Enable mock mode when backend is not available
const USE_MOCK_DATA = false; // Set to false when backend is ready

// API Configuration - only used when USE_MOCK_DATA = false
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000/api'  // For development
  : 'https://allthingscleanapp-production.up.railway.app/api';  // For production

// Mock product data
const getMockProducts = () => {
  return [
    {
      id: '1',
      name: 'Miele Complete C3 Cat & Dog',
      brand: 'Miele',
      category: 'Vacuums',
      price: 1199.99,
      description: 'Powerful vacuum designed for homes with pets. Features HEPA filtration and specialized pet hair attachments. The ultimate cleaning solution for pet owners.',
      imageUrl: 'https://via.placeholder.com/400x400/1a1a1a/ffffff?text=Miele+C3',
      images: ['https://via.placeholder.com/400x400/1a1a1a/ffffff?text=Miele+C3'],
      inStock: true,
      stockQuantity: 15,
      isNew: false,
      isFeatured: true,
      popularity: 95,
      ratings: { average: 4.8, count: 234 },
      dateAdded: '2024-01-15',
    },
    {
      id: '2',
      name: 'Dupray Neat Steam Cleaner',
      brand: 'Dupray',
      category: 'Steam Cleaners',
      price: 329.99,
      description: 'Lightweight steam cleaner perfect for floors, windows, and upholstery. Chemical-free cleaning solution that kills 99.9% of germs and bacteria.',
      imageUrl: 'https://via.placeholder.com/400x400/4a90e2/ffffff?text=Dupray+Neat',
      images: ['https://via.placeholder.com/400x400/4a90e2/ffffff?text=Dupray+Neat'],
      inStock: true,
      stockQuantity: 8,
      isNew: true,
      isFeatured: true,
      popularity: 88,
      ratings: { average: 4.6, count: 156 },
      dateAdded: '2024-10-01',
    },
    {
      id: '3',
      name: 'IQAir HealthPro Plus',
      brand: 'IQAir',
      category: 'Air Purifiers',
      price: 899.00,
      description: 'Medical-grade air purifier with HyperHEPA filtration. Removes 99.5% of particles down to 0.003 microns. Perfect for allergies and asthma.',
      imageUrl: 'https://via.placeholder.com/400x400/4caf50/ffffff?text=IQAir',
      images: ['https://via.placeholder.com/400x400/4caf50/ffffff?text=IQAir'],
      inStock: true,
      stockQuantity: 5,
      isNew: false,
      isFeatured: true,
      popularity: 92,
      ratings: { average: 4.9, count: 412 },
      dateAdded: '2023-12-01',
    },
    {
      id: '4',
      name: 'Miele HEPA Filter SF-HA 50',
      brand: 'Miele',
      category: 'Parts & Accessories',
      price: 59.99,
      description: 'Genuine Miele HEPA filter for Complete C2 and C3 series vacuums. Lasts approximately one year with normal use.',
      imageUrl: 'https://via.placeholder.com/400x400/999999/ffffff?text=Filter',
      images: ['https://via.placeholder.com/400x400/999999/ffffff?text=Filter'],
      inStock: true,
      stockQuantity: 50,
      isNew: false,
      isFeatured: false,
      popularity: 75,
      ratings: { average: 4.7, count: 89 },
      dateAdded: '2024-08-15',
    },
    {
      id: '5',
      name: 'Eco-Friendly All-Purpose Cleaner',
      brand: 'AllThingsClean',
      category: 'Cleaning Solutions',
      price: 12.99,
      description: 'Plant-based, biodegradable all-purpose cleaner. Safe for all surfaces and the environment. Fresh lemon scent.',
      imageUrl: 'https://via.placeholder.com/400x400/8bc34a/ffffff?text=Cleaner',
      images: ['https://via.placeholder.com/400x400/8bc34a/ffffff?text=Cleaner'],
      inStock: true,
      stockQuantity: 100,
      isNew: true,
      isFeatured: false,
      popularity: 65,
      ratings: { average: 4.5, count: 45 },
      dateAdded: '2024-09-20',
    },
  ];
};

// Mock responses for development without backend
const getMockResponse = (endpoint, options) => {
  // Sign In Mock
  if (endpoint === '/auth/signin') {
    return {
      success: true,
      token: 'mock-token-' + Date.now(),
      user: {
        id: '1',
        name: 'Test User',
        email: options.body ? JSON.parse(options.body).email : 'test@example.com',
      },
      message: 'Sign in successful',
    };
  }

  // Sign Up Mock
  if (endpoint === '/auth/signup') {
    const userData = JSON.parse(options.body);
    return {
      success: true,
      token: 'mock-token-' + Date.now(),
      user: {
        id: '1',
        name: userData.name,
        email: userData.email,
      },
      message: 'Account created successfully',
    };
  }

  // Products Mock
  if (endpoint.startsWith('/products')) {
    return {
      success: true,
      data: getMockProducts(),
      pagination: {
        page: 1,
        limit: 20,
        total: 5,
        pages: 1,
      },
    };
  }

  // Single Product Mock
  if (endpoint.includes('/products/')) {
    return {
      success: true,
      data: getMockProducts()[0],
    };
  }

  // Categories Mock
  if (endpoint === '/categories') {
    return {
      success: true,
      data: ['Vacuums', 'Steam Cleaners', 'Air Purifiers', 'Parts & Accessories', 'Cleaning Solutions'],
    };
  }

  // Default mock response
  return {
    success: false,
    message: 'Mock endpoint not configured',
  };
};

// Helper method for making API calls
const request = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    
    // If in development and mock data is enabled, return mock response
    if (__DEV__ && USE_MOCK_DATA) {
      console.log('Using mock data for:', endpoint);
      return getMockResponse(endpoint, options);
    }
    
    throw error;
  }
};

// API Service Object with all methods
const ApiService = {
  // Product Methods
  
  getProducts: async (params = {}) => {
    const queryParams = new URLSearchParams();

    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/products?${queryString}` : '/products';

    return await request(endpoint);
  },

  getProductById: async (productId) => {
    return await request(`/products/${productId}`);
  },

  getProductsByCategory: async (category) => {
    return await request(`/products/category/${category}`);
  },

  getFeaturedProducts: async () => {
    return await request('/products/featured/list');
  },

  createProduct: async (productData, token) => {
    return await request('/products', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(productData),
    });
  },

  updateProduct: async (productId, productData, token) => {
    return await request(`/products/${productId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(productData),
    });
  },

  deleteProduct: async (productId, token) => {
    return await request(`/products/${productId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  getCategories: async () => {
    return await request('/categories');
  },

  getBrands: async () => {
    return await request('/brands');
  },

  // User Authentication Methods

  signIn: async (email, password) => {
    // If mock mode enabled, use mock data
    if (__DEV__ && USE_MOCK_DATA) {
      return getMockResponse('/auth/signin', {
        body: JSON.stringify({ email, password }),
      });
    }

    return await request('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  signUp: async (userData) => {
    // If mock mode enabled, use mock data
    if (__DEV__ && USE_MOCK_DATA) {
      return getMockResponse('/auth/signup', {
        body: JSON.stringify(userData),
      });
    }

    return await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  getUserProfile: async (token) => {
    return await request('/auth/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  getGuestSession: async () => {
    return {
      success: true,
      token: 'guest-token-' + Date.now(),
      user: {
        id: 'guest',
        name: 'Guest User',
        email: 'guest@allthingsclean.com',
        isGuest: true,
      },
      message: 'Guest session created',
    };
  },

  // Cart Methods

  getCart: async (token) => {
    return await request('/cart', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  addToCart: async (productId, quantity, token) => {
    return await request('/cart/add', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ productId, quantity }),
    });
  },

  removeFromCart: async (productId, token) => {
    return await request('/cart/remove', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ productId }),
    });
  },

  updateCartItem: async (productId, quantity, token) => {
    return await request('/cart/update', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ productId, quantity }),
    });
  },

  // Order Methods

  createOrder: async (orderData, token) => {
    return await request('/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderData),
    });
  },

  getOrders: async (token) => {
    return await request('/orders', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  getOrderById: async (orderId, token) => {
    return await request(`/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },
};

// Export the API service object
export default ApiService;