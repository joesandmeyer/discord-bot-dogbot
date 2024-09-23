const { Client, GatewayIntentBits, MessageCollector } = require('discord.js');
const token = require('./token.js');
const channel_id = require('./channel_id.js');
const items = {
    "weapon": require('./items/weapons.js'),
    "armor": require('./items/armor.js'),
    "consumable": require('./items/consumables.js'),
    "misc": require('./items/misc.js')
};
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

user_action = {};

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
        '!status': showStatus,
        '!explore': explore,
        '!inv': showInventory,
        '!equip': equipItem
    },
    [channel_id[3]]: { // roleplay channel: start
        '!help': helpRP,
        '!explore': explore,
        '!status': showStatus,
        '!inv': showInventory,
        '!equip': equipItem
    },
    [channel_id[4]]: { // roleplay channel: dwarven township
        '!help': helpDwarvenTownship,
        '!explore': explore,
        '!status': showStatus,
        '!inv': showInventory,
        '!equip': equipItem,
        '!tavern': enterTavern
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
        return message.reply('Please specify a role (weeb, fur, gamedev)');
    }
    await assignRole(message, roleName);
}

async function helpRoles(message) {
    message.reply('!help -- roles help\n!role [role_name] -- self-assign role');
}


  //
 // Channel: bots
//

async function helpBots(message) {
    message.reply('!help -- bots help');
}


  //
 // Channel: roleplay main
//

async function helpRP(message) {
    message.reply('!help -- roleplay help\n!explore -- random encounter\n!status -- show user profile\n!inv -- show inventory\n!equip -- equip an item');
}


  //
 // Channel: dwarven township
//

async function helpDwarvenTownship(message) {
    message.reply('!help -- roleplay help\n!explore -- random encounter\n!status -- show user profile\n!inv -- show inventory\n!equip -- equip an item\n!tavern -- rent a room (5 gold)');
}


  //
 // Explore
//

