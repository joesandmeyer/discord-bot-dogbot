const { Client, GatewayIntentBits } = require('discord.js');
const token = require('./token.js');
const channel_id = require('./channel_id.js');
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

// Define commands for different channels with parameter handling
const channelCommands = {
    [channel_id[0]]: { // roles
        '!help': helpRoles,
        '!role': giveRole
    },
    [channel_id[1]]: { // bots
        '!help': helpBots,
    },
    [channel_id[2]]: { // secret glade
        '!stats': showStats
    },
    [channel_id[3]]: { // roleplay channel
        '!help': helpRP,
        '!explore': explore,
        '!stats': showStats
    }
};

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', (message) => {
    if (message.author.bot) return; // Ignore bot messages

    const channelId = message.channel.id;
    const commandParts = message.content.split(' ');
    const command = commandParts[0].toLowerCase();
    const args = commandParts.slice(1); // Parameters

    // Check if the channel has defined commands
    if (channelCommands[channelId]) {
        // Execute the command if it exists in the channel-specific commands
        const commandHandler = channelCommands[channelId][command];
        if (commandHandler) {
            commandHandler(message, ...args); // Pass parameters to the handler
        }
    }
});


  //
 // Channel: roles
//

async function giveRole(message, roleName) {
    if (!roleName) {
        return message.reply('Please specify a role (weeb, fur, game dev)');
    }
    await assignRole(message, roleName);
}

async function helpRoles(message) {
    message.reply('!help -- roles help/n!role [role_name]');
}

  //
 // Channel: bots
//

async function helpBots(message) {
    message.reply('!help -- bots help');
}

  //
 // Channel: sfw-roleplay


async function helpRP(message) {
    message.reply('!help -- roleplay help\n!explore -- random encounter\n!stats -- show stats');
}

// Simulate gaining XP and leveling up
function explore(message) {
    const userId = message.author.id;

    // Get the current stats of the user
    let userStats = getUserStats(userId);

    // Random XP gain
    const xpGained = Math.floor(Math.random() * 20) + 10;
    userStats.xp += xpGained;

    // Check if the user should level up
    const xpPerLevel = 100;
    if (userStats.xp >= xpPerLevel) {
        userStats.level += 1;
        userStats.xp = userStats.xp - xpPerLevel; // Reset XP for the next level
        message.reply(`You leveled up! You are now level ${userStats.level}`);
    } else {
        message.reply(`You gained ${xpGained} XP. Current XP: ${userStats.xp}`);
    }

    // Save updated stats back to the file
    updateUserStats(userId, userStats);
}

function showStats(message) {
    const userId = message.author.id;
    
    // Get the user's stats from the file
    let userStats = getUserStats(userId);

    // Display stats
    message.reply(`You are level ${userStats.level} with ${userStats.xp} XP.`);
}

// Common functions
async function assignRole(message, roleName) {
    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!role) {
        return message.reply(`Role "${roleName}" not found!`);
    }
    try {
        await message.member.roles.add(role);
        message.reply(`You have been given the **${roleName}** role!`);
    } catch (error) {
        console.error(error);
        message.reply("I couldn't assign the role due to an error.");
    }
}

function levelUpUser(message, userId) {
    const user = userData[userId];
    user.level += 1;
    user.xp = user.xp - xpPerLevel;
    message.reply(`Congratulations! You've leveled up to level ${user.level}!`);
}


//savedata functions
const fs = require('fs');
const path = require('path');

// Directory to store user stats
const userStatsDir = './users/';

function ensureUserStatsFile(userId) {
    const userStatsFile = path.join(userStatsDir, `${userId}/stats.json`);

    // Check if user's stats.json file exists
    if (!fs.existsSync(userStatsFile)) {
        // Create a new directory and file for the user if they don't exist
        fs.mkdirSync(path.join(userStatsDir, userId), { recursive: true });
        const initialStats = {
            xp: 0,
            level: 1
        };
        fs.writeFileSync(userStatsFile, JSON.stringify(initialStats, null, 4)); // Write the initial stats
    }
}

function getUserStats(userId) {
    const userStatsFile = path.join(userStatsDir, `${userId}/stats.json`);

    // Ensure the file exists before reading
    ensureUserStatsFile(userId);

    // Read and return user stats
    const statsData = fs.readFileSync(userStatsFile);
    return JSON.parse(statsData);
}

function updateUserStats(userId, newStats) {
    const userStatsFile = path.join(userStatsDir, `${userId}/stats.json`);

    // Ensure the file exists before updating
    ensureUserStatsFile(userId);

    // Write updated stats back to the file
    fs.writeFileSync(userStatsFile, JSON.stringify(newStats, null, 4));
}





client.login(token);
