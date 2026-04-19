const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} = require('discord.js');
const db = require('../../database');
const { getPlayerProfile } = require('../../utils/mojang');
const { checkGuildMembership } = require('../../utils/discord');

module.exports = async function handleInteraction(interaction, client) {
  // ─── スラッシュコマンド ───────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[Bot] /${interaction.commandName} の実行中にエラーが発生しました:`, err);
      const msg = { content: '❌ コマンドの実行中にエラーが発生しました。', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
    return;
  }

  // ─── ボタン: Minecraftアカウントを連携 ───────────────────────
  if (interaction.isButton() && interaction.customId === 'link-minecraft-btn') {
    const modal = new ModalBuilder()
      .setCustomId('link-minecraft-modal')
      .setTitle('Minecraftアカウント連携');

    const usernameInput = new TextInputBuilder()
      .setCustomId('minecraft-username-input')
      .setLabel('Minecraftユーザー名を入力してください')
      .setPlaceholder('例: Steve、Notch、Dream')
      .setStyle(TextInputStyle.Short)
      .setMinLength(3)
      .setMaxLength(16)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(usernameInput));
    await interaction.showModal(modal);
    return;
  }

  // ─── ボタン: 連携状態を確認 ──────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'check-status-btn') {
    const records = db.getAccountsByDiscordId(interaction.user.id);

    if (records.length > 0) {
      const embed = new EmbedBuilder()
        .setColor(0x00d26a)
        .setTitle('✅ アカウント連携済み')
        
      records.forEach((record, index) => {
        embed.addFields(
          { name: `🎮 アカウント ${index + 1}`, value: `\`${record.minecraft_username}\` (UUID: \`${record.minecraft_uuid}\`)`, inline: false }
        );
      });
      
      if (records.length === 1) {
          embed.setThumbnail(`https://mc-heads.net/avatar/${records[0].minecraft_uuid}/64`);
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      const embed = new EmbedBuilder()
        .setColor(0xff4757)
        .setTitle('❌ 未連携')
        .setDescription('**🔗 Minecraftアカウントを連携** ボタンをクリックしてアカウントを連携してください。');

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    return;
  }

  // ─── モーダル送信: Minecraftアカウント連携 ───────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'link-minecraft-modal') {
    await interaction.deferReply({ ephemeral: true });

    const username = interaction.fields.getTextInputValue('minecraft-username-input').trim();

    try {
      // 1. Discordサーバーのメンバーシップ確認
      const isMember = await checkGuildMembership(interaction.user.id);
      if (!isMember) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff4757)
              .setTitle('❌ Discordサーバーへの参加が必要です')
              .setDescription('アカウントを連携するには、指定のDiscordサーバーのメンバーである必要があります。'),
          ],
        });
      }

      // 2. MojangAPIでMinecraftプレイヤーを検索 (Bedrockの場合はスキップ)
      const bedrockPrefix = process.env.BEDROCK_PREFIX || '';
      let profile = null;

      if (bedrockPrefix && username.startsWith(bedrockPrefix)) {
        // Bedrockアカウント: Mojang APIをスキップしてダミーのUUIDを生成
        profile = {
          id: `offline-${Buffer.from(username).toString('hex').substring(0, 24)}`,
          name: username,
        };
      } else {
        // Javaアカウント: Mojang APIで検索
        profile = await getPlayerProfile(username);
      }

      if (!profile) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff4757)
              .setTitle('❌ プレイヤーが見つかりません')
              .setDescription(`ユーザー名 \`${username}\` のMinecraftアカウントが見つかりませんでした。\n\n正しく入力されているか確認してください（Java Edition のみ対応）。`),
          ],
        });
      }

      // 3. このMinecraftアカウントが他のDiscordユーザーと連携済みか確認
      const existingMc = db.getByMinecraftUuid(profile.id);
      if (existingMc) {
        if (existingMc.discord_id === interaction.user.id) {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xff4757)
                .setTitle('❌ 既に連携済み')
                .setDescription(`Minecraftアカウント \`${profile.name}\` は既にあなたと連携されています。`),
            ],
          });
        } else {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xff4757)
                .setTitle('❌ 既に連携済み')
                .setDescription(`Minecraftアカウント \`${profile.name}\` は既に別のDiscordユーザーと連携されています。`),
            ],
          });
        }
      }

      // 4. 連携情報を保存
      db.linkAccount({
        discord_id: interaction.user.id,
        discord_username: interaction.user.tag,
        minecraft_username: profile.name,
        minecraft_uuid: profile.id,
      });

      // 5. 成功！
      const embed = new EmbedBuilder()
        .setColor(0x00d26a)
        .setTitle('✅ アカウント連携が完了しました！')
        .setDescription(`Discordアカウントが **${profile.name}** と連携されました。`)
        .addFields(
          { name: '🎮 Minecraftユーザー名', value: `\`${profile.name}\``, inline: true },
          { name: '🆔 UUID', value: `\`${profile.id}\``, inline: false },
        )
        .setThumbnail(`https://mc-heads.net/avatar/${profile.id}/128`)
        .setFooter({ text: 'これでMinecraftサーバーに参加できます！' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Bot] アカウント連携中にエラーが発生しました:', err);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff4757)
            .setTitle('❌ エラー')
            .setDescription('予期しないエラーが発生しました。しばらくしてからもう一度お試しください。'),
        ],
      });
    }
  }
};
