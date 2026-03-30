import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
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
            🇪🇹 Ethiopia's #1 Construction B2B Platform
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
            <div className="card-icon">🏗️</div>
            <div className="card-text">
              <strong>500+</strong>
              <span>Active Projects</span>
            </div>
          </div>
          <div className="hero-card card-2">
            <div className="card-icon">🏭</div>
            <div className="card-text">
              <strong>200+</strong>
              <span>Verified Industries</span>
            </div>
          </div>
          <div className="hero-card card-3">
            <div className="card-icon">🤝</div>
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
            { num: "01", icon: "📝", title: "Create Your Profile", desc: "Sign up as an industry supplier or a construction stakeholder in minutes." },
            { num: "02", icon: "🔍", title: "Discover & Connect", desc: "Search verified listings, filter by region and category, and reach out directly." },
            { num: "03", icon: "🚀", title: "Grow Your Business", desc: "Close deals, track performance, and scale your construction business." },
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
            { icon: "✅", title: "Verified Listings", desc: "Every industry and supplier is verified for authenticity and quality." },
            { icon: "🔍", title: "Advanced Search", desc: "Filter by product type, region, price range, and certification." },
            { icon: "💬", title: "Direct Messaging", desc: "Communicate directly with suppliers and stakeholders in real time." },
            { icon: "📊", title: "Analytics Dashboard", desc: "Track your profile views, inquiries, and business performance." },
            { icon: "🛡️", title: "Secure Platform", desc: "Enterprise-grade security to protect your business data." },
            { icon: "📱", title: "Mobile Friendly", desc: "Access EthioBridge from any device, anywhere in Ethiopia." },
          ].map((f, i) => (
            <div className="feature-card animate-on-scroll" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROJECTS GALLERY ── */}
      <section className="gallery-section">
        <div className="section-header animate-on-scroll">
          <span className="section-tag">Showcase</span>
          <h2>Featured Projects</h2>
          <p>Real construction projects powered by EthioBridge connections</p>
        </div>
        <div className="gallery-grid">
          {[
            { img: "https://www.2merkato.com/images/stories/cbe-hq.jpg", title: "Commercial Bank HQ", tag: "Commercial" },
            { img: "https://th.bing.com/th/id/R.d491682795f6c529b479fbe33d4a5515?rik=w1o%2fs7b4wPCYOw&pid=ImgRaw&r=0", title: "Skyscraper Foundation", tag: "Infrastructure" },
            { img: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Addis_Ababa_skyline.jpg/1280px-Addis_Ababa_skyline.jpg", title: "Addis Ababa Skyline", tag: "Urban Development" },
          ].map((p, i) => (
            <div className="gallery-card animate-on-scroll" key={i} style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="gallery-img-wrap">
                <img src={p.img} alt={p.title} />
                <div className="gallery-overlay">
                  <span className="gallery-tag">{p.tag}</span>
                </div>
              </div>
              <div className="gallery-info">
                <h4>{p.title}</h4>
                <span className="gallery-link">View Details →</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="services-section" id="services">
        <div className="section-header animate-on-scroll">
          <span className="section-tag">What We Offer</span>
          <h2>End-to-End Services for Ethiopia's Construction Sector</h2>
          <p>From discovery to deal closure — EthioBridge powers every step of your business journey</p>
        </div>

        <div className="services-grid">
          {[
            {
              icon: "🏭",
              color: "#0a5c2f",
              bg: "#e8f5e9",
              title: "Industry Listings",
              desc: "Get your construction business in front of thousands of verified stakeholders. Showcase products, certifications, and capabilities with a professional profile.",
              points: ["Verified company badge", "Product catalog management", "Analytics & visibility insights"],
            },
            {
              icon: "🤝",
              color: "#667eea",
              bg: "#f0f0ff",
              title: "Stakeholder Matching",
              desc: "Investors, contractors, and buyers find exactly what they need. Advanced filters by region, sector, price, and certification make discovery effortless.",
              points: ["Smart search & filtering", "Direct purchase requests", "Identity-verified connections"],
            },
            {
              icon: "💬",
              color: "#0891b2",
              bg: "#e0f7fa",
              title: "Real-Time Messaging",
              desc: "Negotiate, clarify, and close deals through our secure in-platform messaging system. No third-party apps needed — everything stays in one place.",
              points: ["Instant notifications", "File & document sharing", "Conversation history"],
            },
            {
              icon: "📊",
              color: "#7c3aed",
              bg: "#f3e8ff",
              title: "Business Analytics",
              desc: "Understand your market position with detailed analytics. Track profile views, request trends, and stakeholder engagement to make data-driven decisions.",
              points: ["Profile view tracking", "Request conversion rates", "Market trend reports"],
            },
            {
              icon: "🛡️",
              color: "#dc2626",
              bg: "#fff5f5",
              title: "Trust & Verification",
              desc: "Every industry and stakeholder on EthioBridge goes through a rigorous verification process. Identity documents, business licenses, and admin approval ensure a safe ecosystem.",
              points: ["ID document verification", "Admin-reviewed approvals", "Fraud prevention system"],
            },
            {
              icon: "⭐",
              color: "#d97706",
              bg: "#fffbeb",
              title: "Premium Subscriptions",
              desc: "Unlock unlimited listings, featured placement, advanced analytics, and priority support. Designed for businesses serious about growth.",
              points: ["Unlimited product listings", "Featured search placement", "Priority customer support"],
            },
          ].map((s, i) => (
            <div className="service-card animate-on-scroll" key={i} style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="service-icon-wrap" style={{ background: s.bg }}>
                <span className="service-icon" style={{ color: s.color }}>{s.icon}</span>
              </div>
              <h3 className="service-title">{s.title}</h3>
              <p className="service-desc">{s.desc}</p>
              <ul className="service-points">
                {s.points.map(pt => (
                  <li key={pt}>
                    <span className="service-check" style={{ color: s.color }}>✓</span>
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Service CTA strip */}
        <div className="services-cta animate-on-scroll">
          <div className="services-cta-text">
            <h3>Not sure which plan fits your business?</h3>
            <p>Talk to our team — we'll help you find the right solution.</p>
          </div>
          <div className="services-cta-actions">
            <Link to="/signup" className="btn-primary">Start Free Today →</Link>
            <a href="#contact" className="services-cta-link">Talk to Sales</a>
          </div>
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
                { icon: "📧", label: "Email Us",    value: "info@ethiobridge.et",   href: "mailto:info@ethiobridge.et" },
                { icon: "📞", label: "Call Us",     value: "+251 911 123 456",       href: "tel:+251911123456" },
                { icon: "📍", label: "Visit Us",    value: "Bole, Addis Ababa, Ethiopia", href: null },
                { icon: "🕐", label: "Working Hours", value: "Mon – Fri, 8:00 AM – 6:00 PM EAT", href: null },
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
                { icon: "𝕏", label: "Twitter",  href: "#" },
                { icon: "in", label: "LinkedIn", href: "#" },
                { icon: "f",  label: "Facebook", href: "#" },
                { icon: "▶",  label: "YouTube",  href: "#" },
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
      <section className="cta-banner animate-on-scroll">
        <div className="cta-content">
          <h2>Ready to Transform Your Construction Business?</h2>
          <p>Join thousands of Ethiopian construction professionals on EthioBridge today.</p>
          <div className="cta-actions">
            <Link to="/signup" className="btn-primary btn-large">
              Create Free Account
              <span className="btn-arrow">→</span>
            </Link>
            <Link to="/contact" className="btn-outline-white">Contact Sales</Link>
          </div>
        </div>
        <div className="cta-decoration">
          <div className="cta-circle c1"></div>
          <div className="cta-circle c2"></div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-logo">
              <Logo size={36} color="#667eea" />
              <span className="logo-text">EthioBridge</span>
            </div>
            <p>Ethiopia's leading B2B platform connecting construction industries, suppliers, and stakeholders.</p>
          </div>

          <div className="footer-col">
            <h4>Platform</h4>
            <ul>
              <li><Link to="/services">Services</Link></li>
              <li><Link to="/stakeholders">Stakeholders</Link></li>
              <li><Link to="/industry">Industry</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Contact</h4>
            <p>📧 info@ethiobridge.et</p>
            <p>📞 +251 911 123 456</p>
            <p>📍 Addis Ababa, Ethiopia</p>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2025 EthioBridge. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}

export default Home;