async function explore(message) {
    const userId = message.author.id;
    const chanId = message.channel.id;
    
    // prevent mutliple user actions at once
    if (user_action[userId]) {
        await message.reply(`User is busy performing an action.\n\nExploration cannot be performed.`);
        return;
    }
    user_action[userId] = true;

    // Get the current stats of the user
    let userStats = getUserStats(userId);
    let loc = getLocation(chanId);
    
    await message.reply(`Exploring: ${loc.name}.`);
    
    //choose random encounter at location
    if (Math.random() * 100 < parseInt(loc.danger)) { // hostile encounter
        let outcome = "failure";
        let esc = false;
        
        const keys = Object.keys(loc.monsters);
        const n = keys[Math.floor(Math.random() * keys.length)];
        const monster = loc.monsters[n];
        
        await message.reply(`A ${monster.name} stands in your way...\nPrepare for battle!`);
        
        let playerhp = userStats.hp;
        let playermp = userStats.mp;
        let monsterhp = monster.hp;
        let monstermp = monster.mp;
        let turn = "player";
        
        while (playerhp >= 1 && monsterhp >= 1) {
          
              //
             // battle
            //
            
            await message.reply(`It's the ${turn}'s turn!`);
            
            if (turn === "player") {
                message.reply(`!a -- attack\n!b -- items\n!c -- run\n`);
                
                 // Collect player input
                const filter = m => m.author.id === userId && ['!a', '!b', '!c'].includes(m.content.toLowerCase());
                const collector = new MessageCollector(message.channel, { filter, time: 60000 }); // 60 seconds timeout
                
                await new Promise(resolve => {
                    collector.on('collect', async (cmd) => {
                        collector.stop(); // Stop collecting after the first valid input
                        const command = cmd.content.toLowerCase();
                        if (command === '!a') {
                            const weapon = items.weapon[userStats.equipped.hands];
                            const high = parseInt(weapon.max_damage);
                            const low = parseInt(weapon.min_damage);
                            const dmg = Math.floor(Math.random() * (high - low) + low);
                            monsterhp -= dmg;
                            
                            await message.reply(`You chose to attack!\n\nYour ${weapon.name} deals ${dmg} damage.`);
                            
                        } else if (command === '!b') {
                            await message.reply(`You chose to use items!`);
                        } else if (command === '!c') {
                            await message.reply(`You chose to run!\n\nYour stats:   HP ${playerhp}/100    MP ${playermp}/100`);
                            
                            userStats.hp = playerhp;
                            userStats.mp = playermp;
                            
                            updateUserStats(userId, userStats);
                            user_action[userId] = false;
                            return;
                        }
                        turn = "monster"; // Switch turn after player's action
                        resolve();
                    });
                    
                    collector.on('end', async (collected, reason) => {
                        if (reason === 'time') {
                            await message.reply(`Time's up!\n\nYour turn has been skipped.`);
                            turn = "monster"; // Automatically switch turn after timeout
                            resolve();
                        }
                    });
                });
              
                turn = "monster";
            } else {
                const moves = monster.attacks;
                
                const keys = Object.keys(moves); 
                const randomKey = keys[Math.floor(Math.random() * keys.length)];
                const move = moves[randomKey];
                
                const high = parseInt(move.max_damage);
                const low = parseInt(move.min_damage);
                const dmg = Math.floor(Math.random() * (high - low) + low);
                playerhp -= dmg;
                
                await message.reply(`${monster.name} used ${randomKey}!\n\nThe attack damages you for ${dmg} hp.`);
              
                turn = "player";
            }
            
            if (playerhp < 1) playerhp = 0;
            if (monsterhp < 1) monsterhp = 0;
            
            const name = monster.name.charAt(0).toUpperCase() + monster.name.slice(1);
            await message.reply(`Your stats:   HP ${playerhp}/100    MP ${playermp}/100\n\n${name}'s stats:   HP ${monsterhp}/${monster.hp}    MP ${monstermp}/${monster.mp}`);
        }
        
        if (playerhp <= monsterhp) {
            await message.reply(`You have been defeated.`);
            outcome = "failure";
        } else {
            const name = monster.name.charAt(0).toUpperCase() + monster.name.slice(1);
            await message.reply(`${name} has been defeated.`);
            outcome = "victory";
        }

        if (outcome === "victory") {
            userStats.hp = playerhp;
            userStats.mp = 100;
            const high = parseInt(monster.gold_max);
            const low = parseInt(monster.gold_min);
            const gold_gain = Math.floor(Math.random() * (high - low) + low);
            const xp_gain = parseInt(monster.xp) + Math.floor(Math.random() * 3);
            userStats.gold += gold_gain;
            userStats.xp += xp_gain;
            await message.reply(`You earned (${gold_gain}) Gold and (${xp_gain}) XP!`);
            //handle monster drops
            const drops = monster.drops;
            if (drops.weapon) {
                for (const [key, item] of Object.entries(drops.weapon)) {
                    if (Math.random() * 100 < parseInt(item.chance)) {
                        if (!userStats.inv.weapon[item.id]) userStats.inv.weapon[item.id] = 1;
                        else userStats.inv.weapon[item.id] += 1;
                        const name = monster.name.charAt(0).toUpperCase() + monster.name.slice(1);
                        const get = items.weapon[item.id].name;
                        await message.reply(`${name} has dropped a weapon: ${get}.`);
                    }
                }
            }
            if (drops.armor) {
                for (const [key, item] of Object.entries(drops.armor)) {
                    if (Math.random() * 100 < parseInt(item.chance)) {
                        if (!userStats.inv.armor[item.id]) userStats.inv.armor[item.id] = 1;
                        else userStats.inv.armor[item.id] += 1;
                        const name = monster.name.charAt(0).toUpperCase() + monster.name.slice(1);
                        const get = items.armor[item.id].name;
                        await message.reply(`${name} has dropped equipment: ${get}.`);
                    }
                }
            }
            if (drops.consumable) {
                for (const [key, item] of Object.entries(drops.consumable)) {
                    if (Math.random() * 100 < parseInt(item.chance)) {
                        if (!userStats.inv.consumable[item.id]) userStats.inv.consumable[item.id] = 1;
                        else userStats.inv.consumable[item.id] += 1;
                        const name = monster.name.charAt(0).toUpperCase() + monster.name.slice(1);
                        const get = items.consumable[item.id].name;
                        await message.reply(`${name} has dropped a consumable item: ${get}.`);
                    }
                }
            }
            if (drops.misc) {
                for (const [key, item] of Object.entries(drops.misc)) {
                    if (Math.random() * 100 < parseInt(item.chance)) {
                        if (!userStats.inv.misc[item.id]) userStats.inv.misc[item.id] = 1;
                        else userStats.inv.misc[item.id] += 1;
                        const name = monster.name.charAt(0).toUpperCase() + monster.name.slice(1);
                        const get = items.misc[item.id].name;
                        await message.reply(`${name} has dropped an item: ${get}.`);
                    }
                }
            }
            
            checkLevelUp(userStats, message)
        } else if (outcome === "failure") {
            userStats.hp = 100;
            userStats.mp = 100;
            userStats.xp = 0;
        }
        
    } else { 
    
          //
         // non-combat encounter
        //
        
        let msg = "Non-combat encounter!\n\n"
        
        // select random encounter
        
        // encounter is type locked-door
        let door = loc.doors[0];
        const key_name = items[door.key_item_type][door.key_item_id].name;
        
        if (door.open === "1") { // door is open
            msg += `You come across an iron door.\n`;
            msg += `The door is already open...`;
            
            await message.reply(msg);
            
            assignRole(message, door.role);
            user_action[userId] = false;
            return;
        }
        
        let is_are = "are";
        if (door.num_keys === "1") is_are = "is";
        
        msg += `You come across an iron door.\n`;
        msg += `There ${is_are} ${door.num_keys} keyholes.\n`;
        msg += `Each keyhole is ${key_name}-shaped.\n\n`;
        
        msg += `!a -- use ${key_name}\n!b -- leave`;
        await message.reply(msg);
        
        // collect player input
        const filter = m => m.author.id === userId && ['!a', '!b'].includes(m.content.toLowerCase());
        const collector = new MessageCollector(message.channel, { filter, time: 40000 }); // 40 seconds timeout
        
        await new Promise(resolve => {
            collector.on('collect', async (cmd) => {
                collector.stop(); // Stop collecting after the first valid input
                
                const command = cmd.content.toLowerCase();
                if (command === '!a') {
                    // check if player has key item
                    
                    let has_key = false;
                    
                    if (key_name in userStats.inv[door.key_item_type]) {
                        const n = parseInt(userStats.inv[door.key_item_type][door.key_item_id]);
                        if (n >= 1) {
                            has_key = true;
                            // remove one of the item from player inventory
                            userStats.inv[door.key_item_type][door.key_item_id] = toString(n-1);
                            // remove one of the keyholes
                            door.num_keys = toString(parseInt(door.num_keys)-1);
                            await message.reply(`After placing a ${key_name} into the door,\nyou hear a mechanism turning."`);
                        }
                    }
                    
                    // player did not have key
                    if (!has_key) {
                        await message.reply(`You do not have the required item: ${key_name}.`);
                    }
                    
                    // check if door can be opened
                    if (parseInt(door.num_keys < 1)) {
                        door.open = "1";
                        await message.reply(`The door opens!`);
                        assignRole(message, door.role);
                    }
                    
                    await message.reply(`There are ${door.num_keys} keyholes left.\n\nEncounter has ended.`);
                    
                    loc.doors[0] = door;
                    updateLocation(chanId, loc);
                    
                } else if (command === '!b') {
                    await message.reply(`Encounter has ended.`);
                }
                
                resolve();
            });
            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await message.reply(`You took too long to decide!\n\nEncounter has ended.`);
                    resolve();
                }
            });
        });
        
        
        
        // ecnounter is type NPC
        
        
        
        
        
        
        
        
        
        
        
        
        
    }
    
    // Save updated stats back to the file
    updateUserStats(userId, userStats);
    user_action[userId] = false;
}


  //
 // Taverns
