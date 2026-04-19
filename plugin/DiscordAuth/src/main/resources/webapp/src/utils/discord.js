/**
 * Discord utility — check if a user is in the required guild using the bot client.
 */

let _client = null;

function setClient(client) {
  _client = client;
}

async function checkGuildMembership(userId) {
  if (!_client) throw new Error('Discord client not initialized');

  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error('DISCORD_GUILD_ID not set');

  try {
    const guild = await _client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    return !!member;
  } catch (err) {
    // 404 or other error = not a member
    if (err.code === 10007 || err.code === 10013) {
      return false; // Unknown Member or Unknown User
    }
    console.error('Guild membership check failed:', err.message);
    return false;
  }
}

function getClient() {
  return _client;
}

module.exports = { setClient, checkGuildMembership, getClient };
