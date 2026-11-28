CREATE TABLE IF NOT EXISTS finance_closures (
 month TEXT PRIMARY KEY CHECK(length(month)=7),
 revenue_cents INTEGER NOT NULL CHECK(revenue_cents>=0),
 expenses_cents INTEGER NOT NULL CHECK(expenses_cents>=0),
 savings_bp INTEGER NOT NULL CHECK(savings_bp BETWEEN 0 AND 10000),
 partner_a_bp INTEGER NOT NULL CHECK(partner_a_bp BETWEEN 0 AND 10000),
 closed_by TEXT NOT NULL,
 closed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER IF NOT EXISTS finance_closure_immutable_update BEFORE UPDATE ON finance_closures BEGIN SELECT RAISE(ABORT,'immutable_closure'); END;
CREATE TRIGGER IF NOT EXISTS finance_closure_immutable_delete BEFORE DELETE ON finance_closures BEGIN SELECT RAISE(ABORT,'immutable_closure'); END;
CREATE TRIGGER IF NOT EXISTS payment_closed_month BEFORE INSERT ON payments
WHEN NOT EXISTS(SELECT 1 FROM payments WHERE id=NEW.id) AND EXISTS(SELECT 1 FROM finance_closures WHERE month=substr(NEW.paid_on,1,7))
BEGIN SELECT RAISE(ABORT,'closed_month'); END;
CREATE TRIGGER IF NOT EXISTS expense_closed_month BEFORE INSERT ON expenses
WHEN NOT EXISTS(SELECT 1 FROM expenses WHERE id=NEW.id) AND EXISTS(SELECT 1 FROM finance_closures WHERE month=substr(NEW.spent_on,1,7))
BEGIN SELECT RAISE(ABORT,'closed_month'); END;
