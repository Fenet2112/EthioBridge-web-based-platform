-- Create payments table for Chapa transactions
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_ref VARCHAR(255) UNIQUE NOT NULL,
  chapa_reference VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  plan VARCHAR(50) NOT NULL, -- 'monthly' or 'yearly'
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'success', 'failed'
  created_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_tx_ref ON payments(tx_ref);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Add payment_method and transaction_id to subscriptions if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='subscriptions' AND column_name='payment_method') THEN
    ALTER TABLE subscriptions ADD COLUMN payment_method VARCHAR(50) DEFAULT 'card';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='subscriptions' AND column_name='transaction_id') THEN
    ALTER TABLE subscriptions ADD COLUMN transaction_id VARCHAR(255);
  END IF;
END $$;