//

async function enterTavern(message) {
    const userId = message.author.id;
    //let userStats = getUserStats(userId);

    await message.reply(`This feature is WIP.`);
}

function showStatus(message) {
    const userId = message.author.id;
    let userStats = getUserStats(userId);

    // Display stats
    checkLevelUp(userStats, message);
    message.reply(`HP:   ${userStats.hp}\nMP:   ${userStats.mp}\n\nGold:   ${userStats.gold}\n\nHands:   ${items.weapon[userStats.equipped.hands].name}\nHead:   ${items.armor[userStats.equipped.head].name}\nTorso:   ${items.armor[userStats.equipped.torso].name}\nLegs:   ${items.armor[userStats.equipped.legs].name}`);
}

function showInventory(message) {
    const userId = message.author.id;
    let msg = "Your inventory:";
    const userStats = getUserStats(userId);
    const inv = userStats.inv;

    for (const [key, list] of Object.entries(inv)) {
        msg += `\n\n -  ${key}`;
        for (const [item, n] of Object.entries(list)) {
            const item_name = items[key][item].name;
            msg += `\n   -  ${item_name} (${n})`;
        }
    }
    message.reply(msg);
}


  //
 // common functions
//

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


  //
 // savedata functions
//

const fs = require('fs');
const path = require('path');

