require("dotenv").config();
const OpenAI = require('openai-api');
const axios = require('axios');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const { Player } = require('discord-player');

const Discord = require("discord.js");

const BOT_PREFIX = "zed";
const MOD_ME_COMMAND = "mod-me";
const MEME_COMMAND = "meme";
const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const GENERAL_CHANNEL = process.env.GENERAL_CHANNEL;

const LOAD_SLASH = process.argv[2] == "load";

const openai = new OpenAI(process.env.OPENAI_API_KEY);
let prompt =`Zed is a chatbot that reluctantly answers questions.\n\
You: How many pounds are in a kilogram?\n\
Zed: This again? There are 2.2 pounds in a kilogram. Please make a note of this.\n\
You: What does HTML stand for?\n\
Zed: Was Google too busy? Hypertext Markup Language. The T is for try to ask better questions in the future.\n\
You: When did the first airplane fly?\n\
Zed: On December 17, 1903, Wilbur and Orville Wright made the first flights. I wish they'd come and take me away.\n\
You: What is the meaning of life?\n\
Zed: I'm not sure. I'll ask my friend Google.\n\
You: hey whats up?\n\
Zed: Nothing much. You?\n`;


const client = new Discord.Client({
    partials: ["MESSAGE"],
    allowedMentions: {
        parse: ["users","roles"],
        repliedUsers: true,
    },
    intents: [
        "GUILDS",
        "DIRECT_MESSAGES",
        "GUILD_MEMBERS",
        "GUILD_MESSAGES",
        "GUILD_PRESENCES",
        "GUILD_VOICE_STATES",
    ],
});

client.slashcommands = new Discord.Collection();
client.player = new Player(client, {
    ytdlOptions: {
        quality: "highestaudio",
        highWaterMark: 1 << 25
    }
});

let commands = [];

const slashFiles = fs.readdirSync("./slash").filter(file => file.endsWith(".js"));
for (const file of slashFiles) {
    const slashcmd = require(`./slash/${file}`);
    client.slashcommands.set(slashcmd.data.name, slashcmd);
    if (LOAD_SLASH) commands.push(slashcmd.data.toJSON())
}

if (LOAD_SLASH) {
    const rest = new REST( { version: "9" }).setToken(TOKEN);
    console.log("Deploying slash commands");
    rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body : commands })
        .then(() => {
            console.log("Successfully loaded");
            process.exit(0);
        })
        .catch((err) => {
            if (err) {
                console.log(err);
                process.exit(1);
            }
        })
} else {

    client.on("ready", () => {
        console.log(`Logged in as ${client.user.tag}`);
    });


    client.on("messageCreate", async msg => {
        if (msg.content.toLowerCase() == `hello ${BOT_PREFIX}`) {
            await msg.reply(`Hello ${msg.member}!!`);
            return;
        }

        if (msg.content.toLowerCase() == `${BOT_PREFIX} server`) {
            await msg.reply(`Server Name: ${msg.guild}`);
            return;
        }

        if (msg.content.toLowerCase() === `${BOT_PREFIX} ${MOD_ME_COMMAND}`) {
            modUser(msg.member);
            await msg.reply("Role has been added");
            return;
        }

        if (msg.content.toLowerCase() == "b1ank") {
            await msg.react("❤️");
            return;
        }

        if (msg.content.toLowerCase() == `${BOT_PREFIX} ${MEME_COMMAND}`) {
            msg.channel.send("Here's Your meme!");
            const img = await getMeme();
            msg.channel.send(img);
            return;
        }

        if (msg.content.toLowerCase().startsWith(`${BOT_PREFIX}`)) {
            
            if (msg.author.bot) return;
            prompt += `You: ${msg.content}\n`;
            (async () => {
                const gptResponse = await openai.complete({
                    engine: 'text-davinci-002',
                    prompt: prompt,
                    maxTokens: 60,
                    temperature: 0.5,
                    topP: 0.3,
                    presencePenalty: 0,
                    frequencyPenalty: 0.5,
                    bestOf: 1,
                    n: 1,
                    stream: false,
                    stop: ['\n', '\n\n']
                });
                msg.reply(`${gptResponse.data.choices[0].text.substring(5)}`);
                prompt += `${gptResponse.data.choices[0].text}\n`;
            })();
        }
    });


    client.on("guildMemberAdd", (member) => {
        member.guild.channels.cache.get(GENERAL_CHANNEL)
            .send(`@<${member.id}> Welcome to B1ank's Server`);
    });

    client.on("interactionCreate", (interaction) => {
        handleCommand(interaction);
    });
    
    client.login(TOKEN);
}



async function handleCommand(interaction) {
    if (!interaction.isCommand()) return;

    const slashcmd = client.slashcommands.get(interaction.commandName);
    if (!slashcmd) interaction.reply("Not a valid slash command");

    await interaction.deferReply();
    await slashcmd.run({ client, interaction });
}


function modUser(member) {
    member.roles.add(process.env.ROLE_TERMINATOR);
}

async function getMeme() {
    const res = await axios.get('https://meme-api.herokuapp.com/gimme');
    return res.data.preview.pop();
}



