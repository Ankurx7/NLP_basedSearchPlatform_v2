import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import ProductCard from '../components/ProductCard';
import { searchProducts, getAllProducts, authService } from '../services/api';

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allResults, setAllResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSearch, setActiveSearch] = useState('');
  const [autoAppliedFilters, setAutoAppliedFilters] = useState(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [filters, setFilters] = useState({
    priceRange: { min: 0, max: 999999 },
  });
  const [sortBy, setSortBy] = useState('relevance');

  useEffect(() => {
    const initialQuery = searchParams.get('query');
    if (initialQuery) {
      setActiveSearch(initialQuery);
      performSearch(initialQuery);
    } else {
      loadAllProducts();
    }
  }, []);

  const loadAllProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await getAllProducts();
      let resultsArray = [];
      if (Array.isArray(results)) {
        resultsArray = results;
      } else if (results && Array.isArray(results.products)) {
        resultsArray = results.products;
      } else if (results && results.data && Array.isArray(results.data)) {
        resultsArray = results.data;
      }
      setAllResults(Array.isArray(resultsArray) ? resultsArray : []);
    } catch (err) {
      console.error('Error loading all products:', err);
      setError('Failed to load products. Please try again.');
      setAllResults([]);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (query) => {
    if (!query.trim()) return;
    if (!authService.isAuthenticated()) {
      setShowLoginDialog(true);
      setError('Please login to search products');
      return;
    }
    setLoading(true);
    setError(null);
    setActiveSearch(query);
    console.log('🔄 Resetting filters to default for new search');
    setFilters({
      priceRange: { min: 0, max: 999999 },
      rating: 0
    });
    setAutoAppliedFilters(null);
    try {
      const results = await searchProducts(query, {});
      let resultsArray = [];
      if (Array.isArray(results)) {
        resultsArray = results;
      } else if (results && Array.isArray(results.products)) {
        resultsArray = results.products;
      } else if (results && results.data && Array.isArray(results.data)) {
        resultsArray = results.data;
      }
      setAllResults(Array.isArray(resultsArray) ? resultsArray : []);
      if (results.extractedFilters) {
        console.log('🤖 Auto-applying extracted filters:', results.extractedFilters);
        const appliedFilters = [];
        setFilters(prevFilters => {
          const newFilters = {
            priceRange: { min: 0, max: 999999 },
            rating: 0
          };
          if (results.extractedFilters.priceRange) {
            if (results.extractedFilters.priceRange.min !== undefined && results.extractedFilters.priceRange.min > 0) {
              newFilters.priceRange.min = results.extractedFilters.priceRange.min;
              appliedFilters.push(`Min Price: ₹${results.extractedFilters.priceRange.min.toLocaleString()}`);
              console.log(`💰 Auto-set price MIN: ${results.extractedFilters.priceRange.min}`);
            }
            if (results.extractedFilters.priceRange.max !== undefined && results.extractedFilters.priceRange.max < 999999) {
              newFilters.priceRange.max = results.extractedFilters.priceRange.max;
              appliedFilters.push(`Max Price: ₹${results.extractedFilters.priceRange.max.toLocaleString()}`);
              console.log(`💰 Auto-set price MAX: ${results.extractedFilters.priceRange.max}`);
            }
          }
          console.log('✅ Final applied filters:', newFilters);
          return newFilters;
        });
        if (appliedFilters.length > 0) {
          setAutoAppliedFilters(appliedFilters);
          setTimeout(() => setAutoAppliedFilters(null), 8000);
        }
        if (results.nlpAnalysis?.priceDetected) {
          console.log('✅ Price filters automatically applied from your query!');
        }
      }
      const newParams = new URLSearchParams();
      newParams.set('query', query);
      setSearchParams(newParams);
    } catch (err) {
      console.error('Search error:', err);
      if (err.response?.status === 401 || err.message?.includes('401') || err.message?.includes('unauthorized')) {
        setShowLoginDialog(true);
        setError('Please login to search products');
      } else {
        setError('An error occurred while searching. Please try again.');
      }
      setAllResults([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedResults = useMemo(() => {
    if (!Array.isArray(allResults) || allResults.length === 0) {
      return [];
    }
    let filtered = [...allResults];
    filtered = filtered.filter(product => {
      const price = product.price || 0;
      return price >= filters.priceRange.min && price <= filters.priceRange.max;
    });
    if (filters.rating > 0) {
      filtered = filtered.filter(product => {
        const rating = product.averageRating || 0;
        return rating >= filters.rating;
      });
    }
    switch (sortBy) {
      case 'price_low':
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price_high':
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'rating':
        filtered.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        break;
      case 'relevance':
      default:
        filtered.sort((a, b) => {
          const scoreA = a._score || a.nlp_score || 0;
          const scoreB = b._score || b.nlp_score || 0;
          return scoreB - scoreA;
        });
        break;
    }
    return filtered;
  }, [allResults, filters, sortBy]);

  const clearFilters = () => {
    setFilters({
      priceRange: { min: 0, max: 999999 },
      rating: 0
    });
  };

  const handlePriceChange = (type, value) => {
    const numValue = parseInt(value) || 0;
    setFilters(prev => ({
      ...prev,
      priceRange: {
        ...prev.priceRange,
        [type]: numValue
      }
    }));
  };

  const handleRatingChange = (rating) => {
    setFilters(prev => ({ ...prev, rating }));
  };

  const handleDemoLogin = async () => {
    setLoginLoading(true);
    setLoginError('');
    try {
      await authService.login('07ankur007@gmail.com', '1234567');
      setShowLoginDialog(false);
      if (activeSearch) {
        performSearch(activeSearch);
      }
    } catch (error) {
      setLoginError(error.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCloseLoginDialog = () => {
    setShowLoginDialog(false);
    setLoginError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4">
          <SearchBar onSearch={performSearch} initialQuery={activeSearch} />
        </div>
      </div>

      {autoAppliedFilters && autoAppliedFilters.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Smart filters applied:</span> {autoAppliedFilters.join(', ')}
              </p>
            </div>
            <button
              onClick={() => setAutoAppliedFilters(null)}
              className="flex-shrink-0 text-blue-600 hover:text-blue-800 p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          
          <div className="w-full lg:w-64 lg:flex-shrink-0">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 md:p-6 lg:sticky lg:top-24">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                {(filters.priceRange.min > 0 || filters.priceRange.max < 999999 || filters.rating > 0) && (
                  <button
                    onClick={clearFilters}
                    className="text-blue-600 text-sm hover:text-blue-800 font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  Price Range
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">₹</span>
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.priceRange.min || ''}
                      onChange={(e) => handlePriceChange('min', e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">₹</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.priceRange.max || ''}
                      onChange={(e) => handlePriceChange('max', e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>₹{filters.priceRange.min.toLocaleString()}</span>
                  <span>₹{filters.priceRange.max.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  Customer Rating
                </h3>
                <div className="space-y-2">
                  {[4, 3, 2, 1, 0].map((rating) => (
                    <label key={rating} className="flex items-center cursor-pointer group">
                      <input
                        type="radio"
                        name="rating"
                        checked={filters.rating === rating}
                        onChange={() => handleRatingChange(rating)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 transition-all duration-200 ${
                        filters.rating === rating
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300 group-hover:border-blue-400'
                      }`}>
                        {filters.rating === rating && (
                          <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                        )}
                      </div>
                      <div className="flex items-center text-sm">
                        {rating > 0 ? (
                          <>
                            <div className="flex text-yellow-400 mr-2">
                              {[...Array(5)].map((_, i) => (
                                <span key={i} className={`text-xs ${i < rating ? "text-yellow-400" : "text-gray-300"}`}>★</span>
                              ))}
                            </div>
                            <span className="text-gray-700">{rating}+ Stars</span>
                          </>
                        ) : (
                          <span className="text-gray-700">All Ratings</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1">
            {!loading && filteredAndSortedResults.length > 0 && (
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
                <div className="flex flex-col items-start gap-3 md:flex-row md:justify-between md:items-center">
                  <div className="text-sm text-gray-600">
                    Showing {filteredAndSortedResults.length} of {allResults.length} results
                    {activeSearch && (
                      <span> for "<span className="font-semibold text-gray-900">{activeSearch}</span>"</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-sm text-gray-600">Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full md:w-auto"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="price_low">Price: Low to High</option>
                      <option value="price_high">Price: High to Low</option>
                      <option value="rating">Customer Rating</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Searching products...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="text-lg font-semibold text-red-800 mb-2">Search Error</h3>
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={() => performSearch(activeSearch)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {!loading && !error && activeSearch && filteredAndSortedResults.length === 0 && allResults.length === 0 && (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No products found</h3>
                <p className="text-gray-600 mb-4">
                  We couldn't find any products matching "{activeSearch}".
                  <br />
                  Try different keywords or check your spelling.
                </p>
              </div>
            )}

            {!loading && !error && filteredAndSortedResults.length === 0 && allResults.length > 0 && (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No products match your filters</h3>
                <p className="text-gray-600 mb-4">
                  Found {allResults.length} products for "{activeSearch}", but none match your current filters.
                  <br />
                  Try adjusting your price range or rating requirements.
                </p>
                <button
                  onClick={clearFilters}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}

            {!loading && !error && !activeSearch && (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Start your search</h3>
                <p className="text-gray-600">Enter keywords above to find products</p>
              </div>
            )}

            {!loading && !error && filteredAndSortedResults.length > 0 && (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="text-sm font-semibold text-blue-900 mb-1">Smart Review Analysis Available</h3>
                      <p className="text-blue-700 text-sm">
                        Click on any product to view detailed review analysis, sentiment insights, and customer feedback.
                      </p>
                    </div>
                    <div className="flex-shrink-0 mt-2 sm:mt-0">
                      <div className="flex items-center gap-1 bg-white rounded-full px-3 py-1 border border-blue-300">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="text-xs font-medium text-blue-600">Click to explore</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {filteredAndSortedResults.map((product) => (
                    <ProductCard key={product._id || product.id} product={product} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {showLoginDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 md:p-8 max-w-md w-full mx-auto shadow-2xl">
            <div className="text-center">
              <div className="mb-4">
                <svg className="w-16 h-16 text-blue-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m10-7a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Login Required</h2>
              <p className="text-gray-600 mb-6">
                Please login to search products. Use our demo account to explore the platform.
              </p>
              {loginError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{loginError}</p>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">Demo Account</h3>
                <p className="text-blue-700 text-sm mb-1">Email: 07ankur007@gmail.com</p>
                <p className="text-blue-700 text-sm">Password: 1234567</p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleCloseLoginDialog}
                  disabled={loginLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDemoLogin}
                  disabled={loginLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                >
                  {loginLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Logging in...
                    </>
                  ) : (
                    'Login with Demo Account'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;