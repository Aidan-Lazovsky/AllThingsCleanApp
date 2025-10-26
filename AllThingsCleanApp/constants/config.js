export const config = {
  // API Configuration
  API_BASE_URL: __DEV__ 
    ? 'http://localhost:3000/api'  // Development
    : 'https://your-production-api.com/api', // Production
  
  // App Configuration
  APP_NAME: 'AllThingsClean',
  APP_VERSION: '1.0.0',
  
  // Pagination
  PRODUCTS_PER_PAGE: 20,
  
  // Cache Duration (in milliseconds)
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};