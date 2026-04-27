import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FaRocket, 
  FaHandshake, 
  FaIndustry, 
  FaCog, 
  FaBullseye, 
  FaQuestionCircle,
  FaBook,
  FaSearch,
  FaHome,
  FaEnvelope,
  FaUserCircle,
  FaShoppingCart,
  FaChartLine,
  FaShieldAlt,
  FaLifeRing,
  FaCheckCircle,
  FaChevronRight
} from 'react-icons/fa';
import GlobalNav from '../components/GlobalNav';
import { API_BASE_URL } from '../utils/api';
import Logo from '../components/Logo';
import './Help.css';

function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [helpFormData, setHelpFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    message: ''
  });
  const [helpSubmitting, setHelpSubmitting] = useState(false);
  const [helpMessage, setHelpMessage] = useState({ type: '', text: '' });

  const scrollToCategory = (categoryId) => {
    setActiveCategory(categoryId);
    const detailsSection = document.getElementById('category-details');
    if (detailsSection) {
      detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleHelpChange = (e) => {
    const { name, value } = e.target;
    setHelpFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleHelpSubmit = async (e) => {
    e.preventDefault();
    setHelpSubmitting(true);
    setHelpMessage({ type: '', text: '' });

    try {
      console.log('[Help] Submitting help form:', helpFormData);
      
      const response = await fetch(`${API_BASE_URL}/api/contact/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...helpFormData,
          source: 'help'
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('[Help] Help form submitted successfully');
        setHelpMessage({ 
          type: 'success', 
          text: 'Thank you! Our support team will respond within 24 hours.' 
        });
        setHelpFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          role: '',
          message: ''
        });
      } else {
        throw new Error(data.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('[Help] Error submitting help form:', error);
      setHelpMessage({ 
        type: 'error', 
        text: error.message || 'Failed to send message. Please try again.' 
      });
    } finally {
      setHelpSubmitting(false);
    }
  };

  const categories = [
    {
      id: 'getting-started',
      icon: <FaRocket />,
      title: 'Getting Started',
      description: 'Learn the basics of using EthioBridge platform',
      articles: 5,
      content: [
        {
          title: 'How to Sign Up',
          text: 'Click "Sign Up" on the home page, choose your role (Stakeholder or Industry), enter your email and create a password (minimum 8 characters), then check your email for a verification link.'
        },
        {
          title: 'How to Log In',
          text: 'Click "Log In" on the home page, enter your registered email and password, then click "Log In". You\'ll be redirected to your dashboard based on your role.'
        },
        {
          title: 'Email Verification',
          text: 'After signing up, check your inbox (and spam folder) for a verification email. Click the verification link to activate your account. If you didn\'t receive it, click "Resend verification email" on the login page.'
        }
      ]
    },
    {
      id: 'account',
      icon: <FaUserCircle />,
      title: 'Account Management',
      description: 'Manage your profile, settings, and preferences',
      articles: 4,
      content: [
        {
          title: 'Update Your Profile',
          text: 'Log in to your account, navigate to your profile section, update your information (name, contact details, company info), and save changes.'
        },
        {
          title: 'Change Password',
          text: 'Go to account settings, click "Change Password", enter your current password and new password, then confirm the change.'
        },
        {
          title: 'Reset Password',
          text: 'Click "Forgot password?" on the login page, enter your email, check your inbox for the reset link (valid for 1 hour), and set a new password.'
        }
      ]
    },
    {
      id: 'stakeholder',
      icon: <FaHandshake />,
      title: 'For Stakeholders',
      description: 'Browse products, send requests, and connect with industries',
      articles: 6,
      content: [
        {
          title: 'Browse Products',
          text: 'Log in to your stakeholder account, browse the main page to see featured industries, click on any industry card to view their products, and use filters to narrow down your search.'
        },
        {
          title: 'Send Purchase Requests',
          text: 'Add products to your cart, review items, click "Submit Purchase Request", fill in required details, upload ID document (first request only), and submit. Free accounts: 1 request/month, Premium: unlimited.'
        },
        {
          title: 'Message Industries',
          text: 'Navigate to an industry\'s detail page, click "Message", type your message, attach files if needed, and click "Send". View all conversations in the Messages section.'
        }
      ]
    },
    {
      id: 'industry',
      icon: <FaIndustry />,
      title: 'For Industries',
      description: 'Manage products, handle requests, and grow your business',
      articles: 5,
      content: [
        {
          title: 'Complete Your Profile',
          text: 'After signing up, log in and complete your profile with company name, sector, location, description, contact details, and established year. Submit for admin approval (24-48 hours).'
        },
        {
          title: 'Add Products',
          text: 'Once approved, go to "Manage Products", click "Add New Product", fill in details (name, description, price, category), upload image (optional), and click "Add Product". Free: 5 products, Premium: unlimited.'
        },
        {
          title: 'Handle Purchase Requests',
          text: 'Go to "Purchase Requests" section, review request details, verify stakeholder\'s ID document, approve or reject with reason, then contact stakeholder via messaging.'
        }
      ]
    },
    {
      id: 'recommendations',
      icon: <FaBullseye />,
      title: 'Recommendations',
      description: 'How our smart recommendation system works',
      articles: 3,
      content: [
        {
          title: 'How It Works',
          text: 'Our system uses collaborative filtering (similar users), content-based filtering (your interests), popularity-based suggestions (trending items), and personalization (your activity) to recommend relevant products and industries.'
        },
        {
          title: 'Improve Recommendations',
          text: 'Browse products regularly, add items to cart, send purchase requests, and interact with industries. The more you use the platform, the better your recommendations become.'
        }
      ]
    },
    {
      id: 'admin',
      icon: <FaCog />,
      title: 'Admin Tools',
      description: 'Platform management and user approval workflows',
      articles: 4,
      content: [
        {
          title: 'Approve/Reject Users',
          text: 'Log in to admin dashboard, go to "Approvals" section, click "Pending" tab, review user information, and click "Approve" or "Reject" with reason. Users receive email notifications.'
        },
        {
          title: 'Manage Users',
          text: 'Go to "User Management", view all users, filter by role/status, and take actions: Ban (permanent), Suspend (temporary), or Activate (restore access).'
        },
        {
          title: 'Analytics Dashboard',
          text: 'View key metrics including user growth, total products, purchase request statistics, and sector distribution. Use charts to track platform growth and make data-driven decisions.'
        }
      ]
    }
  ];

  const faqs = [
    {
      question: 'Why didn\'t I receive a verification email?',
      answer: 'Check your spam folder first. If not found, wait 5-10 minutes for delivery. You can also click "Resend verification email" on the login page. If issues persist, contact our support team.'
    },
    {
      question: 'Why is my account still pending?',
      answer: 'Your account may be pending because: 1) Profile not completed - log in and fill all required fields, 2) Under admin review - typically takes 24-48 hours, 3) Additional information needed - check your email for requests.'
    },
    {
      question: 'How do I reset my password?',
      answer: 'Click "Forgot password?" on the login page, enter your email, and follow the reset link sent to your inbox. The link is valid for 1 hour.'
    },
    {
      question: 'What are the subscription plans?',
      answer: 'Free Plan: 1 request/month, 3 messages/month, 5 product listings. Premium Plan (500 ETB/month): Unlimited requests, messaging, and listings with priority support.'
    },
    {
      question: 'Is my data secure?',
      answer: 'Yes! We use HTTPS encryption, bcrypt password hashing, JWT authentication, and secure file storage. We never share your data with third parties.'
    },
    {
      question: 'How do I contact support?',
      answer: 'Email us at support@ethiobridge.et with your registered email and issue description. We respond within 24 hours.'
    }
  ];

  const popularArticles = [
    { title: 'How to Sign Up and Get Started', category: 'Getting Started', icon: <FaRocket /> },
    { title: 'Sending Your First Purchase Request', category: 'Stakeholders', icon: <FaShoppingCart /> },
    { title: 'Adding and Managing Products', category: 'Industries', icon: <FaIndustry /> },
    { title: 'Understanding Recommendations', category: 'Recommendations', icon: <FaBullseye /> }
  ];

  return (
    <div className="help-center">
      <GlobalNav />

      {/* Hero Section */}
      <section className="help-hero">
        <div className="help-hero-content">
          <h1>How can we help you?</h1>
          <p>Find answers, guides, and support for using EthioBridge</p>
          <div className="help-search-bar">
            <FaSearch className="help-search-icon" />
            <input
              type="text"
              placeholder="Search for help topics, guides, or questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="help-categories" id="categories">
        <div className="help-container">
          <div className="help-section-header">
            <h2>Browse by Category</h2>
            <p>Find detailed guides and documentation for each area</p>
          </div>
          <div className="categories-grid">
            {categories.map(category => (
              <div key={category.id} className="category-card">
                <div className="category-icon">{category.icon}</div>
                <h3>{category.title}</h3>
                <p>{category.description}</p>
                <div className="category-footer">
                  <span className="category-articles">{category.articles} articles</span>
                  <button 
                    className="category-link"
                    onClick={() => scrollToCategory(category.id)}
                  >
                    Learn more <FaChevronRight />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="help-popular">
        <div className="help-container">
          <div className="help-section-header">
            <h2>Popular Articles</h2>
            <p>Most viewed guides and tutorials</p>
          </div>
          <div className="popular-articles-grid">
            {popularArticles.map((article, index) => (
              <div key={index} className="popular-article-card">
                <div className="popular-article-icon">{article.icon}</div>
                <div className="popular-article-content">
                  <h4>{article.title}</h4>
                  <span className="popular-article-category">{article.category}</span>
                </div>
                <FaChevronRight className="popular-article-arrow" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Details */}
      {activeCategory && (
        <section className="help-category-details" id="category-details">
          <div className="help-container">
            {categories.filter(cat => cat.id === activeCategory).map(category => (
              <div key={category.id} className="category-details-content">
                <div className="category-details-header">
                  <div className="category-details-icon">{category.icon}</div>
                  <div>
                    <h2>{category.title}</h2>
                    <p>{category.description}</p>
                  </div>
                </div>
                <div className="category-articles-list">
                  {category.content.map((article, index) => (
                    <div key={index} className="category-article-item">
                      <div className="category-article-number">{index + 1}</div>
                      <div className="category-article-content">
                        <h3>{article.title}</h3>
                        <p>{article.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  className="back-to-categories-btn"
                  onClick={() => setActiveCategory(null)}
                >
                  ← Back to Categories
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="help-faq" id="faq">
        <div className="help-container">
          <div className="help-section-header">
            <h2>Frequently Asked Questions</h2>
            <p>Quick answers to common questions</p>
          </div>
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <div key={index} className="faq-item">
                <button
                  className="faq-question"
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                >
                  <span>{faq.question}</span>
                  <span className={`faq-icon ${expandedFaq === index ? 'expanded' : ''}`}>
                    <FaChevronRight />
                  </span>
                </button>
                {expandedFaq === index && (
                  <div className="faq-answer">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="help-contact" id="contact">
        <div className="help-container">
          <div className="contact-card">
            <div className="contact-icon">
              <FaLifeRing />
            </div>
            <h2>Still need help?</h2>
            <p>Can't find what you're looking for? Send us a message and our support team will assist you.</p>
            
            {helpMessage.text && (
              <div className={`help-message ${helpMessage.type}`}>
                {helpMessage.text}
              </div>
            )}

            <form className="help-contact-form" onSubmit={handleHelpSubmit}>
              <div className="help-form-row">
                <div className="help-form-field">
                  <label>First Name</label>
                  <input 
                    type="text" 
                    name="firstName"
                    placeholder="Your first name" 
                    value={helpFormData.firstName}
                    onChange={handleHelpChange}
                    required 
                  />
                </div>
                <div className="help-form-field">
                  <label>Last Name</label>
                  <input 
                    type="text" 
                    name="lastName"
                    placeholder="Your last name" 
                    value={helpFormData.lastName}
                    onChange={handleHelpChange}
                    required 
                  />
                </div>
              </div>
              <div className="help-form-field">
                <label>Email Address</label>
                <input 
                  type="email" 
                  name="email"
                  placeholder="your.email@example.com" 
                  value={helpFormData.email}
                  onChange={handleHelpChange}
                  required 
                />
              </div>
              <div className="help-form-field">
                <label>Phone Number (Optional)</label>
                <input 
                  type="tel" 
                  name="phone"
                  placeholder="+251 9XX XXX XXX" 
                  value={helpFormData.phone}
                  onChange={handleHelpChange}
                />
              </div>
              <div className="help-form-field">
                <label>I am a</label>
                <select 
                  name="role"
                  value={helpFormData.role}
                  onChange={handleHelpChange}
                  required
                >
                  <option value="">Select your role...</option>
                  <option value="industry">Industry / Supplier</option>
                  <option value="stakeholder">Stakeholder / Investor</option>
                  <option value="contractor">Contractor</option>
                  <option value="government">Government Agency</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="help-form-field">
                <label>How can we help you?</label>
                <textarea 
                  name="message"
                  placeholder="Describe your issue or question..." 
                  rows={5} 
                  value={helpFormData.message}
                  onChange={handleHelpChange}
                  required 
                />
              </div>
              <button type="submit" className="help-submit-btn" disabled={helpSubmitting}>
                {helpSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>

            <div className="contact-actions">
              <a href="mailto:support@ethiobridge.et" className="contact-btn secondary">
                <FaEnvelope /> Or Email: support@ethiobridge.et
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="help-footer">
        <div className="help-container">
          <div className="help-footer-content">
            <div className="help-footer-brand">
              <Logo size={36} color="#4ade80" />
              <span>EthioBridge</span>
            </div>
            <div className="help-footer-links">
              <Link to="/">Home</Link>
              <Link to="/login">Login</Link>
              <Link to="/signup">Sign Up</Link>
              <Link to="/stakeholders">Browse Industries</Link>
            </div>
          </div>
          <div className="help-footer-bottom">
            <p>© 2025 EthioBridge. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Help;
