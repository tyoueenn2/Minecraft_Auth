const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('連携済みMinecraftアカウント一覧を表示します（管理者のみ）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const linked = db.getAllLinked();
    const count = linked.length;

    if (count === 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xffa502)
            .setTitle('📋 連携アカウント一覧')
            .setDescription('現在、連携済みのアカウントはありません。'),
        ],
        ephemeral: true,
      });
    }

    // 10件ずつページ分割
    const pageSize = 10;
    const pages = [];
    for (let i = 0; i < linked.length; i += pageSize) {
      const slice = linked.slice(i, i + pageSize);
      const lines = slice.map((r, idx) => {
        const num = i + idx + 1;
        const time = Math.floor(new Date(r.linked_at).getTime() / 1000);
        return `**${num}.** \`${r.minecraft_username}\` ↔ <@${r.discord_id}> • <t:${time}:R>`;
      });
      pages.push(lines.join('\n'));
    }

    const embed = new EmbedBuilder()
      .setColor(0x00d26a)
      .setTitle(`📋 連携アカウント一覧（合計 ${count} 件）`)
      .setDescription(pages[0])
      .setFooter({ text: `${pages.length} ページ中 1 ページ目` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
