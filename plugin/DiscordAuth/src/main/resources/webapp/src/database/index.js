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

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS linked_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL UNIQUE,
    discord_username TEXT NOT NULL,
    minecraft_username TEXT NOT NULL,
    minecraft_uuid TEXT NOT NULL UNIQUE,
    linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_discord_id ON linked_accounts(discord_id);
  CREATE INDEX IF NOT EXISTS idx_minecraft_uuid ON linked_accounts(minecraft_uuid);
`);

// Prepared statements
const stmts = {
  linkAccount: db.prepare(`
    INSERT INTO linked_accounts (discord_id, discord_username, minecraft_username, minecraft_uuid)
    VALUES (@discord_id, @discord_username, @minecraft_username, @minecraft_uuid)
  `),

  updateLink: db.prepare(`
    UPDATE linked_accounts 
    SET minecraft_username = @minecraft_username, minecraft_uuid = @minecraft_uuid,
        discord_username = @discord_username, linked_at = CURRENT_TIMESTAMP, is_active = 1
    WHERE discord_id = @discord_id
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

  getByDiscordId: db.prepare(`
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
 * If the Discord user already has a link, it updates it.
 */
function linkAccount({ discord_id, discord_username, minecraft_username, minecraft_uuid }) {
  const existing = stmts.getByDiscordId.get(discord_id);
  if (existing) {
    stmts.updateLink.run({ discord_id, discord_username, minecraft_username, minecraft_uuid });
  } else {
    stmts.linkAccount.run({ discord_id, discord_username, minecraft_username, minecraft_uuid });
  }
  return stmts.getByDiscordId.get(discord_id);
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

function getByDiscordId(discord_id) {
  return stmts.getByDiscordId.get(discord_id);
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
  getByDiscordId,
  getByMinecraftUuid,
  getByMinecraftName,
  getAllLinked,
  getCount,
  isAuthorized,
};
