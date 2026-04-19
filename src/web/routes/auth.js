const express = require('express');
const router = express.Router();

const DISCORD_API = 'https://discord.com/api/v10';

// Build the redirect URI from config — must match exactly what's in Discord Developer Portal
function getRedirectUri(req) {
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/auth/discord/callback`;
}

// Redirect to Discord OAuth2
router.get('/discord', (req, res) => {
  const redirectUri = getRedirectUri(req);
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify guilds',
  });
  // Log the redirect URI so it's easy to verify and copy into Discord Developer Portal
  console.log(`[Auth] OAuth2 redirect URI: ${redirectUri}`);
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

// OAuth2 callback
router.get('/discord/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('[Auth] Discord OAuth2 error:', error);
    return res.redirect('/?error=oauth_denied');
  }
  if (!code) return res.redirect('/?error=no_code');

  const redirectUri = getRedirectUri(req);

  try {
    // Exchange code for token
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[Auth] Token exchange failed:', errText);
      // Provide a specific hint for redirect URI mismatch
      if (errText.includes('redirect_uri')) {
        console.error(`[Auth] HINT: Add "${redirectUri}" to your Discord app's OAuth2 Redirects list`);
        console.error('[Auth] Visit: https://discord.com/developers/applications');
      }
      return res.redirect('/?error=token_failed');
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Get user info
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = await userRes.json();

    // Get user guilds
    const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const guilds = await guildsRes.json();

    // Check if user is in the required guild
    const requiredGuildId = process.env.DISCORD_GUILD_ID;
    const isInGuild = Array.isArray(guilds) && guilds.some(g => g.id === requiredGuildId);

    // Store in session
    req.session.user = {
      id: user.id,
      username: user.username,
      globalName: user.global_name || user.username,
      avatar: user.avatar,
      isInGuild,
    };

    res.redirect('/');
  } catch (err) {
    console.error('[Auth] OAuth2 callback error:', err);
    res.redirect('/?error=auth_failed');
  }
});

// Get current session user (used by frontend JS)
router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.json({ loggedIn: false });
  }
  res.json({ loggedIn: true, user: req.session.user });
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
