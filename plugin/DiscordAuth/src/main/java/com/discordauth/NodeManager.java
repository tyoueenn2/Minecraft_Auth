package com.discordauth;

import java.io.*;
import java.nio.file.*;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Node.jsサブプロセスを管理するクラス
 * プラグイン起動時にNode.jsアプリを自動起動し、停止時に終了します
 */
public class NodeManager {

    private final DiscordAuthPlugin plugin;
    private final Logger logger;
    private final File webappDir;
    private Process nodeProcess;
    private Thread stdoutThread;
    private Thread stderrThread;

    private static final String WEBAPP_VERSION = "1.0.0";
    private static final String VERSION_FILE   = ".webapp-version";

    public NodeManager(DiscordAuthPlugin plugin) {
        this.plugin    = plugin;
        this.logger    = plugin.getLogger();
        this.webappDir = new File(plugin.getDataFolder(), "webapp");
    }

    // ─── 公開メソッド ───────────────────────────────────────────

    /**
     * Node.jsアプリを起動します
     *  1. webappファイルをJARから展開
     *  2. .envファイルを生成
     *  3. node_modules を準備（ZIP展開またはnpm install）
     *  4. nodeプロセスを起動
     */
    public boolean start() {
        try {
            webappDir.mkdirs();
            extractWebapp();
            generateEnvFile();

            File nodeModules = new File(webappDir, "node_modules");
            if (!nodeModules.exists()) {
                InputStream zipStream = plugin.getResource("webapp/node_modules.zip");
                if (zipStream != null) {
                    logger.info("同梱の node_modules.zip を展開中...");
                    logger.info("（初回のみ。しばらくお待ちください）");
                    File nodeModulesDir = new File(webappDir, "node_modules");
                    nodeModulesDir.mkdirs();
                    extractZip(zipStream, nodeModulesDir);
                    zipStream.close();
                    logger.info("node_modules の展開が完了しました");
                } else {
                    logger.info("node_modules が見つかりません。npm install を実行中...");
                    logger.info("（初回起動時は数分かかる場合があります）");
                    if (!runNpmInstall()) {
                        logger.severe("npm install に失敗しました。");
                        logger.severe("Node.js と npm がインストールされているか確認してください。");
                        logger.severe("ダウンロード: https://nodejs.org/");
                        return false;
                    }
                    logger.info("npm install が完了しました");
                }
            }

            return startNodeProcess();

        } catch (Exception e) {
            logger.severe("Node.jsアプリの起動に失敗しました: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    /**
     * Node.jsプロセスを停止します（プロセスツリー全体を終了）
     *
     * Windowsでは cmd.exe /c node が2階層のプロセスを生成するため、
     * taskkill /F /T でプロセスツリー全体を強制終了します。
     */
    public void stop() {
        if (nodeProcess != null && nodeProcess.isAlive()) {
            logger.info("Node.jsプロセスを停止中...");

            if (isWindows()) {
                // taskkill /F /T でプロセスツリー全体を強制終了
                try {
                    long pid = nodeProcess.pid();
                    Process taskkill = new ProcessBuilder(
                            "taskkill", "/F", "/T", "/PID", String.valueOf(pid))
                            .redirectErrorStream(true)
                            .start();
                    taskkill.waitFor(5, TimeUnit.SECONDS);
                    logger.info("taskkill でプロセスツリーを終了しました (PID: " + pid + ")");
                } catch (Exception e) {
                    logger.warning("taskkill の実行に失敗しました: " + e.getMessage());
                    nodeProcess.destroyForcibly();
                }
            } else {
                // Linux / macOS: 子プロセスを先に終了
                nodeProcess.descendants().forEach(ProcessHandle::destroyForcibly);
                nodeProcess.destroyForcibly();
            }

            try {
                if (!nodeProcess.waitFor(10, TimeUnit.SECONDS)) {
                    nodeProcess.destroyForcibly();
                    logger.warning("Node.jsプロセスを強制終了しました");
                } else {
                    logger.info("Node.jsプロセスが正常に停止しました");
                }
            } catch (InterruptedException e) {
                nodeProcess.destroyForcibly();
                Thread.currentThread().interrupt();
            }
        }

        if (stdoutThread != null) stdoutThread.interrupt();
        if (stderrThread != null) stderrThread.interrupt();
        nodeProcess = null;
    }

    /**
     * 設定を再読み込みしてNode.jsプロセスを再起動します
     */
    public boolean restart() {
        stop();
        try { Thread.sleep(1500); } catch (InterruptedException ignored) {}
        generateEnvFile();
        return startNodeProcess();
    }

    /** Node.jsプロセスが実行中かどうか */
    public boolean isRunning() {
        return nodeProcess != null && nodeProcess.isAlive();
    }

    // ─── プライベートメソッド ────────────────────────────────────

    /**
     * JARからwebappファイルを展開します。
     * バージョンが変わった場合はソースファイルを強制上書きします。
     */
    private void extractWebapp() throws IOException {
        File versionFile = new File(webappDir, VERSION_FILE);
        String installedVersion = "";
        if (versionFile.exists()) {
            installedVersion = new String(Files.readAllBytes(versionFile.toPath())).trim();
        }
        boolean forceUpdate = !WEBAPP_VERSION.equals(installedVersion);
        if (forceUpdate && !installedVersion.isEmpty()) {
            logger.info("webappを v" + installedVersion + " → v" + WEBAPP_VERSION + " にアップデートします");
        }

        InputStream listStream = plugin.getResource("webapp-files.txt");
        if (listStream == null) {
            throw new IOException("webapp-files.txt がJAR内に見つかりません");
        }

        int extracted = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(listStream))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;

                File outFile = new File(webappDir, line);
                if (outFile.exists() && !forceUpdate) continue;

                outFile.getParentFile().mkdirs();

                InputStream in = plugin.getResource("webapp/" + line);
                if (in == null) {
                    logger.warning("リソースが見つかりません: " + line);
                    continue;
                }
                Files.copy(in, outFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
                in.close();
                extracted++;
            }
        }

        Files.write(versionFile.toPath(), WEBAPP_VERSION.getBytes(),
                StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        if (extracted > 0) {
            logger.info("webappファイルを展開しました: " + extracted + " ファイル → " + webappDir.getAbsolutePath());
        }
    }

    /**
     * config.yml の設定から .env ファイルを生成します（常に上書き）
     */
    private void generateEnvFile() {
        File envFile = new File(webappDir, ".env");
        try (PrintWriter writer = new PrintWriter(new FileWriter(envFile))) {
            writer.println("# このファイルはDiscordAuthプラグインによって自動生成されます");
            writer.println("# 設定を変更する場合は plugins/DiscordAuth/config.yml を編集してください");
            writer.println();
            writer.println("DISCORD_BOT_TOKEN="     + plugin.getConfig().getString("discord.bot-token",    ""));
            writer.println("DISCORD_CLIENT_ID="     + plugin.getConfig().getString("discord.client-id",    ""));
            writer.println("DISCORD_CLIENT_SECRET=" + plugin.getConfig().getString("discord.client-secret", ""));
            writer.println("DISCORD_GUILD_ID="      + plugin.getConfig().getString("discord.guild-id",     ""));
            writer.println();
            writer.println("PORT="           + plugin.getConfig().getInt("web.port", 3000));
            writer.println("BASE_URL="       + plugin.getConfig().getString("web.base-url",       "http://localhost:3000"));
            writer.println("SESSION_SECRET=" + plugin.getConfig().getString("web.session-secret", "change-me-to-random-string"));
            writer.println();
            writer.println("API_KEY=" + plugin.getConfig().getString("api.key", ""));
            writer.println();
            writer.println("BEDROCK_PREFIX=" + plugin.getConfig().getString("auth.bedrock-prefix", "."));
        } catch (IOException e) {
            logger.severe(".envファイルの生成に失敗しました: " + e.getMessage());
        }
    }

    /**
     * ZIP ファイルを指定ディレクトリに展開します
     */
    private void extractZip(InputStream zipStream, File destDir) throws IOException {
        byte[] buffer = new byte[8192];
        try (ZipInputStream zis = new ZipInputStream(zipStream)) {
            ZipEntry entry;
            int count = 0;
            while ((entry = zis.getNextEntry()) != null) {
                File outFile = new File(destDir, entry.getName());

                // ZipSlip 攻撃を防ぐ
                if (!outFile.getCanonicalPath().startsWith(destDir.getCanonicalPath() + File.separator)) {
                    throw new IOException("不正なZIPエントリ: " + entry.getName());
                }

                if (entry.isDirectory()) {
                    outFile.mkdirs();
                } else {
                    outFile.getParentFile().mkdirs();
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        int len;
                        while ((len = zis.read(buffer)) > 0) {
                            fos.write(buffer, 0, len);
                        }
                    }
                    count++;
                }
                zis.closeEntry();
            }
            logger.info("ZIP展開完了: " + count + " ファイル");
        }
    }

    /**
     * npm install --production を実行します（フォールバック用）
     */
    private boolean runNpmInstall() {
        try {
            String[] cmd = isWindows()
                    ? new String[]{"cmd.exe", "/c", "npm", "install", "--omit=dev"}
                    : new String[]{"npm", "install", "--omit=dev"};

            ProcessBuilder pb = new ProcessBuilder(cmd)
                    .directory(webappDir)
                    .redirectErrorStream(true);

            Process process = pb.start();

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.startsWith("npm warn") || line.startsWith("npm error")) {
                        logger.warning("[npm] " + line);
                    } else if (!line.isBlank()) {
                        logger.info("[npm] " + line);
                    }
                }
            }

