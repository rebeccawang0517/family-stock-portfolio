// SQLite database for local data storage (server-side only)
// This runs on the Next.js API routes, not in the browser

import Database from 'better-sqlite3'
import path from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'family-finance.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    initTables(db)
  }
  return db
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      region TEXT NOT NULL,
      symbol TEXT NOT NULL,
      company_name TEXT,
      shares REAL NOT NULL DEFAULT 0,
      investment_cost REAL NOT NULL DEFAULT 0,
      current_price REAL DEFAULT 0,
      holder TEXT NOT NULL,
      platform TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      symbol TEXT NOT NULL,
      company_name TEXT,
      region TEXT NOT NULL,
      shares REAL NOT NULL,
      price REAL NOT NULL,
      fee REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      amount REAL NOT NULL,
      realized_profit REAL,
      holder TEXT NOT NULL,
      platform TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cashflow (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      owner TEXT,
      frequency TEXT DEFAULT 'monthly',
      amount REAL DEFAULT 0,
      type TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      owner TEXT,
      value REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      owner TEXT,
      remaining REAL DEFAULT 0,
      interest_rate REAL DEFAULT 0,
      monthly_payment REAL DEFAULT 0,
      grace_period_end TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)
}
