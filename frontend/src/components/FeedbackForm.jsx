import React, { useState } from 'react';
import { FaStar, FaRegStar, FaPaperPlane, FaCheckCircle } from 'react-icons/fa';
import './FeedbackForm.css';

function FeedbackForm({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    message: '',
    rating: 0,
    role: 'stakeholder'
  });
  const [hoveredRating, setHoveredRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (formData.message.trim().length < 10) {
      setError('Please write at least 10 characters');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login to submit feedback');
        setLoading(false);
        return;
      }

      console.log('[FeedbackForm] Submitting feedback...', { role: formData.role, rating: formData.rating });

      const response = await fetch(`${API_BASE_URL}/api/testimonials/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      console.log('[FeedbackForm] Response:', response.status, data);

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to submit feedback');
      }

      console.log('[FeedbackForm] Feedback submitted successfully');
      setSuccess(true);
      
      // Call success callback after a delay
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }, 2000);

    } catch (err) {
      console.error('[FeedbackForm] Error:', err);
      setError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRatingClick = (rating) => {
    setFormData({ ...formData, rating });
  };

  if (success) {
    return (
      <div className="feedback-form-overlay" onClick={onClose}>
        <div className="feedback-form-container success-state" onClick={(e) => e.stopPropagation()}>
          <div className="success-icon">
            <FaCheckCircle />
          </div>
          <h2>Thank You!</h2>
          <p>Your feedback has been submitted and will be reviewed by our team.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-form-overlay" onClick={onClose}>
      <div className="feedback-form-container" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-form-header">
          <h2>Share Your Feedback</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="feedback-form">
          {/* Role Selection */}
          <div className="form-group">
            <label>I am a</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              required
            >
              <option value="stakeholder">Stakeholder</option>
              <option value="industry">Industry Owner</option>
              <option value="investor">Investor</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Rating */}
          <div className="form-group">
            <label>Rating (Optional)</label>
            <div className="rating-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="star-btn"
                  onClick={() => handleRatingClick(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                >
                  {(hoveredRating || formData.rating) >= star ? (
                    <FaStar className="star filled" />
                  ) : (
                    <FaRegStar className="star" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="form-group">
            <label>Your Feedback</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Share your experience with EthioBridge..."
              rows="5"
              required
              minLength="10"
            />
            <div className="char-count">
              {formData.message.length} characters
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span>
                Submitting...
              </>
            ) : (
              <>
                <FaPaperPlane /> Submit Feedback
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default FeedbackForm;
