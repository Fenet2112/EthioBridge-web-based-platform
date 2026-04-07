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
  FaEnvelope
} from 'react-icons/fa';
import './Help.css';

function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const sections = [
    {
      id: 'getting-started',
      icon: <FaRocket />,
      title: 'Getting Started',
      content: [
        {
          question: 'How to Sign Up',
          answer: `
            1. Click "Sign Up" on the home page
            2. Choose your role: Stakeholder (Buyer) or Industry (Supplier)
            3. Enter your email and create a password (minimum 8 characters)
            4. Click "Create Account"
            5. Check your email for a verification link
            6. Click the verification link to activate your account
          `
        },
        {
          question: 'How to Log In',
          answer: `
            1. Click "Log In" on the home page
            2. Enter your registered email and password
            3. Click "Log In"
            4. You'll be redirected to your dashboard based on your role
          `
        },
        {
          question: 'Email Verification Process',
          answer: `
            After signing up, you'll receive a verification email:
            - Check your inbox (and spam folder)
            - Click the verification link in the email
            - Your email will be verified automatically
            - You can now log in and complete your profile
            
            Didn't receive the email?
            - Wait a few minutes and check spam folder
            - Click "Resend verification email" on the login page
            - Contact support if issues persist
          `
        }
      ]
    },
    {
      id: 'stakeholder',
      icon: <FaHandshake />,
      title: 'Stakeholder Guide',
      content: [
        {
          question: 'How to Browse Products',
          answer: `
            1. Log in to your stakeholder account
            2. Browse the main page to see featured industries
            3. Click on any industry card to view their products
            4. Use filters to narrow down your search
            5. View product details, prices, and availability
          `
        },
        {
          question: 'How to Add Items to Cart',
          answer: `
            1. Browse products from any industry
            2. Click "Add to Cart" on products you're interested in
            3. Specify quantity if needed
            4. View your cart by clicking the cart icon in the navigation
            5. Review items before submitting purchase requests
          `
        },
        {
          question: 'How to Send Purchase Requests',
          answer: `
            1. Add products to your cart
            2. Go to your cart and review items
            3. Click "Submit Purchase Request"
            4. Fill in required details (contact info, location, notes)
            5. Upload ID document for verification (first request only)
            6. Submit the request
            7. Wait for admin approval and industry response
            
            Note: Free accounts can send 1 request per month. Upgrade to Premium for unlimited requests.
          `
        },
        {
          question: 'How Recommendations Work',
          answer: `
            Our recommendation system suggests products and industries based on:
            
            1. Your Preferences: Products you've viewed and added to cart
            2. Similar Users: What other stakeholders with similar interests prefer
            3. Popular Items: Trending products and top-rated industries
            4. Your Activity: Your browsing history and purchase patterns
            
            The more you use the platform, the better your recommendations become!
          `
        },
        {
          question: 'Messaging Industries',
          answer: `
            1. Navigate to an industry's detail page
            2. Click "Message" or "Start Conversation"
            3. Type your message in the chat box
            4. Attach files if needed (click 📎 icon)
            5. Click "Send"
            6. View all conversations in the Messages section
            
            Note: Free accounts have limited messages per month. Upgrade for unlimited messaging.
          `
        }
      ]
    },
    {
      id: 'industry',
      icon: <FaIndustry />,
      title: 'Industry Guide',
      content: [
        {
          question: 'How to Complete Your Profile',
          answer: `
            After signing up:
            1. Log in to your industry account
            2. You'll be prompted to complete your profile
            3. Fill in required information:
               - Company name
               - Sector (e.g., Construction, Manufacturing)
               - Location
               - Description
               - Contact details
               - Established year
            4. Click "Submit Profile"
            5. Your account status will change to "Pending"
            6. Wait for admin approval (usually within 24-48 hours)
          `
        },
        {
          question: 'How to Upload and Manage Products',
          answer: `
            Once your account is approved:
            
            Adding Products:
            1. Go to "Manage Products" section
            2. Click "Add New Product"
            3. Fill in product details:
               - Product name (must be unique)
               - Description
               - Price and unit
               - Category
               - Upload product image (optional)
            4. Click "Add Product"
            
            Managing Products:
            - Edit: Click edit icon on any product
            - Delete: Click delete icon to remove
            - Toggle availability: Mark products as available/unavailable
            
            Note: Free accounts can list up to 5 products. Upgrade to Premium for unlimited listings.
          `
        },
        {
          question: 'Approval Process',
          answer: `
            After submitting your profile:
            
            1. Status: "Pending" - Your profile is under review
            2. Admin reviews your information
            3. Admin decision:
               - Approved: You can access all features
               - Rejected: You'll receive an email with the reason
            
            If Approved:
            - You can add products
            - Receive purchase requests
            - Message stakeholders
            - View analytics
            
            If Rejected:
            - Update your profile with correct information
            - Resubmit for review
            - Contact support if you need help
          `
        },
        {
          question: 'How to Handle Incoming Requests',
          answer: `
            When you receive a purchase request:
            
            1. Go to "Purchase Requests" section
            2. Review request details:
               - Stakeholder information
               - Product and quantity
               - Contact details
               - Special notes
            3. Verify stakeholder's ID document (if provided)
            4. Decide to approve or reject:
               - Approve: Stakeholder will be notified
               - Reject: Provide a reason for rejection
            5. Contact stakeholder via messaging to discuss details
            6. Arrange delivery and payment offline
          `
        }
      ]
    },
    {
      id: 'admin',
      icon: <FaCog />,
      title: 'Admin Guide',
      content: [
        {
          question: 'How to Approve/Reject Users',
          answer: `
            Managing Pending Applications:
            
            1. Log in to admin dashboard
            2. Go to "Approvals" section
            3. Click "Pending" tab to see applications
            4. Review user information:
               - Email and role
               - Profile details (company/organization)
               - Registration date
            5. Click "View Details" for more information
            6. Make a decision:
               - Approve: Click "✓ Approve" button
               - Reject: Click "✕ Reject" and provide reason
            7. User receives email notification of decision
          `
        },
        {
          question: 'How to Manage Users',
          answer: `
            User Management Features:
            
            1. Go to "User Management" section
            2. View all registered users
            3. Filter by:
               - Role (Industry/Stakeholder)
               - Status (Active/Pending/Suspended/Banned)
               - Search by name or email
            4. Available actions:
               - Ban: Permanently block user
               - Suspend: Temporarily restrict access
               - Activate: Restore suspended/banned user
            5. Provide reason when banning/suspending
            6. User receives email notification
          `
        },
        {
          question: 'How to Use Analytics Dashboard',
          answer: `
            Analytics Overview:
            
            1. Go to "Analytics" section
            2. View key metrics:
               - User growth over time
               - Total products listed
               - Purchase request statistics
               - Sector distribution
            3. Use charts and graphs to:
               - Track platform growth
               - Identify popular sectors
               - Monitor user activity
               - Make data-driven decisions
            4. Export data for reports (if needed)
          `
        },
        {
          question: 'Approval Workflow Settings',
          answer: `
            Configure how approvals work:
            
            1. Go to "Settings" → "Approval Workflows"
            2. Choose workflow mode for each type:
            
            Automatic:
            - Users approved instantly without review
            - Use for trusted registrations
            
            Manual:
            - All users require admin review
            - Recommended for quality control
            
            Conditional:
            - Auto-approve based on specific rules
            - Customize conditions as needed
            
            3. Save changes
            4. New registrations follow selected workflow
          `
        }
      ]
    },
    {
      id: 'recommendations',
      icon: <FaBullseye />,
      title: 'Recommendation System',
      content: [
        {
          question: 'How Recommendations Work',
          answer: `
            EthioBridge uses intelligent algorithms to suggest relevant products and industries:
            
            1. Collaborative Filtering:
               - Analyzes behavior of similar users
               - "Users who viewed this also viewed..."
               - Finds patterns in user preferences
            
            2. Content-Based Filtering:
               - Matches products to your interests
               - Based on categories you browse
               - Similar to items you've liked
            
            3. Popularity-Based:
               - Trending products and industries
               - Highly-rated suppliers
               - Most requested items
            
            4. Personalization:
               - Your browsing history
               - Cart additions
               - Purchase requests
               - Message interactions
            
            The system learns from your activity to provide better recommendations over time!
          `
        },
        {
          question: 'Why Am I Not Seeing Recommendations?',
          answer: `
            Recommendations may not appear if:
            
            1. New Account: You haven't browsed enough products yet
               - Solution: Browse industries and products to build your profile
            
            2. Limited Data: Not enough users or products in the system
               - Solution: The system improves as more users join
            
            3. No Activity: You haven't interacted with the platform
               - Solution: View products, add to cart, send requests
            
            4. Technical Issue: Recommendation service may be updating
               - Solution: Refresh the page or try again later
            
            Give it time - recommendations improve with usage!
          `
        }
      ]
    },
    {
      id: 'faq',
      icon: <FaQuestionCircle />,
      title: 'Frequently Asked Questions',
      content: [
        {
          question: 'Why didn\'t I receive a verification email?',
          answer: `
            Common reasons and solutions:
            
            1. Check Spam/Junk Folder:
               - Verification emails sometimes go to spam
               - Mark as "Not Spam" if found
            
            2. Email Delay:
               - Wait 5-10 minutes for email to arrive
               - Server delays can occur
            
            3. Wrong Email Address:
               - Verify you entered correct email during signup
               - Create new account with correct email
            
            4. Resend Email:
               - Click "Resend verification email" on login page
               - Check inbox again
            
            5. Contact Support:
               - Email: support@ethiobridge.et
               - Provide your registered email address
          `
        },
        {
          question: 'Why is my account still pending?',
          answer: `
            Your account may be pending because:
            
            1. Profile Not Completed:
               - Log in and complete your profile form
               - Fill all required fields
               - Submit for review
            
            2. Under Admin Review:
               - Admin reviews applications within 24-48 hours
               - Be patient during review process
            
            3. Additional Information Needed:
               - Check your email for admin requests
               - Provide any missing information
            
            4. High Volume:
               - Many applications may delay review
               - Your turn will come soon
            
            If pending for more than 48 hours, contact support.
          `
        },
        {
          question: 'How do I reset my password?',
          answer: `
            Password Reset Steps:
            
            1. Go to Login page
            2. Click "Forgot password?" link
            3. Enter your registered email address
            4. Click "Send Reset Link"
            5. Check your email for reset link
            6. Click the link (valid for 1 hour)
            7. Enter new password (minimum 8 characters)
            8. Confirm new password
            9. Click "Reset Password"
            10. Log in with new password
            
            Didn't receive reset email?
            - Check spam folder
            - Wait a few minutes
            - Try again or contact support
          `
        },
        {
          question: 'What are the subscription plans?',
          answer: `
            EthioBridge offers two plans:
            
            Free Plan:
            - 1 purchase request per month
            - 3 messages per month
            - 5 product listings (industries)
            - Basic recommendations
            - Email support
            
            Premium Plan (500 ETB/month):
            - Unlimited purchase requests
            - Unlimited messaging
            - Unlimited product listings
            - Priority recommendations
            - Priority support
            - Advanced analytics
            
            Upgrade anytime from your dashboard!
          `
        },
        {
          question: 'How do I contact support?',
          answer: `
            Need help? Contact us:
            
            Email: support@ethiobridge.et
            
            When contacting support, include:
            - Your registered email
            - Description of the issue
            - Screenshots (if applicable)
            - Steps you've already tried
            
            Response time: Within 24 hours
            
            For urgent issues:
            - Use "Contact Support" form on this page
            - Mark as "Urgent" in subject line
          `
        },
        {
          question: 'Is my data secure?',
          answer: `
            Yes! We take security seriously:
            
            1. Encryption:
               - All data transmitted via HTTPS
               - Passwords hashed with bcrypt
               - Secure database storage
            
            2. Privacy:
               - We don't share your data with third parties
               - You control your information
               - Delete account anytime
            
            3. Authentication:
               - JWT token-based authentication
               - Session management
               - Secure password requirements
            
            4. File Uploads:
               - Validated file types
               - Size limits enforced
               - Secure storage
            
            Read our Privacy Policy for more details.
          `
        }
      ]
    }
  ];

  const filteredSections = sections.map(section => ({
    ...section,
    content: section.content.filter(item =>
      searchQuery === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.content.length > 0);

  return (
    <div className="help-page">
      <Link to="/" className="home-icon-btn" title="Back to Home">
        <FaHome />
      </Link>

      <div className="help-container">
        <div className="help-header">
          <h1><FaBook style={{ marginRight: '12px' }} />Help Center</h1>
          <p>Everything you need to know about using EthioBridge</p>
        </div>

        <div className="help-search">
          <input
            type="text"
            placeholder="Search for help topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <FaSearch className="search-icon" />
        </div>

        <div className="help-content">
          {filteredSections.length === 0 ? (
            <div className="no-results">
              <p>No results found for "{searchQuery}"</p>
              <button onClick={() => setSearchQuery('')} className="clear-search-btn">
                Clear Search
              </button>
            </div>
          ) : (
            filteredSections.map(section => (
              <div key={section.id} className="help-section">
                <div
                  className="section-header"
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="section-title">
                    <span className="section-icon">{section.icon}</span>
                    <h2>{section.title}</h2>
                  </div>
                  <span className={`expand-icon ${expandedSection === section.id ? 'expanded' : ''}`}>
                    ▼
                  </span>
                </div>

                {expandedSection === section.id && (
                  <div className="section-content">
                    {section.content.map((item, index) => (
                      <div key={index} className="help-item">
                        <h3>{item.question}</h3>
                        <div className="help-answer">
                          {item.answer.split('\n').map((line, i) => (
                            <p key={i}>{line}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="help-footer">
          <div className="contact-support">
            <h3>Still need help?</h3>
            <p>Can't find what you're looking for? Our support team is here to help!</p>
            <a href="mailto:support@ethiobridge.et" className="support-btn">
              <FaEnvelope style={{ marginRight: '8px' }} />
              Contact Support
            </a>
          </div>

          <div className="quick-links">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to="/login">Log In</Link></li>
              <li><Link to="/signup">Sign Up</Link></li>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/stakeholders">Browse Industries</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Help;
