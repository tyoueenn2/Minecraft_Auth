const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'auth.db'));

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Check current schema for migration
const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE name='linked_accounts' AND type='table'`).get();
if (schema && schema.sql.includes('discord_id TEXT NOT NULL UNIQUE')) {
  console.log('[DB] Migrating linked_accounts table to remove UNIQUE constraint on discord_id...');
  db.exec(`
    ALTER TABLE linked_accounts RENAME TO linked_accounts_old;
    CREATE TABLE linked_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      discord_username TEXT NOT NULL,
      minecraft_username TEXT NOT NULL,
      minecraft_uuid TEXT NOT NULL UNIQUE,
      linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1
    );
    INSERT INTO linked_accounts SELECT * FROM linked_accounts_old;
    DROP TABLE linked_accounts_old;
    CREATE INDEX IF NOT EXISTS idx_discord_id ON linked_accounts(discord_id);
    CREATE INDEX IF NOT EXISTS idx_minecraft_uuid ON linked_accounts(minecraft_uuid);
  `);
} else {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS linked_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      discord_username TEXT NOT NULL,
      minecraft_username TEXT NOT NULL,
      minecraft_uuid TEXT NOT NULL UNIQUE,
      linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_discord_id ON linked_accounts(discord_id);
    CREATE INDEX IF NOT EXISTS idx_minecraft_uuid ON linked_accounts(minecraft_uuid);
  `);
}

// Prepared statements
const stmts = {
  linkAccount: db.prepare(`
    INSERT INTO linked_accounts (discord_id, discord_username, minecraft_username, minecraft_uuid)
    VALUES (@discord_id, @discord_username, @minecraft_username, @minecraft_uuid)
  `),

  unlinkByDiscord: db.prepare(`
    DELETE FROM linked_accounts WHERE discord_id = ?
  `),

  unlinkByMinecraft: db.prepare(`
    DELETE FROM linked_accounts WHERE minecraft_uuid = ?
  `),

  unlinkByMinecraftName: db.prepare(`
    DELETE FROM linked_accounts WHERE LOWER(minecraft_username) = LOWER(?)
  `),

  getAccountsByDiscordId: db.prepare(`
    SELECT * FROM linked_accounts WHERE discord_id = ? AND is_active = 1
  `),

  getByMinecraftUuid: db.prepare(`
    SELECT * FROM linked_accounts WHERE minecraft_uuid = ? AND is_active = 1
  `),

  getByMinecraftName: db.prepare(`
    SELECT * FROM linked_accounts WHERE LOWER(minecraft_username) = LOWER(?) AND is_active = 1
  `),

  getAllLinked: db.prepare(`
    SELECT * FROM linked_accounts WHERE is_active = 1 ORDER BY linked_at DESC
  `),

  getCount: db.prepare(`
    SELECT COUNT(*) as count FROM linked_accounts WHERE is_active = 1
  `),
};

/**
 * Link a Discord account to a Minecraft account.
 */
function linkAccount({ discord_id, discord_username, minecraft_username, minecraft_uuid }) {
  stmts.linkAccount.run({ discord_id, discord_username, minecraft_username, minecraft_uuid });
  return stmts.getByMinecraftUuid.get(minecraft_uuid);
}

function unlinkByDiscord(discord_id) {
  return stmts.unlinkByDiscord.run(discord_id);
}

function unlinkByMinecraft(minecraft_uuid) {
  return stmts.unlinkByMinecraft.run(minecraft_uuid);
}

function unlinkByMinecraftName(minecraft_username) {
  return stmts.unlinkByMinecraftName.run(minecraft_username);
}

function getAccountsByDiscordId(discord_id) {
  return stmts.getAccountsByDiscordId.all(discord_id);
}

function getByMinecraftUuid(minecraft_uuid) {
  return stmts.getByMinecraftUuid.get(minecraft_uuid);
}

function getByMinecraftName(minecraft_username) {
  return stmts.getByMinecraftName.get(minecraft_username);
}

function getAllLinked() {
  return stmts.getAllLinked.all();
}

function getCount() {
  return stmts.getCount.get().count;
}

function isAuthorized(minecraft_uuid) {
  const record = stmts.getByMinecraftUuid.get(minecraft_uuid);
  return !!record;
}

module.exports = {
  db,
  linkAccount,
  unlinkByDiscord,
  unlinkByMinecraft,
  unlinkByMinecraftName,
  getAccountsByDiscordId,
  getByMinecraftUuid,
  getByMinecraftName,
  getAllLinked,
  getCount,
  isAuthorized,
};
