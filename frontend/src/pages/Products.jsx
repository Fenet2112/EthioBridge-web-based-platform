import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import FilterPanel from '../components/FilterPanel';
import GlobalNav from '../components/GlobalNav';
import './Products.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

import { imageUrl } from "../utils/imageUrl";

const getProductImage = (product) => {
  if (product.image_url) return imageUrl(product.image_url);
  const n = (product.name || '').toLowerCase();
  const c = (product.category || '').toLowerCase();
  if (n.includes('cement') || c.includes('cement')) return 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500&h=500&fit=crop';
  if (n.includes('steel') || n.includes('iron') || n.includes('metal') || c.includes('steel')) return 'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=500&h=500&fit=crop';
  if (n.includes('brick') || c.includes('brick')) return 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=500&fit=crop';
  if (n.includes('wood') || n.includes('timber') || c.includes('wood')) return 'https://img.texasmonthly.com/2022/01/cord-of-wood.jpg?auto=compress&crop=faces&fit=fit&fm=webp&h=0&ixlib=php-3.3.1&q=45&w=1820';
  if (n.includes('paint') || c.includes('paint')) return 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=500&h=500&fit=crop';
  if (n.includes('sand') || n.includes('gravel') || c.includes('sand')) return 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=500&h=500&fit=crop';
  if (n.includes('glass') || c.includes('glass')) return 'https://images.unsplash.com/photo-1545259742-24f9b0dc8fc7?w=500&h=500&fit=crop';
  if (n.includes('tile') || n.includes('ceramic') || c.includes('tile')) return 'https://images.unsplash.com/photo-1615971677499-5467cbab01c0?w=500&h=500&fit=crop';
  if (n.includes('pipe') || n.includes('plumbing') || c.includes('pipe')) return 'https://www.vectus.in/blog/wp-content/uploads/2022/09/3-3.png';
  if (n.includes('wire') || n.includes('cable') || n.includes('electrical') || c.includes('electrical')) return 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=500&h=500&fit=crop';
  if (n.includes('tool') || n.includes('equipment') || c.includes('tool')) return 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=500&h=500&fit=crop';
  if (n.includes('roof') || c.includes('roof')) return 'https://images.unsplash.com/photo-1632468804928-7e9fc32e921a?w=500&h=500&fit=crop';
  return 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=500&h=500&fit=crop';
};

const getProductIcon = (product) => {
  const n = (product.name || '').toLowerCase();
  const c = (product.category || '').toLowerCase();
  if (n.includes('cement') || c.includes('cement')) return '🏗️';
  if (n.includes('steel') || n.includes('iron') || n.includes('metal')) return '⚙️';
  if (n.includes('brick')) return '🧱';
  if (n.includes('wood') || n.includes('timber')) return '🪵';
  if (n.includes('paint')) return '🎨';
  if (n.includes('sand') || n.includes('gravel')) return '⛱️';
  if (n.includes('glass')) return '🪟';
  if (n.includes('tile') || n.includes('ceramic')) return '🔲';
  if (n.includes('pipe') || n.includes('plumbing')) return '🚰';
  if (n.includes('wire') || n.includes('cable') || n.includes('electrical')) return '⚡';
  if (n.includes('tool') || n.includes('equipment')) return '🔧';
  if (n.includes('roof')) return '🏠';
  return '📦';
};

