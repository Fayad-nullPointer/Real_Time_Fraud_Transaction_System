-- ============================================================
-- Real-Time Fraud Transaction System - PostgreSQL Schema
-- ============================================================

-- 1. Customers / Users Table
--    customer_id is auto-incremented and acts as the "card number" the user logs in with.
CREATE TABLE IF NOT EXISTS customers (
    customer_id   SERIAL PRIMARY KEY,
    phone_number  VARCHAR(20)  UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(100),
    registration_lat  DOUBLE PRECISION,
    registration_lon  DOUBLE PRECISION,
    registration_ip   VARCHAR(45),
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Start card numbers at 100000 to look like real card IDs
ALTER SEQUENCE customers_customer_id_seq RESTART WITH 100000;


-- 2. Terminals Table
--    Seeded from the training dataset's terminal lat/lon profiles.
CREATE TABLE IF NOT EXISTS terminals (
    terminal_id   INT PRIMARY KEY,
    terminal_name VARCHAR(100) NOT NULL,
    latitude      DOUBLE PRECISION NOT NULL,
    longitude     DOUBLE PRECISION NOT NULL,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- 3. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id   VARCHAR(64)    PRIMARY KEY,
    customer_id      INT            NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    terminal_id      INT            NOT NULL REFERENCES terminals(terminal_id) ON DELETE RESTRICT,
    tx_amount        NUMERIC(12, 2) NOT NULL,
    tx_datetime      TIMESTAMPTZ    NOT NULL,
    user_lat         DOUBLE PRECISION,
    user_lon         DOUBLE PRECISION,
    -- ML output
    is_fraud         BOOLEAN        DEFAULT FALSE,
    fraud_probability DOUBLE PRECISION DEFAULT 0.0,
    scenario_id      INT,           -- 1=Large Amount, 2=Skimming, 3=Credential Takeover, NULL=legit
    scenario_name    VARCHAR(50),
    -- SHAP top reason (feature name with highest absolute contribution)
    top_reason       VARCHAR(100),
    -- Lifecycle status
    status           VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
    --   PENDING, APPROVED, PENDING_OTP, VERIFIED, DECLINED
    created_at       TIMESTAMPTZ    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tx_customer  ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_tx_terminal  ON transactions(terminal_id);
CREATE INDEX IF NOT EXISTS idx_tx_datetime  ON transactions(tx_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_tx_status    ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_is_fraud  ON transactions(is_fraud);
