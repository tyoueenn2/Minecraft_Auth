/**
 * Mojang API utility — look up Minecraft player UUID from username.
 */

async function getPlayerProfile(username) {
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`);

    if (res.status === 204 || res.status === 404) {
      return null; // Player not found
    }

    if (!res.ok) {
      console.error(`Mojang API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();

    // Format UUID with dashes (Mojang returns without dashes)
    const uuid = data.id.replace(
      /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
      '$1-$2-$3-$4-$5'
    );

    return {
      id: uuid,
      name: data.name,
    };
  } catch (err) {
    console.error('Failed to query Mojang API:', err.message);
    return null;
  }
}

module.exports = { getPlayerProfile };
