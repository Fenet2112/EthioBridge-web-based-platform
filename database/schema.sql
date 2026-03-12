-- EthioBridge Database Schema

-- Users table (authentication + role + status)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('industry', 'stakeholder')),
  status VARCHAR(50) NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete', 'pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Industries profile table
CREATE TABLE IF NOT EXISTS industries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  sector VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  description TEXT,
  phone VARCHAR(50),
  website VARCHAR(255),
  established_year INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Stakeholders profile table
CREATE TABLE IF NOT EXISTS stakeholders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  organization_name VARCHAR(255) NOT NULL,
  organization_type VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  description TEXT,
  phone VARCHAR(50),
  contact_person VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add status column to existing users table if it doesn't exist
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'incomplete';
