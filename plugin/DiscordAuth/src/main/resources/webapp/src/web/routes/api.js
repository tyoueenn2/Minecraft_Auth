const express = require('express');
const router = express.Router();
const db = require('../../database');
const { getPlayerProfile } = require('../../utils/mojang');

// Middleware: require authenticated session
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Middleware: require API key (for Minecraft plugin)
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.key;
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  next();
}

// ─── User Endpoints ─────────────────────────────────────────

// Get link status for logged-in user
router.get('/status', requireAuth, (req, res) => {
  const record = db.getByDiscordId(req.session.user.id);
  res.json({
    linked: !!record,
    isInGuild: req.session.user.isInGuild,
    account: record
      ? {
          minecraft_username: record.minecraft_username,
          minecraft_uuid: record.minecraft_uuid,
          linked_at: record.linked_at,
        }
      : null,
  });
});

// Link Minecraft account
router.post('/link', requireAuth, async (req, res) => {
  const { username } = req.body;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Minecraft username is required' });
  }

  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 16) {
    return res.status(400).json({ error: 'Invalid Minecraft username (3–16 characters)' });
  }

  // Check guild membership
  if (!req.session.user.isInGuild) {
    return res.status(403).json({ error: 'You must be a member of the required Discord server' });
  }

  try {
    // Look up Minecraft profile (skip for Bedrock)
    const bedrockPrefix = process.env.BEDROCK_PREFIX || '';
    let profile = null;

    if (bedrockPrefix && trimmed.startsWith(bedrockPrefix)) {
      profile = {
        id: `offline-${Buffer.from(trimmed).toString('hex').substring(0, 24)}`,
        name: trimmed,
      };
    } else {
      profile = await getPlayerProfile(trimmed);
    }

    if (!profile) {
      return res.status(404).json({ error: `Minecraft player "${trimmed}" not found (Java Edition only)` });
    }

    // Check if MC account is already linked to another Discord user
    const existing = db.getByMinecraftUuid(profile.id);
    if (existing && existing.discord_id !== req.session.user.id) {
      return res.status(409).json({ error: 'This Minecraft account is already linked to another Discord user' });
    }

    // Save
    const record = db.linkAccount({
      discord_id: req.session.user.id,
      discord_username: req.session.user.username,
      minecraft_username: profile.name,
      minecraft_uuid: profile.id,
    });

    res.json({
      success: true,
      account: {
        minecraft_username: record.minecraft_username,
        minecraft_uuid: record.minecraft_uuid,
        linked_at: record.linked_at,
      },
    });
  } catch (err) {
    console.error('[API] Link error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unlink Minecraft account
router.post('/unlink', requireAuth, (req, res) => {
  const record = db.getByDiscordId(req.session.user.id);
  if (!record) {
    return res.status(404).json({ error: 'No linked account found' });
  }

  db.unlinkByDiscord(req.session.user.id);
  res.json({ success: true });
});

// ─── Minecraft Plugin Endpoint ──────────────────────────────

// Check if a Minecraft player is authorized
router.get('/auth/check/:uuid', requireApiKey, (req, res) => {
  const { uuid } = req.params;
  const { username } = req.query;
  let record = db.getByMinecraftUuid(uuid);

  if (!record && username) {
    // If not found by UUID, check by username (for Bedrock players who registered with a dummy offline UUID)
    record = db.getByMinecraftName(username);
    if (record && record.minecraft_uuid.startsWith('offline-')) {
      // Update the dummy UUID with the real one provided by the server!
      record = db.linkAccount({
        discord_id: record.discord_id,
        discord_username: record.discord_username,
        minecraft_username: record.minecraft_username,
        minecraft_uuid: uuid
      });
    }
  }

  if (record) {
    res.json({
      authorized: true,
      minecraft_username: record.minecraft_username,
      minecraft_uuid: record.minecraft_uuid,
      discord_id: record.discord_id,
      discord_username: record.discord_username,
    });
  } else {
    res.json({
      authorized: false,
    });
  }
});

// ─── Admin Endpoints ────────────────────────────────────────

// List all linked accounts (protected by API key)
router.get('/admin/linked', requireApiKey, (req, res) => {
  const linked = db.getAllLinked();
  const count = db.getCount();
  res.json({ count, accounts: linked });
});

module.exports = router;
