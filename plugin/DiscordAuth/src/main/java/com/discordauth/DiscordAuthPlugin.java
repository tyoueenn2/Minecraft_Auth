package com.discordauth;

import org.bukkit.plugin.java.JavaPlugin;

public class DiscordAuthPlugin extends JavaPlugin {

    private static DiscordAuthPlugin instance;
    private AuthAPI authAPI;
    private NodeManager nodeManager;

    @Override
    public void onEnable() {
        instance = this;

        // 設定ファイルを保存・読み込み
        saveDefaultConfig();

        // API クライアントの初期化
        String apiUrl = getConfig().getString("web.base-url", "http://localhost:3000");
        String apiKey = getConfig().getString("api.key", "");
        int timeout = getConfig().getInt("api.timeout", 5000);
        authAPI = new AuthAPI(apiUrl, apiKey, timeout);

        // Node.jsアプリの起動
        nodeManager = new NodeManager(this);
        boolean nodeEnabled = getConfig().getBoolean("node.enabled", true);
        if (nodeEnabled) {
            getServer().getScheduler().runTaskAsynchronously(this, () -> {
                boolean started = nodeManager.start();
                if (started) {
                    getLogger().info("Node.jsアプリ（Discord Bot + Web）が起動しました");
                } else {
                    getLogger().severe("Node.jsアプリの起動に失敗しました。Node.jsがインストールされているか確認してください。");
                }
            });
        } else {
            getLogger().info("Node.jsアプリは無効化されています（config.yml: node.enabled = false）");
        }

        // イベントリスナーの登録
        getServer().getPluginManager().registerEvents(new AuthListener(this), this);

        // コマンドの登録
        AuthCommand authCommand = new AuthCommand(this);
        getCommand("discordauth").setExecutor(authCommand);
        getCommand("discordauth").setTabCompleter(authCommand);

        getLogger().info("DiscordAuth が有効になりました");
    }

    @Override
    public void onDisable() {
        // Node.jsプロセスを停止
        if (nodeManager != null) {
            nodeManager.stop();
        }
        getLogger().info("DiscordAuth が無効になりました");
    }

    public static DiscordAuthPlugin getInstance() {
        return instance;
    }

    public AuthAPI getAuthAPI() {
        return authAPI;
    }

    public NodeManager getNodeManager() {
        return nodeManager;
    }

    /**
     * プラグインの設定をリロードします
     */
    public void reloadPluginConfig() {
        reloadConfig();
        String apiUrl = getConfig().getString("web.base-url", "http://localhost:3000");
        String apiKey = getConfig().getString("api.key", "");
        int timeout = getConfig().getInt("api.timeout", 5000);
        authAPI = new AuthAPI(apiUrl, apiKey, timeout);
        getLogger().info("設定をリロードしました");
    }
}
