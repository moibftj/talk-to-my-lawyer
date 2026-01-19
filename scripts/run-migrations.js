#!/usr/bin/env node

/**
 * Run Supabase Migrations
 * 
 * This script applies all .sql files in supabase/migrations in alphabetical order.
 * It's a simple alternative to `supabase db push` for this environment.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const url = require('url');

// Force IPv4 to avoid ENETUNREACH on IPv6
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignore if not supported
}

require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback

// DB Connection string from env or constructed
// Prefer pooler connection for IPv4 compatibility
let connectionString = process.env.DATABASE_URL ||
                       process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL or POSTGRES_URL is not set.');
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');

async function runMigrations() {
  console.log('🚀 Starting migration process...');
  
  // Resolve hostname to IPv4 strictly manually if possible
  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname;
    
    const resolveIpv4 = () => new Promise((resolve, reject) => {
      dns.lookup(hostname, { family: 4 }, (err, address) => {
        if (err) reject(err);
        else resolve(address);
      });
    });

    const ip = await resolveIpv4();
    if (ip) {
      console.log(`ℹ️  Resolved ${hostname} to ${ip}`);
      parsed.hostname = ip;
      connectionString = parsed.toString();
    }
  } catch (err) {
    console.warn('⚠️  Could not resolve hostname manually, proceeding with default:', err.message);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    // Force IPv4 to avoid IPv6 connection issues in containerized environments
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Create migrations table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Get applied migrations
    const { rows: appliedRows } = await client.query('SELECT name FROM _migrations');
    const appliedMigrations = new Set(appliedRows.map(r => r.name));

    // Get all migration files
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.error(`❌ Migrations directory not found: ${MIGRATIONS_DIR}`);
      process.exit(1);
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Lexicographical sort ensures order

    let count = 0;
    
    for (const file of files) {
      if (appliedMigrations.has(file)) {
        // console.log(`⏩ Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`▶️  Applying ${file}...`);
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ Applied ${file}`);
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to apply ${file}:`);
        console.error(err);
        process.exit(1);
      }
    }

    if (count === 0) {
      console.log('✨ No new migrations to apply.');
    } else {
      console.log(`🎉 Successfully applied ${count} migrations.`);
    }

  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
