import { DMChannel, GuildChannel, Message } from "discord.js";
export let DefaultErrorHandler = function (error, msg) {
    console.error(Date());
    if (msg instanceof Message) {
        let channelName = !(msg.channel instanceof GuildChannel) ?
            msg.channel instanceof DMChannel ?
                msg.channel.recipient :
                "Unknown Private Thread Channel" :
            msg.channel.name;
        console.error(`${msg.author.username} in ${(msg.guild ? (`${msg.guild.name} > ${channelName}`) : "DM")}: ${msg.cleanContent}`);
    }
    else if (msg) {
        console.error(msg);
    }
    console.error(error);
};
//# sourceMappingURL=ClientDefaults.js.map