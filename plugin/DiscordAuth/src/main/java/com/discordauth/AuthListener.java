package com.discordauth;

import org.bukkit.ChatColor;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;

public class AuthListener implements Listener {

    private final DiscordAuthPlugin plugin;

    public AuthListener(DiscordAuthPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void onAsyncPreLogin(AsyncPlayerPreLoginEvent event) {
        String playerName = event.getName();
        String uuid = event.getUniqueId().toString();

        // バイパス権限のチェックはここではできません（プレイヤーがまだ参加していないため）
        // OPプレイヤーのバイパスが必要な場合は、ホワイトリストに追加してください

        plugin.getLogger().info(colorize(
                plugin.getConfig().getString("messages.checking", "&7%player% の認証を確認中...")
                        .replace("%player%", playerName)
        ));

        // 認証APIに問い合わせ
        AuthAPI.AuthResult result = plugin.getAuthAPI().checkAuth(uuid, playerName);

        if (result == null) {
            // APIエラー - fail-open設定を確認
            boolean failOpen = plugin.getConfig().getBoolean("auth.fail-open", true);
            if (failOpen) {
                plugin.getLogger().warning(playerName + " のAPI認証チェックに失敗しましたが、fail-open設定により接続を許可します");
                return;
            } else {
                String kickMsg = plugin.getConfig().getString("messages.kick-api-error",
                        "&c認証サーバーに接続できませんでした。\n\n&fしばらく待ってから再度お試しください。");
                event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER, colorize(kickMsg));
                plugin.getLogger().warning(playerName + " のAPI認証チェックに失敗。接続を拒否しました（fail-closed）");
                return;
            }
        }

        if (result.authorized) {
            // 認証成功
            String discordName = result.discordUsername != null ? result.discordUsername : "不明";
            plugin.getLogger().info(colorize(
                    plugin.getConfig().getString("messages.auth-success", "&a%player% の認証に成功しました（Discord: %discord%）")
                            .replace("%player%", playerName)
                            .replace("%discord%", discordName)
            ));
        } else {
            // 認証失敗 - キック
            String kickMsg = plugin.getConfig().getString("messages.kick-not-linked",
                    "&cDiscordアカウントが連携されていません。\n\n&fMinecraftサーバーに参加するには、\nDiscordアカウントとの連携が必要です。\n\n&aウェブサイトまたはDiscordボットで連携してください。");
            event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_WHITELIST, colorize(kickMsg));
            plugin.getLogger().info(colorize(
                    plugin.getConfig().getString("messages.auth-failed", "&c%player% は認証されていません")
                            .replace("%player%", playerName)
            ));
        }
    }

    private String colorize(String message) {
        return ChatColor.translateAlternateColorCodes('&', message);
    }
}
