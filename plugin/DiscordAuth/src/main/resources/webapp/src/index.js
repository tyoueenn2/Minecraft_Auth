require('dotenv').config();

const { startBot } = require('./bot');
const { startWebServer } = require('./web/app');

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Minecraft Discord Auth System v1.0.0   ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // Validate required env vars
  const required = ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_GUILD_ID'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[Error] Missing required environment variables: ${missing.join(', ')}`);
    console.error('[Error] Copy .env.example to .env and fill in the values.');
    process.exit(1);
  }

  // Initialize database (auto-creates tables on import)
  require('./database');
  console.log('[DB] Database initialized');

  // Start the web server
  await startWebServer();

  // Start the Discord bot (non-fatal — web+API stays up even if bot fails)
  try {
    await startBot();
  } catch (err) {
    const hint = err.code === 'TokenInvalid'
      ? 'Bot token is invalid. Update discord.bot-token in config.yml, then run: /da node restart'
      : err.message;
    console.error(`[Bot] Failed to start Discord bot: ${hint}`);
    console.warn('[Bot] Web server and auth API are still running.');
    console.warn('[Bot] Players with linked accounts can still join the server.');
    return; // don't call process.exit — keep the web server alive
  }

  console.log('');
  console.log('[OK] All systems online!');
}

main().catch((err) => {
  console.error('[Fatal] Startup failed:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Shutdown] Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Shutdown] Received SIGTERM, shutting down...');
  process.exit(0);
});
