# DiscordAuth - Minecraft Plugin ビルド手順

## 前提条件
- Java 17以上 (JDK)
- Maven 3.6以上

## ビルド方法

### Windows
```cmd
cd plugin\DiscordAuth
mvn clean package
```

### macOS / Linux
```bash
cd plugin/DiscordAuth
mvn clean package
```

## 出力ファイル
ビルド完了後、JARファイルは以下の場所に生成されます:
```
plugin/DiscordAuth/target/DiscordAuth-1.0.0.jar
```

## インストール
1. 生成された `DiscordAuth-1.0.0.jar` をMinecraftサーバーの `plugins/` フォルダにコピー
2. サーバーを起動（または `/reload` コマンドを実行）
3. `plugins/DiscordAuth/config.yml` が自動生成されるので、設定を編集
4. `/da reload` で設定を反映

## 設定
`config.yml` の主要な設定項目:
- `api.url` — 認証APIサーバーのURL
- `api.key` — APIキー（Node.jsサーバーの `.env` の `API_KEY` と同じ値）
- `discord.guild-id` — DiscordサーバーID
- `auth.fail-open` — API接続失敗時の動作（true = 許可、false = 拒否）
