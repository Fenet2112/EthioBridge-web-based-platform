import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { 
  FaFlag, FaHardHat, FaIndustry, FaHandshake, FaFileAlt, FaSearch, 
  FaRocket, FaCheckCircle, FaComments, FaChartBar, FaShieldAlt, 
  FaMobileAlt, FaEnvelope, FaPhone, FaMapMarkerAlt, FaClock,
  FaBox, FaClipboardList, FaUsers, FaStar, FaCheck
} from "react-icons/fa";
import Logo from "../components/Logo";
import DarkModeToggle from "../components/DarkModeToggle";
import "./Home.css";

function Home() {
  const heroRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll(".animate-on-scroll").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="home">

      {/* ── NAVBAR ── */}
      <nav className="navbar">
        <div className="logo">
          <Logo size={40} color="#1d522d" />
          <span className="logo-text">EthioBridge</span>
        </div>

        <ul className="nav-links">
          <li><Link to="/">Home</Link></li>
          <li><Link to="/products">Products</Link></li>
          <li><a href="#services">Services</a></li>
          <li><a href="#about">About</a></li>
          <li><Link to="/help">Help</Link></li>
          <li><a href="#contact">Contact</a></li>
        </ul>

        <div className="nav-actions">
          <DarkModeToggle />
          <Link to="/login" className="nav-login">Log In</Link>
          <Link to="/signup" className="nav-signup">Get Started</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        className="hero"
        ref={heroRef}
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(10,92,47,0.78) 0%, rgba(13,122,62,0.68) 50%, rgba(6,64,32,0.82) 100%), url(${process.env.PUBLIC_URL}/background.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="hero-bg">
          <div className="hero-blob blob-1"></div>
          <div className="hero-blob blob-2"></div>
          <div className="hero-blob blob-3"></div>
        </div>

        <div className="hero-content">
          <div className="hero-badge animate-fade-in">
            <FaFlag /> Ethiopia's Leading Construction B2B Platform
          </div>
          <h1 className="hero-title animate-fade-in delay-1">
            Connect. Build.<br />
            <span className="hero-highlight">Transform Ethiopia.</span>
          </h1>
          <p className="hero-subtitle animate-fade-in delay-2">
            EthioBridge bridges the gap between construction industries, suppliers,
            and stakeholders — making Ethiopia's construction sector smarter and faster.
          </p>
          <div className="hero-actions animate-fade-in delay-3">
            <Link to="/signup" className="btn-primary">
              Get Started Free
              <span className="btn-arrow">→</span>
            </Link>
            <Link to="/about" className="btn-secondary">
              Learn More
            </Link>
          </div>
        </div>

        <div className="hero-visual animate-fade-in delay-2">
          <div className="hero-card card-1">
            <div className="card-icon"><FaHardHat /></div>
            <div className="card-text">
              <strong>500+</strong>
              <span>Active Projects</span>
            </div>
          </div>
          <div className="hero-card card-2">
            <div className="card-icon"><FaIndustry /></div>
            <div className="card-text">
              <strong>200+</strong>
              <span>Verified Industries</span>
            </div>
          </div>
          <div className="hero-card card-3">
            <div className="card-icon"><FaHandshake /></div>
            <div className="card-text">
              <strong>1,200+</strong>
              <span>Connections Made</span>
            </div>
          </div>
        </div>

        <div className="hero-scroll-hint">
          <span>Scroll to explore</span>
          <div className="scroll-arrow"></div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="stats-bar animate-on-scroll">
        <div className="stat-item">
          <span className="stat-number">500+</span>
          <span className="stat-label">Active Projects</span>
        </div>
        <div className="stat-divider"></div>
        <div className="stat-item">
          <span className="stat-number">200+</span>
          <span className="stat-label">Verified Industries</span>
        </div>
        <div className="stat-divider"></div>
        <div className="stat-item">
          <span className="stat-number">1,200+</span>
          <span className="stat-label">Connections Made</span>
        </div>
        <div className="stat-divider"></div>
        <div className="stat-item">
          <span className="stat-number">11</span>
          <span className="stat-label">Regions Covered</span>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="how-it-works">
        <div className="section-header animate-on-scroll">
          <span className="section-tag">Simple Process</span>
          <h2>How EthioBridge Works</h2>
          <p>Three simple steps to connect with Ethiopia's construction ecosystem</p>
        </div>
        <div className="steps-grid">
          {[
            { num: "01", icon: <FaFileAlt />, title: "Create Your Profile", desc: "Sign up as an industry supplier or a construction stakeholder in minutes. Complete verification and get approved." },
            { num: "02", icon: <FaSearch />, title: "Discover & Connect", desc: "Search verified listings, filter by region and category, and reach out directly through our secure platform." },
            { num: "03", icon: <FaRocket />, title: "Grow Your Business", desc: "Close deals, track performance, and scale your construction business with real-time analytics and insights." },
          ].map((step, i) => (
            <div className={`step-card animate-on-scroll`} key={i} style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="step-number">{step.num}</div>
              <div className="step-icon">{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="features-section" id="about">
        <div className="section-header animate-on-scroll">
          <span className="section-tag">Platform Features</span>
          <h2>Everything You Need to Build Smarter</h2>
          <p>Powerful tools designed for Ethiopia's construction industry</p>
        </div>
        <div className="features-grid">
          {[
            { icon: <FaCheckCircle />, title: "Verified Listings", desc: "Every industry and supplier is verified for authenticity and quality through our rigorous approval process." },
            { icon: <FaSearch />, title: "Advanced Search", desc: "Filter by product type, region, price range, and certification to find exactly what you need." },
            { icon: <FaComments />, title: "Direct Messaging", desc: "Communicate directly with suppliers and stakeholders in real time through our secure platform." },
            { icon: <FaChartBar />, title: "Analytics Dashboard", desc: "Track your profile views, inquiries, and business performance with comprehensive analytics." },
            { icon: <FaShieldAlt />, title: "Secure Platform", desc: "Enterprise-grade security to protect your business data and ensure safe transactions." },
            { icon: <FaMobileAlt />, title: "Mobile Friendly", desc: "Access EthioBridge from any device, anywhere in Ethiopia with our responsive design." },
          ].map((f, i) => (
            <div className="feature-card animate-on-scroll" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="benefits-section">
        <div className="section-header animate-on-scroll">
          <span className="section-tag">Why Choose Us</span>
          <h2>Benefits of Using EthioBridge</h2>
          <p>Transform your construction business with our comprehensive platform</p>
        </div>
        <div className="benefits-grid">
          <div className="benefit-card animate-on-scroll">
            <div className="benefit-icon-wrap">
              <FaRocket />
            </div>
            <h3>Accelerate Growth</h3>
            <p>Connect with thousands of verified businesses and expand your market reach across all regions of Ethiopia.</p>
          </div>
          <div className="benefit-card animate-on-scroll" style={{ animationDelay: '0.1s' }}>
            <div className="benefit-icon-wrap">
              <FaClock />
            </div>
            <h3>Save Time</h3>
            <p>Find the right partners quickly with our advanced search and filtering system. No more endless phone calls.</p>
          </div>
          <div className="benefit-card animate-on-scroll" style={{ animationDelay: '0.2s' }}>
            <div className="benefit-icon-wrap">
              <FaShieldAlt />
            </div>
            <h3>Build Trust</h3>
            <p>Work with verified businesses only. Our approval process ensures every user is legitimate and trustworthy.</p>
          </div>
          <div className="benefit-card animate-on-scroll" style={{ animationDelay: '0.3s' }}>
            <div className="benefit-icon-wrap">
              <FaChartBar />
            </div>
            <h3>Data-Driven Decisions</h3>
            <p>Make informed business decisions with real-time analytics and market insights at your fingertips.</p>
          </div>
        </div>
      </section>

      {/* ── USER ROLES ── */}
      <section className="roles-section">
        <div className="section-header animate-on-scroll">
          <span className="section-tag">Who We Serve</span>
          <h2>Built for Every Construction Professional</h2>
          <p>Tailored solutions for industries, stakeholders, and administrators</p>
        </div>
        <div className="roles-grid">
          <div className="role-card animate-on-scroll">
            <div className="role-icon-wrap">
              <FaIndustry />
            </div>
            <h3>Industries & Suppliers</h3>
            <p>Showcase your products and services to thousands of potential buyers. Manage your catalog, track inquiries, and grow your business.</p>
            <ul className="role-features">
              <li><FaCheck /> Product catalog management</li>
              <li><FaCheck /> Purchase request tracking</li>
              <li><FaCheck /> Real-time messaging</li>
              <li><FaCheck /> Performance analytics</li>
            </ul>
            <Link to="/signup" className="role-cta">Get Started as Industry →</Link>
          </div>
          <div className="role-card animate-on-scroll" style={{ animationDelay: '0.15s' }}>
            <div className="role-icon-wrap">
              <FaHandshake />
            </div>
            <h3>Stakeholders & Investors</h3>
            <p>Find verified suppliers and construction materials for your projects. Connect directly with industries and make informed decisions.</p>
            <ul className="role-features">
              <li><FaCheck /> Advanced search & filters</li>
              <li><FaCheck /> Direct purchase requests</li>
              <li><FaCheck /> Secure communication</li>
              <li><FaCheck /> Smart recommendations</li>
            </ul>
            <Link to="/signup" className="role-cta">Get Started as Stakeholder →</Link>
          </div>
          <div className="role-card animate-on-scroll" style={{ animationDelay: '0.3s' }}>
            <div className="role-icon-wrap">
              <FaUsers />
            </div>
            <h3>Platform Administrators</h3>
            <p>Manage the entire ecosystem with powerful admin tools. Approve users, monitor activity, and ensure platform quality.</p>
            <ul className="role-features">
              <li><FaCheck /> User verification & approval</li>
              <li><FaCheck /> Platform monitoring</li>
              <li><FaCheck /> Analytics & reporting</li>
              <li><FaCheck /> System management</li>
            </ul>
            <Link to="/login" className="role-cta">Admin Login →</Link>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="testimonials-section">
        <div className="section-header animate-on-scroll">
          <span className="section-tag">Success Stories</span>
          <h2>What Our Users Say</h2>
          <p>Real experiences from construction professionals across Ethiopia</p>
        </div>
        <div className="testimonials-grid">
          {[
            {
              name: "Abebe Tadesse",
              role: "Construction Stakeholder",
              company: "Addis Construction Group",
              image: "https://ui-avatars.com/api/?name=Abebe+Tadesse&background=0a5c2f&color=fff&size=200",
              rating: 5,
              text: "EthioBridge transformed how we source construction materials. Finding verified suppliers is now effortless, and the direct messaging feature saves us countless hours."
            },
            {
              name: "Meron Bekele",
              role: "Industry Supplier",
              company: "Ethiopian Steel Industries",
              image: "https://ui-avatars.com/api/?name=Meron+Bekele&background=0a5c2f&color=fff&size=200",
              rating: 5,
              text: "Managing our product catalog and tracking purchase requests has never been easier. The analytics dashboard helps us understand our market position and grow strategically."
            },
            {
              name: "Daniel Haile",
              role: "Investor",
              company: "Horizon Investment Partners",
              image: "https://ui-avatars.com/api/?name=Daniel+Haile&background=0a5c2f&color=fff&size=200",
              rating: 5,
              text: "The platform's verification system gives us confidence in every connection. We've successfully partnered with multiple industries through EthioBridge."
            },
            {
              name: "Sara Alemayehu",
              role: "Construction Manager",
              company: "Bole Infrastructure Projects",
              image: "https://ui-avatars.com/api/?name=Sara+Alemayehu&background=0a5c2f&color=fff&size=200",
              rating: 5,
              text: "The smart recommendation system is incredibly helpful. It suggests exactly what we need based on our project requirements. A game-changer for our procurement process."
            },
            {
              name: "Yohannes Tesfaye",
              role: "Industry Owner",
              company: "Addis Cement Factory",
              image: "https://ui-avatars.com/api/?name=Yohannes+Tesfaye&background=0a5c2f&color=fff&size=200",
              rating: 5,
              text: "Since joining EthioBridge, our business visibility has increased significantly. We receive quality inquiries daily and have expanded to three new regions."
            },
            {
              name: "Hanna Girma",
              role: "Procurement Officer",
              company: "National Housing Corporation",
              image: "https://ui-avatars.com/api/?name=Hanna+Girma&background=0a5c2f&color=fff&size=200",
              rating: 5,
              text: "The platform's security and verification process ensure we only work with legitimate businesses. It has streamlined our entire procurement workflow."
            }
          ].map((testimonial, i) => (
            <div className="testimonial-card animate-on-scroll" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="testimonial-rating">
                {[...Array(testimonial.rating)].map((_, idx) => (
                  <FaStar key={idx} />
                ))}
              </div>
              <p className="testimonial-text">"{testimonial.text}"</p>
              <div className="testimonial-author">
                <img src={testimonial.image} alt={testimonial.name} className="testimonial-avatar" />
                <div className="testimonial-info">
                  <h4>{testimonial.name}</h4>
                  <p className="testimonial-role">{testimonial.role}</p>
                  <p className="testimonial-company">{testimonial.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="services-section" id="services">
        <div className="section-header animate-on-scroll">
          <span className="section-tag">What We Offer</span>
          <h2>Comprehensive Services for Construction Success</h2>
          <p>From discovery to deal closure — EthioBridge powers every step of your business journey</p>
        </div>

        <div className="services-grid">
          {[
            {
              icon: <FaBox />,
              title: "Smart Recommendations",
              desc: "Get AI-powered product and supplier recommendations based on your business needs and past interactions.",
            },
            {
              icon: <FaIndustry />,
              title: "Industry Connections",
              desc: "Connect with verified construction industries and suppliers across all regions of Ethiopia.",
            },
            {
              icon: <FaHandshake />,
              title: "Investment Opportunities",
              desc: "Discover investment opportunities and connect with stakeholders looking for construction partnerships.",
            },
            {
              icon: <FaShieldAlt />,
              title: "Secure Transactions",
              desc: "Conduct business safely with our verified user system and secure communication platform.",
            },
            {
              icon: <FaClipboardList />,
              title: "Request Management",
              desc: "Manage purchase requests, track inquiries, and streamline your business operations efficiently.",
            },
            {
              icon: <FaStar />,
              title: "Premium Features",
              desc: "Unlock unlimited listings, featured placement, and priority support with premium subscriptions.",
            },
          ].map((s, i) => (
            <div className="service-card-modern animate-on-scroll" key={i} style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="service-icon-modern">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section className="contact-section" id="contact">
        <div className="contact-inner">
          {/* Left — info */}
          <div className="contact-info animate-on-scroll">
            <span className="section-tag">Get in Touch</span>
            <h2>Let's Build Something Together</h2>
            <p>
              Whether you're an industry looking to expand your reach or a stakeholder
              searching for the right partner — our team is here to help you succeed.
            </p>

            <div className="contact-details">
              {[
                { icon: <FaEnvelope />, label: "Email Us",    value: "info@ethiobridge.et",   href: "mailto:info@ethiobridge.et" },
                { icon: <FaPhone />, label: "Call Us",     value: "+251 911 123 456",       href: "tel:+251911123456" },
                { icon: <FaMapMarkerAlt />, label: "Visit Us",    value: "Bole, Addis Ababa, Ethiopia", href: null },
                { icon: <FaClock />, label: "Working Hours", value: "Mon – Fri, 8:00 AM – 6:00 PM EAT", href: null },
              ].map(d => (
                <div className="contact-detail" key={d.label}>
                  <div className="contact-detail-icon">{d.icon}</div>
                  <div>
                    <div className="contact-detail-label">{d.label}</div>
                    {d.href
                      ? <a href={d.href} className="contact-detail-value link">{d.value}</a>
                      : <div className="contact-detail-value">{d.value}</div>
                    }
                  </div>
                </div>
              ))}
            </div>

            <div className="contact-socials">
              {[
                { icon: "X", label: "Twitter",  href: "#" },
                { icon: "in", label: "LinkedIn", href: "#" },
                { icon: "f",  label: "Facebook", href: "#" },
                { icon: "YT",  label: "YouTube",  href: "#" },
              ].map(s => (
                <a key={s.label} href={s.href} className="social-btn" aria-label={s.label}>{s.icon}</a>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div className="contact-form-wrap animate-on-scroll">
            <div className="contact-form-card">
              <h3>Send Us a Message</h3>
              <p>We typically respond within 24 hours.</p>

              <form className="contact-form" onSubmit={e => { e.preventDefault(); alert('Message sent! We\'ll be in touch shortly.'); e.target.reset(); }}>
                <div className="cf-row">
                  <div className="cf-field">
                    <label>First Name</label>
                    <input type="text" placeholder="Abebe" required />
                  </div>
                  <div className="cf-field">
                    <label>Last Name</label>
                    <input type="text" placeholder="Kebede" required />
                  </div>
                </div>
                <div className="cf-field">
                  <label>Email Address</label>
                  <input type="email" placeholder="abebe@company.et" required />
                </div>
                <div className="cf-field">
                  <label>Phone Number</label>
                  <input type="tel" placeholder="+251 9XX XXX XXX" />
                </div>
                <div className="cf-field">
                  <label>I am a</label>
                  <select required>
                    <option value="">Select your role...</option>
                    <option>Industry / Supplier</option>
                    <option>Stakeholder / Investor</option>
                    <option>Contractor</option>
                    <option>Government Agency</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="cf-field">
                  <label>Message</label>
                  <textarea placeholder="Tell us how we can help you..." rows={4} required />
                </div>
                <button type="submit" className="cf-submit">
                  Send Message
                  <span>→</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="cta-banner-main animate-on-scroll">
        <div className="cta-content-main">
          <h2>Ready to Transform Your Construction Business?</h2>
          <p>Join thousands of Ethiopian construction professionals on EthioBridge today. Start connecting, growing, and succeeding.</p>
          <div className="cta-actions-main">
            <Link to="/signup" className="btn-primary btn-large">
              Get Started Free
              <span className="btn-arrow">→</span>
            </Link>
            <Link to="/login" className="btn-outline-white">Sign In</Link>
          </div>
          <div className="cta-trust-badges">
            <div className="trust-badge">
              <FaCheckCircle />
              <span>Verified Users</span>
            </div>
            <div className="trust-badge">
              <FaShieldAlt />
              <span>Secure Platform</span>
            </div>
            <div className="trust-badge">
              <FaStar />
              <span>Trusted by 1000+</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-logo">
              <Logo size={36} color="#4ade80" />
              <span className="logo-text">EthioBridge</span>
            </div>
            <p>Ethiopia's leading B2B platform connecting construction industries, suppliers, and stakeholders. Building the future of Ethiopian construction, one connection at a time.</p>
            <div className="footer-socials">
              {[
                { icon: "X", label: "Twitter",  href: "#" },
                { icon: "in", label: "LinkedIn", href: "#" },
                { icon: "f",  label: "Facebook", href: "#" },
                { icon: "YT",  label: "YouTube",  href: "#" },
              ].map(s => (
                <a key={s.label} href={s.href} className="footer-social-btn" aria-label={s.label}>{s.icon}</a>
              ))}
            </div>
          </div>

          <div className="footer-col">
            <h4>Platform</h4>
            <ul>
              <li><Link to="/stakeholders">For Stakeholders</Link></li>
              <li><Link to="/industry">For Industries</Link></li>
              <li><Link to="/products">Browse Products</Link></li>
              <li><Link to="/signup">Get Started</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="#about">About Us</a></li>
              <li><a href="#services">Services</a></li>
              <li><Link to="/help">Help Center</Link></li>
              <li><a href="#contact">Contact Us</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Contact</h4>
            <div className="footer-contact-item">
              <FaEnvelope />
              <a href="mailto:info@ethiobridge.et">info@ethiobridge.et</a>
            </div>
            <div className="footer-contact-item">
              <FaPhone />
              <a href="tel:+251911123456">+251 911 123 456</a>
            </div>
            <div className="footer-contact-item">
              <FaMapMarkerAlt />
              <span>Bole, Addis Ababa, Ethiopia</span>
            </div>
            <div className="footer-contact-item">
              <FaClock />
              <span>Mon – Fri, 8AM – 6PM EAT</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2025 EthioBridge. All rights reserved. Building Ethiopia's construction future.</p>
          <div className="footer-bottom-links">
            <a href="#privacy">Privacy Policy</a>
            <span>•</span>
            <a href="#terms">Terms of Service</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default Home;
