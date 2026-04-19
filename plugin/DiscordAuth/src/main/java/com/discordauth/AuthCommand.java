package com.discordauth;

import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

public class AuthCommand implements CommandExecutor, TabCompleter {

    private final DiscordAuthPlugin plugin;
    private static final List<String> SUB_COMMANDS = Arrays.asList(
            "reload", "status", "list", "clearcache", "node"
    );
    private static final List<String> NODE_COMMANDS = Arrays.asList("start", "stop", "restart", "status");

    public AuthCommand(DiscordAuthPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            sendHelp(sender);
            return true;
        }

        switch (args[0].toLowerCase()) {
            case "reload":
                handleReload(sender);
                break;
            case "status":
                handleStatus(sender, args);
                break;
            case "list":
                handleList(sender);
                break;
            case "clearcache":
                handleClearCache(sender);
                break;
            case "node":
                handleNode(sender, args);
                break;
            default:
                sendHelp(sender);
                break;
        }

        return true;
    }

    private void sendHelp(CommandSender sender) {
        sender.sendMessage(colorize("&a&l━━━ DiscordAuth ヘルプ ━━━"));
        sender.sendMessage(colorize("&a/da reload &7- 設定ファイルをリロード"));
        sender.sendMessage(colorize("&a/da status <プレイヤー> &7- プレイヤーの認証状態を確認"));
        sender.sendMessage(colorize("&a/da list &7- 認証済みプレイヤー数を表示"));
        sender.sendMessage(colorize("&a/da clearcache &7- 認証キャッシュをクリア"));
        sender.sendMessage(colorize("&a/da node <start|stop|restart|status> &7- Node.jsアプリの管理"));
    }

    private void handleReload(CommandSender sender) {
        plugin.reloadPluginConfig();
        sender.sendMessage(colorize("&a✓ 設定をリロードしました"));
    }

    private void handleStatus(CommandSender sender, String[] args) {
        if (args.length < 2) {
            sender.sendMessage(colorize("&c使い方: /da status <プレイヤー名>"));
            return;
        }

        String playerName = args[1];
        sender.sendMessage(colorize("&7" + playerName + " の認証状態を確認中..."));

        // 非同期で実行
        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            org.bukkit.entity.Player onlinePlayer = plugin.getServer().getPlayer(playerName);
            if (onlinePlayer == null) {
                sender.sendMessage(colorize("&cプレイヤー " + playerName + " はオンラインではありません。"));
                sender.sendMessage(colorize("&7オンラインプレイヤーのみステータス確認が可能です。"));
                return;
            }

            String uuid = onlinePlayer.getUniqueId().toString();
            AuthAPI.AuthResult result = plugin.getAuthAPI().checkAuth(uuid, playerName);

            if (result == null) {
                sender.sendMessage(colorize("&c認証APIに接続できませんでした"));
                return;
            }

            if (result.authorized) {
                sender.sendMessage(colorize("&a✓ " + playerName + " は認証済みです"));
                if (result.discordUsername != null) {
                    sender.sendMessage(colorize("&7  Discord: &f" + result.discordUsername));
                }
            } else {
                sender.sendMessage(colorize("&c✗ " + playerName + " は認証されていません"));
            }
        });
    }

    private void handleList(CommandSender sender) {
        sender.sendMessage(colorize("&7認証済みプレイヤーの一覧はウェブダッシュボードまたはDiscordボットの /whitelist コマンドで確認してください。"));
    }

    private void handleClearCache(CommandSender sender) {
        plugin.getAuthAPI().clearCache();
        sender.sendMessage(colorize("&a✓ 認証キャッシュをクリアしました"));
    }

    private void handleNode(CommandSender sender, String[] args) {
        if (args.length < 2) {
            sender.sendMessage(colorize("&c使い方: /da node <start|stop|restart|status>"));
            return;
        }

        NodeManager nm = plugin.getNodeManager();
        if (nm == null) {
            sender.sendMessage(colorize("&cNodeManagerが初期化されていません"));
            return;
        }

        switch (args[1].toLowerCase()) {
            case "start":
                if (nm.isRunning()) {
                    sender.sendMessage(colorize("&eNode.jsアプリは既に実行中です"));
                } else {
                    sender.sendMessage(colorize("&7Node.jsアプリを起動中..."));
                    plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
                        if (nm.start()) {
                            sender.sendMessage(colorize("&a✓ Node.jsアプリが起動しました"));
                        } else {
                            sender.sendMessage(colorize("&c✗ Node.jsアプリの起動に失敗しました"));
                        }
                    });
                }
                break;

            case "stop":
                if (!nm.isRunning()) {
                    sender.sendMessage(colorize("&eNode.jsアプリは実行されていません"));
                } else {
                    nm.stop();
                    sender.sendMessage(colorize("&a✓ Node.jsアプリを停止しました"));
                }
                break;

            case "restart":
                sender.sendMessage(colorize("&7Node.jsアプリを再起動中..."));
                plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
                    if (nm.restart()) {
                        sender.sendMessage(colorize("&a✓ Node.jsアプリが再起動しました"));
                    } else {
                        sender.sendMessage(colorize("&c✗ Node.jsアプリの再起動に失敗しました"));
                    }
                });
                break;

            case "status":
                if (nm.isRunning()) {
                    sender.sendMessage(colorize("&a● Node.jsアプリは実行中です"));
                } else {
                    sender.sendMessage(colorize("&c● Node.jsアプリは停止しています"));
                }
                break;

            default:
                sender.sendMessage(colorize("&c使い方: /da node <start|stop|restart|status>"));
                break;
        }
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (args.length == 1) {
            return SUB_COMMANDS.stream()
                    .filter(s -> s.startsWith(args[0].toLowerCase()))
                    .collect(Collectors.toList());
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("status")) {
            return null; // プレイヤー名の自動補完
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("node")) {
            return NODE_COMMANDS.stream()
                    .filter(s -> s.startsWith(args[1].toLowerCase()))
                    .collect(Collectors.toList());
        }
        return new ArrayList<>();
    }

    private String colorize(String message) {
        return ChatColor.translateAlternateColorCodes('&', message);
    }
}
