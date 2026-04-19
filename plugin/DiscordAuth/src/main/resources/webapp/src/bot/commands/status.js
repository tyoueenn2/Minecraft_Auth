const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Minecraftアカウントの連携状態を確認します'),

  async execute(interaction) {
    const record = db.getByDiscordId(interaction.user.id);

    if (record) {
      const embed = new EmbedBuilder()
        .setColor(0x00d26a)
        .setTitle('✅ アカウント連携済み')
        .addFields(
          { name: '🎮 Minecraftユーザー名', value: `\`${record.minecraft_username}\``, inline: true },
          { name: '🆔 Minecraft UUID', value: `\`${record.minecraft_uuid}\``, inline: false },
          { name: '📅 連携日時', value: `<t:${Math.floor(new Date(record.linked_at).getTime() / 1000)}:R>`, inline: true },
        )
        .setThumbnail(`https://mc-heads.net/avatar/${record.minecraft_uuid}/128`)
        .setFooter({ text: '連携を解除するには /unlink を使用してください' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      const embed = new EmbedBuilder()
        .setColor(0xff4757)
        .setTitle('❌ 未連携')
        .setDescription(
          'まだMinecraftアカウントが連携されていません。\n\n' +
          '**🔗 Minecraftアカウントを連携** ボタンをクリックするか、Webダッシュボードから連携してください。'
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
