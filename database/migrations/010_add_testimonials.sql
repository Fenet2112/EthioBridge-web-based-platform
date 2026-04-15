-- Migration: Add Testimonials/Feedback System
-- Description: Create table for user feedback with admin approval workflow

CREATE TABLE IF NOT EXISTS testimonials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('stakeholder', 'industry', 'investor', 'other')),
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_testimonials_status ON testimonials(status);
CREATE INDEX idx_testimonials_user_id ON testimonials(user_id);
CREATE INDEX idx_testimonials_created_at ON testimonials(created_at DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_testimonials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER testimonials_updated_at
BEFORE UPDATE ON testimonials
FOR EACH ROW
EXECUTE FUNCTION update_testimonials_updated_at();

-- Insert some sample approved testimonials for initial display
INSERT INTO testimonials (name, role, message, rating, status, approved_at) VALUES
('Sarah Johnson', 'stakeholder', 'EthioBridge has transformed how I connect with construction industries. The platform is intuitive and the recommendation system is spot-on!', 5, 'approved', CURRENT_TIMESTAMP),
('Abebe Tadesse', 'industry', 'As an industry owner, this platform has helped me reach more stakeholders and grow my business significantly. Highly recommended!', 5, 'approved', CURRENT_TIMESTAMP),
('Michael Chen', 'investor', 'The transparency and verification system gives me confidence in my investment decisions. Great platform for the construction sector.', 4, 'approved', CURRENT_TIMESTAMP);
