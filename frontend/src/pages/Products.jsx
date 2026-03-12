import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Products.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Function to get product image based on name/category
const getProductImage = (product) => {
  // If product has an image_url, use it
  if (product.image_url) {
    return `${API_BASE_URL}${product.image_url}`;
  }

  // Otherwise, assign image based on product name or category
  const name = (product.name || '').toLowerCase();
  const category = (product.category || '').toLowerCase();
  
  // Cement products
  if (name.includes('cement') || category.includes('cement')) {
    return 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500&h=500&fit=crop';
  }
  
  // Steel/Metal products
  if (name.includes('steel') || name.includes('iron') || name.includes('metal') || 
      category.includes('steel') || category.includes('metal')) {
    return 'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=500&h=500&fit=crop';
  }
  
  // Brick products
  if (name.includes('brick') || category.includes('brick')) {
    return 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=500&fit=crop';
  }
  
  // Wood/Timber products
  if (name.includes('wood') || name.includes('timber') || name.includes('lumber') ||
      category.includes('wood') || category.includes('timber')) {
    return 'https://img.texasmonthly.com/2022/01/cord-of-wood.jpg?auto=compress&crop=faces&fit=fit&fm=webp&h=0&ixlib=php-3.3.1&q=45&w=1820';
  }
  
  // Paint products
  if (name.includes('paint') || category.includes('paint')) {
    return 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=500&h=500&fit=crop';
  }
  
  // Sand/Aggregate products
  if (name.includes('sand') || name.includes('gravel') || name.includes('aggregate') ||
      category.includes('sand') || category.includes('aggregate')) {
    return 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=500&h=500&fit=crop';
  }
  
  // Glass products
  if (name.includes('glass') || category.includes('glass')) {
    return 'https://images.unsplash.com/photo-1545259742-24f9b0dc8fc7?w=500&h=500&fit=crop';
  }
  
  // Tiles/Ceramic products
  if (name.includes('tile') || name.includes('ceramic') || name.includes('marble') ||
      category.includes('tile') || category.includes('ceramic')) {
    return 'https://images.unsplash.com/photo-1615971677499-5467cbab01c0?w=500&h=500&fit=crop';
  }
  
  // Concrete products
  if (name.includes('concrete') || category.includes('concrete')) {
    return 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500&h=500&fit=crop';
  }
  
  // Pipes/Plumbing products
  if (name.includes('pipe') || name.includes('plumbing') || name.includes('pvc') ||
      category.includes('pipe') || category.includes('plumbing')) {
    return 'https://images.unsplash.com/photo-1607400201889-565b1ee75f8e?w=500&h=500&fit=crop';
  }
  
  // Electrical products
  if (name.includes('wire') || name.includes('cable') || name.includes('electrical') ||
      category.includes('electrical') || category.includes('wire')) {
    return 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=500&h=500&fit=crop';
  }
  
  // Tools/Equipment
  if (name.includes('tool') || name.includes('equipment') || name.includes('machine') ||
      category.includes('tool') || category.includes('equipment')) {
    return 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=500&h=500&fit=crop';
  }
  
  // Roofing materials
  if (name.includes('roof') || name.includes('shingle') || category.includes('roof')) {
    return 'https://images.unsplash.com/photo-1632468804928-7e9fc32e921a?w=500&h=500&fit=crop';
  }
  
  // Default construction image
  return 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=500&h=500&fit=crop';
};

// Function to get product icon emoji
const getProductIcon = (product) => {
  const name = (product.name || '').toLowerCase();
  const category = (product.category || '').toLowerCase();
  
  if (name.includes('cement') || category.includes('cement')) return '🏗️';
  if (name.includes('steel') || name.includes('iron') || name.includes('metal')) return '⚙️';
  if (name.includes('brick')) return '🧱';
  if (name.includes('wood') || name.includes('timber')) return '🪵';
  if (name.includes('paint')) return '🎨';
  if (name.includes('sand') || name.includes('gravel')) return '⛱️';
  if (name.includes('glass')) return '🪟';
  if (name.includes('tile') || name.includes('ceramic')) return '🔲';
  if (name.includes('concrete')) return '🏗️';
  if (name.includes('pipe') || name.includes('plumbing')) return '🚰';
  if (name.includes('wire') || name.includes('cable') || name.includes('electrical')) return '⚡';
  if (name.includes('tool') || name.includes('equipment')) return '🔧';
  if (name.includes('roof')) return '🏠';
  
  return '📦';
};

function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState([]);

  useEffect(() => {
    fetchProducts();
    loadCart();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/all`);
      if (!res.ok) throw new Error('Failed to fetch products');
      
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCart = () => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    let newCart;
    if (existingItem) {
      // Increase quantity
      newCart = cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      // Add new item
      newCart = [...cart, { ...product, quantity: 1 }];
    }
    
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    alert(`${product.name} added to cart!`);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  if (loading) {
    return (
      <div className="products-page">
        <div className="loading">Loading products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="products-page">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="products-page">
      {/* Header */}
      <header className="products-header">
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate('/')}>
            ← Back to Home
          </button>
          <h1>All Products</h1>
          <button className="cart-btn" onClick={() => navigate('/cart')}>
            🛒 Cart ({getCartItemCount()})
          </button>
        </div>
      </header>

      {/* Products Grid */}
      <div className="products-container">
        {products.length === 0 ? (
          <div className="no-products">
            <p>No products available at the moment.</p>
          </div>
        ) : (
          <div className="products-grid">
            {products.map((product) => (
              <div key={product.id} className="product-card">
                <div className="product-image-container">
                  <img 
                    src={getProductImage(product)} 
                    alt={product.name} 
                    className="product-image"
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="product-image-placeholder" style={{ display: 'none' }}>
                    <span className="placeholder-icon">{getProductIcon(product)}</span>
                    <span className="placeholder-text">{product.name}</span>
                  </div>
                  
                  {/* Badges */}
                  <div className="product-badges">
                    {product.is_new && <span className="badge badge-new">New</span>}
                    {product.is_featured && <span className="badge badge-top">Top</span>}
                  </div>
                  
                  {/* Action Icons */}
                  <div className="product-actions">
                    <button className="action-btn wishlist-btn" title="Add to Wishlist">
                      ♡
                    </button>
                    <button className="action-btn quickview-btn" title="Quick View">
                      👁
                    </button>
                  </div>
                </div>
                
                <div className="product-info">
                  {product.category && (
                    <span className="product-category">{product.category}</span>
                  )}
                  
                  <h3 className="product-name">{product.name}</h3>
                  
                  {product.description && (
                    <p className="product-description">{product.description}</p>
                  )}
                  
                  <div className="product-price">
                    <span className="price-amount">
                      {product.price ? `${product.price.toLocaleString()} ETB` : 'Price on request'}
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
                    className="add-to-cart-btn"
                    onClick={() => addToCart(product)}
                  >
                    🛒 ADD TO CART
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Products;
