import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { API_BASE_URL } from '../utils/api';
import './Products.css';

const getProductImage = (product) => {
  if (product.image_url) return `${API_BASE_URL}${product.image_url}`;
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
  const cartRef = useRef(null);

  const { cart, totalItems, totalPrice, addToCart, updateQty, removeItem, clearCart } = useCart();

  useEffect(() => {
    fetchProducts();
  }, []);

  // Close cart on outside click
  useEffect(() => {
    const handler = (e) => {
      if (cartRef.current && !cartRef.current.contains(e.target)) setCartOpen(false);
    };
    if (cartOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cartOpen]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/all`);
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      
      // Handle both array response and paginated {products:[]} response
      const list = Array.isArray(data) ? data : (data.products || []);
      
      console.log('Fetched products:', list.length);
      setProducts(list);
    } catch (err) {
      console.error('Products fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (product) => {
    await addToCart(product, 1);
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1200);
    setCartOpen(true);
  };

  const handleUpdateQty = async (productId, delta, currentQty) => {
    await updateQty(productId, currentQty + delta);
  };

  if (loading) return (
    <div className="products-page">
      <header className="products-header">
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate('/')}>← Back to Home</button>
          <h1>All Products</h1>
          <button className="cart-btn" onClick={() => setCartOpen(true)}>
            🛒 Cart
            {totalItems > 0 && <span className="cart-count">{totalItems}</span>}
          </button>
        </div>
      </header>
      <div className="products-container">
        <div className="products-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="product-skeleton" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="skeleton-product-image" />
              <div className="skeleton-product-info">
                <div className="skeleton-line skeleton-category" />
                <div className="skeleton-line skeleton-name" />
                <div className="skeleton-line skeleton-desc" />
                <div className="skeleton-line skeleton-price" />
                <div className="skeleton-line skeleton-owner" />
                <div className="skeleton-button" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  if (error)   return <div className="products-page"><div className="error">Error: {error}</div></div>;

  return (
    <div className="products-page">
      {/* ── Header ── */}
      <header className="products-header">
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate('/')}>← Back to Home</button>
          <h1>All Products</h1>
          <button className="cart-btn" onClick={() => setCartOpen(true)}>
            🛒 Cart
            {totalItems > 0 && <span className="cart-count">{totalItems}</span>}
          </button>
        </div>
      </header>

      {/* ── Products Grid ── */}
      <div className="products-container">
        {products.length === 0 ? (
          <div className="no-products">
            <p>📦 No products available yet.</p>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
              Industries can add products from their dashboard. Check back soon!
            </p>
          </div>
        ) : (
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
                    {product.is_new      && <span className="badge badge-new">New</span>}
                    {product.is_featured && <span className="badge badge-top">Top</span>}
                  </div>
                  <div className="product-actions">
                    <button className="action-btn" title="Wishlist">♡</button>
                    <button className="action-btn" title="Quick View">👁</button>
                  </div>
                </div>

                <div className="product-info">
                  {product.category && <span className="product-category">{product.category}</span>}
                  <h3 className="product-name">{product.name}</h3>
                  {product.description && <p className="product-description">{product.description}</p>}
                  <div className="product-price">
                    <span className="price-amount">
                      {product.price ? `${Number(product.price).toLocaleString()} ETB` : 'Price on request'}
                    </span>
                    {product.unit && product.unit !== 'unit' && (
                      <span className="price-unit">/ {product.unit}</span>
                    )}
                  </div>
                  <div className="product-owner">
                    <span className="owner-label">Sold by:</span>
                    <span className="owner-name">{product.company_name || 'Unknown'}</span>
                  </div>
                  <button
                    className={`add-to-cart-btn ${addedId === product.id ? 'added' : ''}`}
                    onClick={() => handleAddToCart(product)}
                  >
                    {addedId === product.id ? '✓ Added!' : '🛒 ADD TO CART'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Cart backdrop ── */}
      {cartOpen && <div className="cart-backdrop" onClick={() => setCartOpen(false)} />}

      {/* ── Cart drawer ── */}
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
                alert('Checkout coming soon! Your cart has been saved.');
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
