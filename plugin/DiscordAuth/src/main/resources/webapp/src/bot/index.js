const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
} = require('discord.js');

const setupCommand = require('./commands/setup');
const statusCommand = require('./commands/status');
const unlinkCommand = require('./commands/unlink');
const whitelistCommand = require('./commands/whitelist');
const interactionHandler = require('./events/interactionCreate');
const { setClient } = require('../utils/discord');

function createBot() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
    ],
  });

  // Collect all commands
  client.commands = new Collection();
  const commands = [setupCommand, statusCommand, unlinkCommand, whitelistCommand];
  for (const cmd of commands) {
    client.commands.set(cmd.data.name, cmd);
  }

  // Register slash commands when ready
  client.once('ready', async () => {
    console.log(`[Bot] Logged in as ${client.user.tag}`);
    setClient(client);

    // Register commands globally
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    try {
      const commandData = commands.map(c => c.data.toJSON());
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commandData }
      );
      console.log('[Bot] Slash commands registered successfully');
    } catch (err) {
      console.error('[Bot] Failed to register slash commands:', err);
    }
  });

  // Handle all interactions
  client.on('interactionCreate', (interaction) => interactionHandler(interaction, client));

  return client;
}

async function startBot() {
  const client = createBot();
  await client.login(process.env.DISCORD_BOT_TOKEN);
  return client;
}

module.exports = { startBot };