function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [addedId, setAddedId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const cartRef = useRef(null);

  // Filter state
  const [currentFilters, setCurrentFilters] = useState({});
  const [totalResults, setTotalResults] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, hasNext: false, hasPrev: false });
  const { cart, totalItems, totalPrice, addToCart, updateQty, removeItem, clearCart } = useCart();

  // Fetch products with filters
  const fetchProducts = useCallback(async (filters = {}, page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', '20');

      // Add filters to query params
      if (filters.category) params.append('category', filters.category);
      if (filters.minPrice) params.append('minPrice', filters.minPrice);
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
      if (filters.is_available !== undefined) params.append('is_available', filters.is_available);
      if (filters.location) params.append('location', filters.location);
      if (filters.industry_id) params.append('industry_id', filters.industry_id);
      if (filters.business_role) params.append('business_role', filters.business_role);
      if (filters.search) params.append('search', filters.search);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      const res = await fetch(`${API_BASE_URL}/api/products/all?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();

      setProducts(data.products || []);
      setTotalResults(data.pagination?.total || 0);
      setPagination(data.pagination || { page: 1, totalPages: 1, hasNext: false, hasPrev: false });
    } catch (err) {
      console.error('Products fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle filter apply
  const handleApplyFilters = (filters) => {
    setCurrentFilters(filters);
    fetchProducts(filters, 1); // Reset to page 1
  };

  // Handle filter reset
  const handleResetFilters = () => {
    setCurrentFilters({});
    fetchProducts({}, 1);
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    fetchProducts(currentFilters, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Close cart on outside click
  useEffect(() => {
    const handler = (e) => {
      if (cartRef.current && !cartRef.current.contains(e.target)) setCartOpen(false);
    };
    if (cartOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cartOpen]);

  const handleAddToCart = async (product) => {
    await addToCart(product, 1);
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1200);
    setCartOpen(true);
  };

  const handleUpdateQty = async (productId, delta, currentQty) => {
    await updateQty(productId, currentQty + delta);
  };

  // Extract unique categories from products for filter dropdown
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  if (loading && products.length === 0) return (
    <div className="products-page">
      <div className="loading">Loading products...</div>
    </div>
  );

  if (error) return (
    <div className="products-page">
      <div className="error">Error: {error}</div>
    </div>
  );

  return (
    <div className="products-page">
      <GlobalNav />
      {/* Header */}
      <header className="products-header">
        <div className="header-content">
          <div>
            <h1>All Products</h1>
            <p className="results-summary">
              {totalResults.toLocaleString()} products available
            </p>
          </div>
          <button className="cart-btn" onClick={() => setCartOpen(true)}>
            🛒 Cart
            {totalItems > 0 && <span className="cart-count">{totalItems}</span>}
          </button>
        </div>
      </header>

      {/* Filter Toggle Button (Mobile) */}
      <div className="filter-toggle">
        <button
          className="toggle-filters-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? '✕ Hide Filters' : '⚙️ Show Filters'}
        </button>
      </div>

      <div className="products-layout">
        {/* Sidebar Filters */}
        <aside className={`products-sidebar ${showFilters ? 'show' : ''}`}>
          <FilterPanel
            filters={{
              search: true,
              category: { options: categories },
              priceRange: true,
              location: true,
              availability: true,
              sorting: true
            }}
            initialValues={currentFilters}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
            totalResults={totalResults}
            loading={loading}
            layout="sidebar"
          />
        </aside>

        {/* Products Grid */}
        <main className="products-main">
          {products.length === 0 ? (
            <div className="no-products">
              <p>📦 No products match your filters.</p>
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
                Try adjusting your search criteria or clear filters to see all products.
              </p>
            </div>
          ) : (
            <>
              <div className="products-grid">
                {products.map(product => (
                  <div key={product.id} className="product-card">
                    <div className="product-image-container">
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className="product-image"
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                      <div className="product-image-placeholder" style={{ display: 'none' }}>
                        <span className="placeholder-icon">{getProductIcon(product)}</span>
                        <span className="placeholder-text">{product.name}</span>
                      </div>
                      <div className="product-badges">
                        {product.is_new && <span className="badge badge-new">New</span>}
                        {product.is_featured && <span className="badge badge-top">Top</span>}
                        {product.discount_percentage > 0 && <span className="badge badge-discount">-{product.discount_percentage}%</span>}
                        {!product.is_available && <span className="badge badge-out">Out of Stock</span>}
                      </div>
                      <div className="product-actions">
                        <button className="action-btn" title="Wishlist">♡</button>
                        <button className="action-btn" title="Quick View" onClick={() => navigate(`/industry/${product.industry_id}`)}>👁</button>
                      </div>
                    </div>

                    <div className="product-info">
                      {product.category && <span className="product-category">{product.category}</span>}
                      <h3 className="product-name">{product.name}</h3>
                      {product.description && <p className="product-description">{product.description}</p>}
                      <div className="product-price">
                        {product.discount_percentage > 0 ? (
                          <>
                            <span className="price-original">{Number(product.price).toLocaleString()} ETB</span>
                            <span className="price-amount price-discounted">{Number(product.discounted_price || product.price * (1 - product.discount_percentage / 100)).toLocaleString()} ETB</span>
                          </>
                        ) : (
                          <span className="price-amount">
                            {product.price ? `${Number(product.price).toLocaleString()} ETB` : 'Price on request'}
                          </span>
                        )}
                        {product.unit && product.unit !== 'unit' && (
                          <span className="price-unit">/ {product.unit}</span>
                        )}
                      </div>
                      <div className="product-owner">
                        <span className="owner-label">Sold by:</span>
                        <span className="owner-name">{product.company_name || 'Unknown'}</span>
                        {product.business_role && <span className="owner-role">{product.business_role}</span>}
                      </div>
                      <button
                        className={`add-to-cart-btn ${addedId === product.id ? 'added' : ''} ${!product.is_available ? 'disabled' : ''}`}
                        onClick={() => product.is_available && handleAddToCart(product)}
                        disabled={!product.is_available}
                      >
                        {addedId === product.id ? '✓ Added!' : (!product.is_available ? 'Out of Stock' : '🛒 ADD TO CART')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    disabled={!pagination.hasPrev}
                    onClick={() => handlePageChange(pagination.page - 1)}
                  >
                    ← Previous
                  </button>
                  <span className="pagination-info">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    className="pagination-btn"
                    disabled={!pagination.hasNext}
                    onClick={() => handlePageChange(pagination.page + 1)}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Cart backdrop */}
      {cartOpen && <div className="cart-backdrop" onClick={() => setCartOpen(false)} />}

      {/* Cart drawer */}
      <aside className={`cart-drawer ${cartOpen ? 'open' : ''}`} ref={cartRef}>
        {/* Header */}
        <div className="cart-drawer-header">
          <div className="cart-drawer-title">
            <span>🛒</span>
            <h2>Your Cart</h2>
            {totalItems > 0 && <span className="cart-drawer-count">{totalItems}</span>}
          </div>
          <button className="cart-drawer-close" onClick={() => setCartOpen(false)}>✕</button>
        </div>

        {/* Items */}
        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="cart-empty">
              <div className="cart-empty-icon">🛒</div>
              <h3>Your cart is empty</h3>
              <p>Browse products and add items to get started.</p>
              <button className="cart-empty-btn" onClick={() => setCartOpen(false)}>
                Browse Products
              </button>
            </div>
          ) : (
            cart.map(item => {
              const pid = item.product_id ?? item.id;
              return (
                <div key={item.id || pid} className="cart-item">
                  <div className="cart-item-img">
                    <img
                      src={getProductImage(item)}
                      alt={item.name}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-seller">{item.company_name}</div>
                    <div className="cart-item-price">
                      {item.price
                        ? `${(Number(item.price) * item.quantity).toLocaleString()} ETB`
                        : 'Price on request'}
                    </div>
                  </div>
                  <div className="cart-item-controls">
                    <div className="cart-qty">
                      <button onClick={() => handleUpdateQty(pid, -1, item.quantity)}>−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => handleUpdateQty(pid, +1, item.quantity)}>+</button>
                    </div>
                    <button className="cart-remove" onClick={() => removeItem(pid)} title="Remove">🗑</button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="cart-drawer-footer">
            <div className="cart-summary">
              <div className="cart-summary-row">
                <span>Subtotal ({totalItems} item{totalItems !== 1 ? 's' : ''})</span>
                <span>{totalPrice > 0 ? `${totalPrice.toLocaleString()} ETB` : '—'}</span>
              </div>
              <div className="cart-summary-row cart-summary-note">
                <span>Shipping & taxes calculated at checkout</span>
              </div>
            </div>
            <button
              className="cart-checkout-btn"
              onClick={() => {
                setCartOpen(false);
                navigate("/cart");
              }}
            >
              Proceed to Checkout →
            </button>
            <button className="cart-clear-btn" onClick={clearCart}>
              Clear Cart
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

export default Products;
