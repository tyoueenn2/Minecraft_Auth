const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Minecraftアカウント連携メッセージを送信します')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x00d26a)
      .setTitle('⛏️ Minecraftアカウント連携')
      .setDescription(
        '**同好会サーバーに参加するにはアカウント連携が必要です！**\n\n' +
        '同好会サーバーに参加するには、DiscordアカウントとMinecraftアカウントを連携する必要があります。\n\n' +
        '> 🔗 下のボタンをクリックして開始\n' +
        '> 📝 ポップアップにMinecraftのユーザー名を入力\n' +
        '> ✅ 連携完了後、サーバーに参加できます！\n\n' +
        '*いつでも再連携して別のMinecraftアカウントに変更できます。*'
      )
      .setThumbnail('https://mc-heads.net/avatar/MHF_Steve/128')
      .setFooter({ text: 'Minecraft Discord Auth • セキュアアカウント連携' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('link-minecraft-btn')
        .setLabel('🔗 Minecraftアカウントを連携')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('check-status-btn')
        .setLabel('📋 連携状態を確認')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ content: '連携メッセージを送信しました ✅', ephemeral: true });
    await interaction.channel.send({ embeds: [embed], components: [row] });
  },
};
