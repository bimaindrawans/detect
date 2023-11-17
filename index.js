import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, IntentsBitField } from 'discord.js';
import { PrismaClient } from '@prisma/client';

const client = new Client({
    intents: [
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.Guilds
    ],
});

const prisma = new PrismaClient();
const botsPerPage = 10;

// Helper function to create bot embed
async function createBotEmbed(guild, bots, page) {
    const startIndex = page * botsPerPage;
    const endIndex = startIndex + botsPerPage;
    const botsOnPage = bots.slice(startIndex, endIndex);

    const botsStatus = await Promise.all(botsOnPage.map(async bot => {
        const voice = guild.voiceStates.cache.get(bot.bot_id);
        const b = await guild.members.fetch({ user: bot.bot_id }).catch(() => ({ displayName: "Unknown Bot" }));
        return voice ? `❎ | ${b.displayName}` : `✅ | ${b.displayName}`;
    }));

    const availableCount = botsStatus.filter(status => status.startsWith("✅")).length;
    const unavailableCount = botsStatus.filter(status => status.startsWith("❎")).length;

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `${guild.name} Available Music Bots (Page ${page + 1})`,
            iconURL: guild.iconURL({ size: 4096 })
        })
        .setDescription(botsStatus.join("\n"))
        .addFields(
            { name: "✅ Total Available on Page", value: availableCount.toString(), inline: true },
            { name: "❌ Total Unavailable on Page", value: unavailableCount.toString(), inline: true }
        );

    return embed;
}

client.on("messageCreate", async message => {
    const prefix = process.env.PREFIX;
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if (command === "mb") {
        const bots = await prisma.bot.findMany({ 
            where: {
                guild: message.guild.id
            }
        });

        if (!bots.length) {
            return message.reply("There are no music bots in this server.");
        }

        const embed = await createBotEmbed(message.guild, bots, 0);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('previous_page')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(bots.length <= botsPerPage)
            );

        const botMessage = await message.reply({ embeds: [embed], components: [row] });
        const collector = botMessage.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (!i.isButton()) return;
            if (i.user.id !== message.author.id) {
                return i.reply({ content: 'You cannot use this button.', ephemeral: true });
            }

            let currentPage = parseInt(i.message.embeds[0].author.name.match(/Page (\d+)/)[1], 10) - 1;

            if (i.customId === 'previous_page') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (i.customId === 'next_page') {
                currentPage = Math.min(Math.ceil(bots.length / botsPerPage) - 1, currentPage + 1);
            }

            const newEmbed = await createBotEmbed(message.guild, bots, currentPage);
            const newRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('previous_page')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled((currentPage + 1) * botsPerPage >= bots.length)
                );

            await i.update({ embeds: [newEmbed], components: [newRow] });
        });

        collector.on('end', collected => botMessage.edit({ components: [] }));
    }

    if (command === "addbot") {
        if (!message.member.permissions.has("ManageGuild")) {
            return message.reply("You do not have permission to manage bots.");
        }

        const bot = message.mentions.members.first();
        if (!bot || !bot.user.bot) {
            return message.reply("Please mention a valid bot.");
        }

        const botExists = await prisma.bot.findFirst({
            where: {
                bot_id: bot.id,
                guild: message.guild.id
            }
        });

        if (botExists) {
            return message.reply("This bot is already added.");
        }

        await prisma.bot.create({
            data: {
                bot_id: bot.id,
                guild: message.guild.id
            }
        });

        return message.reply("Bot added successfully.");
    }
       // Command to remove a bot
       if (command === "removebot") {
        if (!message.member.permissions.has("ManageGuild")) {
            return message.reply("You do not have permission to manage bots.");
        }

        const bot = message.mentions.members.first();
        if (!bot || !bot.user.bot) {
            return message.reply("Please mention a valid bot.");
        }

        const botExists = await prisma.bot.findFirst({
            where: {
                bot_id: bot.id,
                guild: message.guild.id
            }
        });

        if (!botExists) {
            return message.reply("This bot is not in the list.");
        }

        await prisma.bot.delete({
            where: {
                id: botExists.id
            }
        });

        return message.reply("Bot removed successfully.");
    }
});

await client.login(process.env.BOT_TOKEN);
