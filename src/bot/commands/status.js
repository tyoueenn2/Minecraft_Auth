const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Minecraftアカウントの連携状態を確認します'),

  async execute(interaction) {
    const records = db.getAccountsByDiscordId(interaction.user.id);

    if (records.length > 0) {
      const embed = new EmbedBuilder()
        .setColor(0x00d26a)
        .setTitle('✅ アカウント連携済み')
        .setFooter({ text: '連携を解除するには /unlink を使用してください' });
        
      records.forEach((record, index) => {
        embed.addFields(
          { name: `🎮 アカウント ${index + 1}`, value: `\`${record.minecraft_username}\` (UUID: \`${record.minecraft_uuid}\`)`, inline: false }
        );
      });
      
      if (records.length === 1) {
          embed.setThumbnail(`https://mc-heads.net/avatar/${records[0].minecraft_uuid}/128`);
      }

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
