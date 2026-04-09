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
import Logo from '../components/Logo';
import DarkModeToggle from '../components/DarkModeToggle';
import './Help.css';

function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const categories = [
    {
      id: 'getting-started',
      icon: <FaRocket />,
      title: 'Getting Started',
      description: 'Learn the basics of using EthioBridge platform',
      articles: 5
    },
    {
      id: 'account',
      icon: <FaUserCircle />,
      title: 'Account Management',
      description: 'Manage your profile, settings, and preferences',
      articles: 4
    },
    {
      id: 'stakeholder',
      icon: <FaHandshake />,
      title: 'For Stakeholders',
      description: 'Browse products, send requests, and connect with industries',
      articles: 6
    },
    {
      id: 'industry',
      icon: <FaIndustry />,
      title: 'For Industries',
      description: 'Manage products, handle requests, and grow your business',
      articles: 5
    },
    {
      id: 'recommendations',
      icon: <FaBullseye />,
      title: 'Recommendations',
      description: 'How our smart recommendation system works',
      articles: 3
    },
    {
      id: 'admin',
      icon: <FaCog />,
      title: 'Admin Tools',
      description: 'Platform management and user approval workflows',
      articles: 4
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
      {/* Navigation */}
      <nav className="help-nav">
        <div className="help-nav-content">
          <Link to="/" className="help-logo">
            <Logo size={32} color="#0a5c2f" />
            <span>EthioBridge</span>
          </Link>
          <div className="help-nav-links">
            <a href="#categories">Categories</a>
            <a href="#faq">FAQ</a>
            <a href="#contact">Contact</a>
          </div>
          <div className="help-nav-actions">
            <DarkModeToggle />
            <Link to="/" className="help-home-btn">
              <FaHome /> Home
            </Link>
          </div>
        </div>
      </nav>

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
                  <button className="category-link">
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
            <p>Can't find what you're looking for? Our support team is here to assist you.</p>
            <div className="contact-actions">
              <a href="mailto:support@ethiobridge.et" className="contact-btn primary">
                <FaEnvelope /> Email Support
              </a>
              <Link to="/" className="contact-btn secondary">
                Back to Home
              </Link>
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
