package com.discordauth;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class AuthAPI {

    private final String baseUrl;
    private final String apiKey;
    private final int timeout;

    // 認証結果のキャッシュ
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public AuthAPI(String baseUrl, String apiKey, int timeout) {
        // 末尾のスラッシュを除去
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.apiKey = apiKey;
        this.timeout = timeout;
    }

    /**
     * プレイヤーの認証状態をチェックします
     *
     * @param uuid プレイヤーのUUID（ハイフン付き形式）
     * @param playerName プレイヤー名
     * @return 認証結果を含むAuthResult、またはAPIエラー時にnull
     */
    public AuthResult checkAuth(String uuid, String playerName) {
        // キャッシュを確認
        int cacheDuration = DiscordAuthPlugin.getInstance().getConfig().getInt("auth.cache-duration", 0);
        if (cacheDuration > 0) {
            CacheEntry cached = cache.get(uuid);
            if (cached != null && !cached.isExpired(cacheDuration)) {
                return cached.result;
            }
        }

        try {
            String encodedName = java.net.URLEncoder.encode(playerName, "UTF-8");
            URI uri = new URI(baseUrl + "/api/auth/check/" + uuid + "?username=" + encodedName);
            HttpURLConnection conn = (HttpURLConnection) uri.toURL().openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("X-API-Key", apiKey);
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(timeout);
            conn.setReadTimeout(timeout);

            int responseCode = conn.getResponseCode();
            if (responseCode != 200) {
                conn.disconnect();
                return null;
            }

            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            reader.close();
            conn.disconnect();

            JsonObject json = JsonParser.parseString(response.toString()).getAsJsonObject();
            boolean authorized = json.get("authorized").getAsBoolean();

            String discordUsername = null;
            String minecraftUsername = null;
            if (authorized) {
                if (json.has("discord_username")) {
                    discordUsername = json.get("discord_username").getAsString();
                }
                if (json.has("minecraft_username")) {
                    minecraftUsername = json.get("minecraft_username").getAsString();
                }
            }

            AuthResult result = new AuthResult(authorized, minecraftUsername, discordUsername);

            // キャッシュに保存
            if (cacheDuration > 0) {
                cache.put(uuid, new CacheEntry(result));
            }

            return result;

        } catch (Exception e) {
            DiscordAuthPlugin.getInstance().getLogger().warning(
                    "認証APIへの接続に失敗しました: " + e.getMessage()
            );
            return null;
        }
    }

    /**
     * キャッシュをクリアします
     */
    public void clearCache() {
        cache.clear();
    }

    // ─── 内部クラス ──────────────────────────────────────────

    public static class AuthResult {
        public final boolean authorized;
        public final String minecraftUsername;
        public final String discordUsername;

        public AuthResult(boolean authorized, String minecraftUsername, String discordUsername) {
            this.authorized = authorized;
            this.minecraftUsername = minecraftUsername;
            this.discordUsername = discordUsername;
        }
    }

    private static class CacheEntry {
        final AuthResult result;
        final long timestamp;

        CacheEntry(AuthResult result) {
            this.result = result;
            this.timestamp = System.currentTimeMillis();
        }

        boolean isExpired(int durationSeconds) {
            return (System.currentTimeMillis() - timestamp) > (durationSeconds * 1000L);
        }
    }
}
