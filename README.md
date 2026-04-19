# DiscordAuth — Minecraft × Discord 認証プラグイン

![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)
![Minecraft](https://img.shields.io/badge/Minecraft-Spigot%2FPaper-green.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen.svg)
![Java](https://img.shields.io/badge/Java-17+-orange.svg)

Minecraftサーバーに参加するプレイヤーが、特定のDiscordサーバーに所属するDiscordアカウントと  
Minecraftアカウントを連携していることを要求する認証システムです。

**Discord Bot・Webダッシュボード・認証APIはすべてこのプラグインに内蔵されています。**  
Minecraftサーバーを起動するだけで、自動的にすべてのサービスが立ち上がります。

## ✨ 主な機能

- **オールインワン**: プラグイン内にすべてのシステム（Bot, Webサーバー）を内蔵。外部サーバーは不要です。
- **マルチアカウント対応**: 1つのDiscordアカウントに対して、複数のMinecraftアカウントを連携可能です。
- **GeyserMC (Bedrock版) 対応**: 統合版（Bedrock版）プレイヤーも、Java版と同様に認証・連携が可能です。設定からBedrockのプレフィックスを指定できます。
- **Webダッシュボード**: プレイヤーはWeb画面から簡単にアカウントの連携・管理ができます。

---

## 仕組み

```
Minecraftサーバー起動
       │
       ▼
DiscordAuth プラグイン読み込み
       │
       ├─ Node.jsアプリを自動起動（subprocess）
       │    ├─ Discord Bot（ボタン連携）
       │    ├─ Webダッシュボード（OAuth2連携）
       │    └─ 認証API（/api/auth/check/:uuid）
       │
       └─ AsyncPlayerPreLoginEvent を監視
            └─ 参加時に認証APIへ問い合わせ
                 ├─ 連携済み → 参加許可
                 └─ 未連携  → キックして連携方法を案内
```

---

## セットアップ

### 必要なもの

| ツール | バージョン | 用途 |
|--------|-----------|------|
| **Java JDK** | 17以上 | プラグインのビルドおよびMinecraftサーバー実行 |
| **Maven** | 3.6以上 | プラグインのビルド |
| **Node.js** | 18以上 | Discord Bot + Webサーバー（Minecraftサーバー上で動作） |

> ⚠️ **Node.js はMinecraftサーバーのマシンにインストールしてください。**  
> プラグインが自動的に `npm install` と `node` を実行します。

---

### 1. Discord Application の作成

1. [Discord Developer Portal](https://discord.com/developers/applications) を開く
2. **New Application** → アプリ名を入力
3. **Bot** タブ → **Add Bot**
   - **Token** をコピー（後で使用）
   - **SERVER MEMBERS INTENT** を **ON** にする ⚠️（必須）
4. **OAuth2** タブ
   - **Client ID** と **Client Secret** をコピー
   - **Redirects** に `http://あなたのドメイン:3000/auth/discord/callback` を追加
5. BotをDiscordサーバーに招待（`bot` + `applications.commands` スコープ）

---

### 2. プラグインのビルド

以下のコマンドを実行します（Java JDKとMavenが必要）:

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File build.ps1
```

```bash
# macOS / Linux
cd plugin/DiscordAuth
mvn clean package
```

ビルド完了後、JAR は `plugin/DiscordAuth/output/DiscordAuth-1.0.0.jar` に生成されます。

---

### 3. プラグインのインストールと設定

1. `DiscordAuth-1.0.0.jar` を Minecraftサーバーの `plugins/` フォルダにコピー
2. サーバーを **一度起動** → `plugins/DiscordAuth/config.yml` が生成されます
3. **サーバーを停止** して `config.yml` を編集:

```yaml
discord:
  bot-token: "あなたのBotトークン"
  client-id: "あなたのClientID"
  client-secret: "あなたのClientSecret"
  guild-id: "参加必須のDiscordサーバーID"

web:
  port: 3000
  base-url: "http://あなたのサーバーIP:3000"

api:
  key: "ランダムな秘密キー（何でも可）"

auth:
  bedrock-prefix: "." # GeyserMCを使用している場合のBedrockプレフィックス
```

4. サーバーを再起動 → プラグインが自動的にNode.jsアプリを起動します

---

### 4. Discord Bot のセットアップ

サーバーが起動したら、Discordで:

```
/setup
```

を実行すると、アカウント連携用のボタン付きメッセージが投稿されます。

---

## Discord Bot コマンド

| コマンド | 説明 | 権限 |
|---------|------|------|
| `/setup` | 連携ボタン付きメッセージを投稿 | 管理者 |
| `/status` | 自分の連携状態を確認 | 全員 |
| `/unlink` | 自分のアカウント連携を解除 | 全員 |
| `/unlink <プレイヤー名>` | 指定プレイヤーの連携を解除 | 管理者 |
| `/whitelist` | 連携済みアカウント一覧を表示 | 管理者 |

## Minecraft コマンド

| コマンド | 説明 |
|---------|------|
| `/da reload` | 設定を再読み込み |
| `/da status <プレイヤー>` | プレイヤーの認証状態を確認 |
| `/da clearcache` | 認証キャッシュをクリア |
| `/da node start` | Node.jsアプリを手動起動 |
| `/da node stop` | Node.jsアプリを停止 |
| `/da node restart` | Node.jsアプリを再起動 |
| `/da node status` | Node.jsアプリの状態確認 |

---

## プロジェクト構成

```
Minecraft_Auth/
├── build.ps1                          # ビルドスクリプト（Windows）
├── plugin/DiscordAuth/                # Minecraftプラグイン（Java）
│   ├── pom.xml
│   ├── output/DiscordAuth-1.0.0.jar  # ← ビルド後に生成されるJAR
│   └── src/main/
│       ├── java/com/discordauth/
│       │   ├── DiscordAuthPlugin.java # プラグインメインクラス
│       │   ├── NodeManager.java       # Node.jsプロセス管理
│       │   ├── AuthListener.java      # 参加時認証チェック
│       │   ├── AuthCommand.java       # 管理コマンド
│       │   └── AuthAPI.java           # HTTP認証APIクライアント
│       └── resources/
│           ├── config.yml             # 設定ファイル（日本語コメント）
│           ├── plugin.yml
│           ├── webapp-files.txt       # 同梱するNode.jsファイルのリスト
│           └── webapp/                # ← JARに同梱されるNode.jsアプリ
│               ├── package.json
│               ├── src/               # Discord Bot + Web API
│               └── public/            # Webダッシュボード
├── src/                               # Node.jsアプリのソース（開発用）
└── public/                            # Webダッシュボードのソース（開発用）
```

> **注意:** `plugin/DiscordAuth/src/main/resources/webapp/` は `src/` と `public/` を  
> ビルド時に自動コピーしたものです。ソースを編集する場合は `src/` と `public/` を編集し、  
> `build.ps1` を実行してください（自動で同期されます）。

---

## Minecraftサーバー上でのファイル構成

プラグインインストール後、Minecraftサーバー上では以下のような構成になります:

```
plugins/
└── DiscordAuth/
    ├── config.yml          ← ここを編集して設定
    ├── webapp/             ← Node.jsアプリが展開される場所
    │   ├── .env            ← config.ymlから自動生成（編集不要）
    │   ├── node_modules/   ← npm installで自動生成
    │   ├── src/
    │   └── public/
    └── data/
        └── auth.db         ← SQLiteデータベース（自動生成）
```