            boolean finished = process.waitFor(120, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                logger.severe("npm install がタイムアウトしました（120秒）");
                return false;
            }
            return process.exitValue() == 0;

        } catch (Exception e) {
            logger.severe("npm install の実行中にエラーが発生しました: " + e.getMessage());
            return false;
        }
    }

    /**
     * Node.js プロセスを起動します
     */
    private boolean startNodeProcess() {
        try {
            String[] cmd = isWindows()
                    ? new String[]{"cmd.exe", "/c", "node", "src/index.js"}
                    : new String[]{"node", "src/index.js"};

            ProcessBuilder pb = new ProcessBuilder(cmd).directory(webappDir);
            pb.environment().put("NODE_ENV", "production");

            nodeProcess = pb.start();

            // stdout をサーバーログに転送
            stdoutThread = new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(nodeProcess.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        logger.info("[Node] " + line);
                    }
                } catch (IOException ignored) {}
            }, "DiscordAuth-NodeStdout");
            stdoutThread.setDaemon(true);
            stdoutThread.start();

            // stderr をサーバーログに転送
            stderrThread = new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(nodeProcess.getErrorStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        logger.warning("[Node] " + line);
                    }
                } catch (IOException ignored) {}
            }, "DiscordAuth-NodeStderr");
            stderrThread.setDaemon(true);
            stderrThread.start();

            // 起動直後のクラッシュ確認（2秒待つ）
            Thread.sleep(2000);
            if (!nodeProcess.isAlive()) {
                int exitCode = nodeProcess.exitValue();
                logger.severe("Node.jsプロセスが起動直後に終了しました（終了コード: " + exitCode + "）");
                logger.severe("plugins/DiscordAuth/config.yml の設定を確認してください");
                return false;
            }

            int port = plugin.getConfig().getInt("web.port", 3000);
            logger.info("Node.jsアプリが起動しました — http://localhost:" + port +
                        " （PID: " + nodeProcess.pid() + "）");
            return true;

        } catch (Exception e) {
            logger.severe("Node.jsプロセスの起動に失敗しました: " + e.getMessage());
            logger.severe("→ Node.js がインストールされているか確認してください: https://nodejs.org/");
            return false;
        }
    }

    private boolean isWindows() {
        return System.getProperty("os.name").toLowerCase().contains("win");
    }
}