const userStatsDir = './users/';
const locationsDir = './locations/';

function ensureUserStatsFile(userId) {
    const userStatsFile = path.join(userStatsDir, `${userId}/stats.json`);

    // Check if user's stats.json file exists
    if (!fs.existsSync(userStatsFile)) {
        // Create a new directory and file for the user if they don't exist
        fs.mkdirSync(path.join(userStatsDir, userId), { recursive: true });
        const initialStats = {
            xp: 0,
            level: 1,
            hp: 100,
            mp: 100,
            gold: 0,
            equipped: {
                hands: 0,
                head: 0,
                torso: 0,
                legs: 0
            },
            inv: {
                "weapon": {},
                "armor": {},
                "consumable": {},
                "misc": {}
            }
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

function getLocation(locId) {
    const locationFile = path.join(locationsDir, `${locId}/loc.json`);
    const locationData = path.join(locationsDir, `${locId}/data.json`);

    // Read and return user stats
    let loc = JSON.parse(fs.readFileSync(locationFile));
    const dat = JSON.parse(fs.readFileSync(locationData));
    
    loc.doors = dat.doors;
    loc.storage = dat.storage;
    
    return loc;
}

function updateUserStats(userId, newStats) {
    const userStatsFile = path.join(userStatsDir, `${userId}/stats.json`);

    // Ensure the file exists before updating
    ensureUserStatsFile(userId);

    // Write updated stats back to the file
    fs.writeFileSync(userStatsFile, JSON.stringify(newStats, null, 4));
}

function updateLocation(locId, newLoc) {
    const locationData = path.join(locationsDir, `${locId}/data.json`);
    
    let newData = {};
    newData.doors = newLoc.doors;
    newData.storage = newLoc.storage;

    // Write updated stats back to the file
    fs.writeFileSync(locationData, JSON.stringify(newData, null, 4));
}

// Check if the user should level up
function checkLevelUp(userStats, message) {
    const baseXP = 100;
    const exponent = 1.5;
    const xpRequiredForNextLevel = Math.floor(baseXP * Math.pow(userStats.level, exponent));

    if (userStats.xp >= xpRequiredForNextLevel) {
        userStats.level += 1;
        userStats.hp = 100;
        userStats.hp = 100;
        userStats.xp = userStats.xp - xpRequiredForNextLevel; // Subtract the XP required for leveling up

        message.reply(`Congratulations! You leveled up! You are now level ${userStats.level}.\nXP Points: ${userStats.xp}/${xpRequiredForNextLevel}`);
    } else {
        message.reply(`Current Lvl:   ${userStats.level}\nXP Points:   ${userStats.xp}/${xpRequiredForNextLevel}`);
    }
}




client.login(token);
