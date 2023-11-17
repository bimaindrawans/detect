import { EmbedBuilder, IntentsBitField, Client } from "discord.js";
import { PrismaClient } from "@prisma/client";

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

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

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
            return message.reply({
                content: "There is no music bot in this server.", failIfNotExists: false
            });
        }

        const botsStatus = await Promise.all(bots.map(async bot => {
            const voice = message.guild.voiceStates.cache.get(bot.bot_id);
            const b = await message.guild.members.fetch({ user: bot.bot_id }).catch(() => ({ displayName: "Unknown Bot" }));
            if (voice) return `❎ | ${b.displayName}`;
            return `✅ | ${b.displayName}`;
        }));

        const availableCount = botsStatus.filter(status => status.startsWith("✅")).length;
        const unavailableCount = botsStatus.filter(status => status.startsWith("❎")).length;

        const embed = new EmbedBuilder()
            .setAuthor({
                name: `${message.guild.name} Available Music Bots`,
                iconURL: message.guild.iconURL({ size: 4096 })
            })
            .setDescription(botsStatus.join("\n"))
            .addFields(
                {
                    name: "✅ Total Available",
                    value: availableCount.toString(),
                    inline: true
                },
                {
                    name: "❌ Total Unavailable",
                    value: unavailableCount.toString(),
                    inline: true
                }
            );

        return message.reply({ embeds: [embed], failIfNotExists: false });
    }

    if (command === "addbot") {
        if (!message.member.permissions.has("ManageGuild")) return;
        const bot = message.mentions.members.first();
        if (!bot) return message.reply({ content: "Please mention a bot.", failIfNotExists: false });
        if (!bot.user.bot) return message.reply({ content: "Please mention a bot.", failIfNotExists: false });
        const botExists = await prisma.bot.findFirst({
            where: {
                bot_id: bot.id,
                guild: message.guild.id
            }
        });

        if (botExists) return message.reply({ content: "This bot is already added.", failIfNotExists: false });
        await prisma.bot.create({
            data: {
                bot_id: bot.id,
                guild: message.guild.id
            }
        });

        return message.reply({ content: "Bot added successfully.", failIfNotExists: false });
    }

    if (command === "removebot") {
        if (!message.member.permissions.has("ManageGuild")) return;
        const bot = message.mentions.members.first();
        if (!bot) return message.reply({ content: "Please mention a bot.", failIfNotExists: false });
        if (!bot.user.bot) return message.reply({ content: "Please mention a bot.", failIfNotExists: false });
        const botExists = await prisma.bot.findFirst({
            where: {
                bot_id: bot.id,
                guild: message.guild.id
            }
        });

        if (!botExists) return message.reply({ content: "This bot is not added.", failIfNotExists: false });
        await prisma.bot.delete({
            where: {
                id: botExists.id
            }
        });

        return message.reply({ content: "Bot removed successfully.", failIfNotExists: false });
    }
});

await client.login();