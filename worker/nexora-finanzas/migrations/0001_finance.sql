CREATE TABLE IF NOT EXISTS charges (
 contract_id TEXT NOT NULL, charge_id TEXT NOT NULL, product TEXT NOT NULL,
 company TEXT NOT NULL, due_date TEXT NOT NULL, kind TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
 paid_cents INTEGER NOT NULL DEFAULT 0 CHECK(paid_cents >= 0 AND paid_cents <= amount_cents),
 PRIMARY KEY(contract_id,charge_id)
);
CREATE TABLE IF NOT EXISTS payments (
 id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, charge_id TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), paid_on TEXT NOT NULL,
 reference TEXT NOT NULL, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(contract_id,charge_id) REFERENCES charges(contract_id,charge_id)
);
CREATE TABLE IF NOT EXISTS expenses (
 id TEXT PRIMARY KEY, category TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
 spent_on TEXT NOT NULL, reference TEXT NOT NULL, recorded_by TEXT NOT NULL,
 recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS payments_date ON payments(paid_on);
CREATE INDEX IF NOT EXISTS expenses_date ON expenses(spent_on);
CREATE TRIGGER IF NOT EXISTS payment_apply AFTER INSERT ON payments BEGIN
 UPDATE charges SET paid_cents=paid_cents+NEW.amount_cents
 WHERE contract_id=NEW.contract_id AND charge_id=NEW.charge_id;
 SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'unknown_charge') END;
END;
CREATE TRIGGER IF NOT EXISTS payment_immutable_update BEFORE UPDATE ON payments BEGIN SELECT RAISE(ABORT,'immutable_payment'); END;
CREATE TRIGGER IF NOT EXISTS payment_immutable_delete BEFORE DELETE ON payments BEGIN SELECT RAISE(ABORT,'immutable_payment'); END;
CREATE TRIGGER IF NOT EXISTS expense_immutable_update BEFORE UPDATE ON expenses BEGIN SELECT RAISE(ABORT,'immutable_expense'); END;
CREATE TRIGGER IF NOT EXISTS expense_immutable_delete BEFORE DELETE ON expenses BEGIN SELECT RAISE(ABORT,'immutable_expense'); END;
