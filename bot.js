require('dotenv').config();
const Discord = require('discord.js');
const bot = new Discord.Client();
const { ConsoleTransportOptions, Console } = require('winston/lib/winston/transports');

const TOKEN = process.env.TOKEN;

bot.login(TOKEN);

var boosters = {};

const boost_create_state = {
    START: 'start',
    LOCATIONED: 'locationed',
    PRICED: 'priced',
    TIMED: 'timed',
    DURATIONED: 'durationed',
    DESCRIPTIONED: 'descriptioned',
    CHANNELLED: 'channelled'
};

function getBoostChannel(boost) {
    return bot.channels.cache.get(bot.channels.cache.find(channel => channel.type === 'text' && channel.name === boost.channel).id);
}

function getMessageFromReaction(boostMessageId, boost) {
    return getBoostChannel(boost).messages.cache.find(message => message.id === boostMessageId);
}

function getQueue(queue) {
    if (queue && queue.size > 0) {
        return Array.from(queue).join('\n');
    } else {
        return 'Empty';
    }
}

function getMessage(boost, username) {
    const exampleEmbed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(username + ' - ' + boost.location)
        .setDescription(boost.description)
        .addFields(
            { name: 'Start:', value: boost.start, inline: true },
            { name: 'Duration: ', value: boost.duration, inline: true },
            { name: 'Price: ', value: boost.price}
        )
        .addField('Queue:', getQueue(boost.queue), true)
        .setTimestamp()
        .setFooter('id: ' + boost.id);

    return exampleEmbed;
}

bot.on('ready', () => {
    console.info(`Logged in as ${bot.user.tag}!`);
    bot.user.setActivity("Direct Messages", {
        type: "WATCHING"
    });
});

const boost_start = '!boost start';
const boost_end = '!boost end';

bot.on('message', async message => {
    var user = message.author;
    if (message.content.startsWith(boost_start)) {
        message.delete();
        message.author.send('Where would you like to boost today?');
        var boostid = message.content.trim().length > boost_start.length ? message.content.substring(boost_start.length).trim() : Math.round(Math.random() * 100000);
        if (boosters[user] === undefined) {
            boosters[user] = {};
            boosters[user].name = user.username;
            boosters[user].boosts = {};
        }
        boosters[user].currentid = boostid;
        boosters[user].boosts[boostid] = { id: boostid, state: boost_create_state.START };
    } else if (message.content.startsWith(boost_end)) {
        message.delete();
        var boostid = message.content.trim().length > boost_start.length ? message.content.substring(boost_start.length - 1).trim() : undefined;
        if (boostid === undefined || boosters[user].boosts[boostid] === undefined) { message.author.send('You tried to end a boost, and the id provided was invalid'); return; }
        getMessageFromReaction(boosters[user].boosts[boostid].messageid, boosters[user].boosts[boostid]).delete();
        boosters[user].boosts[boostid] = undefined;
    } else if (!message.author.bot && message.channel.type === 'dm') {
        var currentBoost = boosters[user].boosts[boosters[user].currentid];
        switch(currentBoost.state) {
            case boost_create_state.START:
                currentBoost.location = message.content;
                currentBoost.state = boost_create_state.LOCATIONED;
                message.author.send('How much would you like to charge?');
                break;
            case boost_create_state.LOCATIONED:
                currentBoost.price = message.content;
                currentBoost.state = boost_create_state.PRICED;
                message.author.send('When would you like to start?');
                break;
            case boost_create_state.PRICED:
                currentBoost.start = message.content;
                currentBoost.state = boost_create_state.TIMED;
                message.author.send('How long would you like to boost for?')
                break;
            case boost_create_state.TIMED:
                currentBoost.duration = message.content;
                currentBoost.state = boost_create_state.DURATIONED;
                message.author.send('What description would you like?');
                break;
            case boost_create_state.DURATIONED:
                currentBoost.description = message.content;
                currentBoost.state = boost_create_state.DESCRIPTIONED
                message.author.send('What channel do you want this posted in?');
                break;
            case boost_create_state.DESCRIPTIONED:
                currentBoost.channel = message.content;
                currentBoost.state = boost_create_state.CHANNELLED;

                await message.author.send('Creating boost...')
                var boost_post = await getBoostChannel(currentBoost).send(getMessage(currentBoost, boosters[user].name));  
                await boost_post.react('😄')
                currentBoost.messageid = boost_post.id;
                await message.author.send('Boost created.');
                break;
        }
    }
});

bot.on('messageReactionAdd', (reaction, user) => {    
    if (user.bot) return;
    var booster = boosters[Object.keys(boosters).find((key, _) => Object.keys(boosters[key].boosts).find((keykey, _) => boosters[key].boosts[keykey].messageid === reaction.message.id))];
    var boost = booster.boosts[Object.keys(booster.boosts).find((keykey, _) => booster.boosts[keykey].messageid === reaction.message.id)];
    if (boost.queue === undefined) { boost.queue = new Set(); }
    boost.queue.add(user.username);
    getMessageFromReaction(reaction.message.id, boost).edit(getMessage(boost, booster.name));
});

bot.on('messageReactionRemove', (reaction, user) => {
    if (user.bot) return;
    var booster = boosters[Object.keys(boosters).find((key, _) => Object.keys(boosters[key].boosts).find((keykey, _) => boosters[key].boosts[keykey].messageid === reaction.message.id))];
    var boost = booster.boosts[Object.keys(booster.boosts).find((keykey, _) => booster.boosts[keykey].messageid === reaction.message.id)];
    if (boost.queue === undefined) { boost.queue = new Set(); }
    boost.queue.delete(user.username);
    getMessageFromReaction(reaction.message.id, boost).edit(getMessage(boost, booster.name));
});