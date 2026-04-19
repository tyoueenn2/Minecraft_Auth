const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Minecraftアカウントの連携を解除します（管理者：プレイヤー名を指定可能）')
    .addStringOption(option =>
      option
        .setName('minecraft_username')
        .setDescription('解除するMinecraftユーザー名（管理者のみ — 省略すると自分のアカウントを解除）')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetName = interaction.options.getString('minecraft_username');

    // 名前が指定されている場合は管理者権限を確認
    if (targetName) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff4757)
              .setTitle('❌ 権限がありません')
              .setDescription('他のプレイヤーの連携を解除できるのは管理者のみです。'),
          ],
          ephemeral: true,
        });
      }

      const record = db.getByMinecraftName(targetName);
      if (!record) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff4757)
              .setTitle('❌ 見つかりません')
              .setDescription(`Minecraftユーザー \`${targetName}\` の連携アカウントが見つかりません。`),
          ],
          ephemeral: true,
        });
      }

      db.unlinkByMinecraftName(targetName);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xffa502)
            .setTitle('🔓 連携解除しました（管理者）')
            .setDescription(`Minecraftアカウント \`${record.minecraft_username}\` と <@${record.discord_id}> の連携を解除しました。`)
            .setThumbnail(`https://mc-heads.net/avatar/${record.minecraft_uuid}/128`),
        ],
        ephemeral: true,
      });
    }

    // 自分のアカウントを解除
    const records = db.getAccountsByDiscordId(interaction.user.id);
    if (records.length === 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff4757)
            .setTitle('❌ 未連携')
            .setDescription('連携済みのMinecraftアカウントがありません。'),
        ],
        ephemeral: true,
      });
    }

    if (records.length > 1) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff4757)
            .setTitle('❌ アカウントが複数あります')
            .setDescription('複数のアカウントが連携されています。解除するアカウントを指定してください：\n`/unlink <minecraft_username>`'),
        ],
        ephemeral: true,
      });
    }

    const record = records[0];
    db.unlinkByMinecraft(record.minecraft_uuid);
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xffa502)
          .setTitle('🔓 連携を解除しました')
          .setDescription(`Minecraftアカウント \`${record.minecraft_username}\` の連携を解除しました。`)
          .setThumbnail(`https://mc-heads.net/avatar/${record.minecraft_uuid}/128`),
      ],
      ephemeral: true,
    });
  },
};
