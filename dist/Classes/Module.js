import { Events, ChatInputCommandInteraction, MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction, AutocompleteInteraction, Guild, User, GuildMember } from "discord.js";
import { ChironClient } from "./ChironClient";
import path from "path";
import { fileURLToPath } from "url";
function smiteLog(triggeringUserId, ModuleName, ComponentType, ComponentName) {
    const string = `${ModuleName} ${ComponentType} ${ComponentName} did not run because ${triggeringUserId} was hit by a divine smite`;
    console.log(string);
    return string;
}
/**
 * @classdesc The base class for all modules`
 * @class ChironModule
 * @implements {IChironModule}
 * @param {IChironModuleOptions} ModuleOptions - The options for the module
 * @param {string} ModuleOptions.name - The name of the module. It *MUST* be unique.
 * @param {Array<IBaseComponent>} ModuleOptions.components - The components of the module
 * @param {ChironClient} [ModuleOptions.client] - The client of the module
 * @param {string} [ModuleOptions.file] - The file the module is located in
 * @example
 *  import { ChironModule } from "chironbot"
 *  export default const module = new ChironModule({
 *    name: "Example Module",
 *    components: [
 *       new SlashCommandComponent({
 *          builder: new SlashCommandBuilder().setName("ping").setDescription("Pong!"),
 *          enabled: true,
 *          process: (interaction) => {
 *             interaction.isRepliable() ? interaction.reply("Pong!") : console.error("could not reply");
 *         }
 *    })
 * ]
 * })
 *
 *
 */
export class ChironModule {
    /**
     * The name of the module. Used for logging and debugging, and for tracking registered modules
     * @name ChironModule#name
     */
    name;
    components;
    client;
    file;
    constructor(ModuleOptions) {
        const __filename = fileURLToPath(import.meta.url);
        const fileName = path.basename(__filename);
        if (ModuleOptions.client instanceof ChironClient) {
            this.client = ModuleOptions.client;
        }
        this.file = __filename;
        this.name = ModuleOptions.name || fileName;
        this.components = ModuleOptions.components.map(component => {
            component.module = this;
            return component;
        });
    }
}
/* ------------------------------------------------------------------------------------------------------
 * ----------------- Component Classes ---------------------------------------------------------------
 */
//------------------- Base Component ------------------------------
// All components are derived from this
/**
 * @classdesc The base class for all components
 */
export class BaseComponent {
    enabled;
    bypassSmite;
    process;
    module;
    guildId;
    exec;
    constructor(BaseComponentOptions) {
        this.bypassSmite = BaseComponentOptions.bypassSmite || false;
        this.enabled = BaseComponentOptions.enabled;
        this.process = BaseComponentOptions.process;
        this.guildId = BaseComponentOptions.guildId;
        if (BaseComponentOptions.module)
            this.module = BaseComponentOptions.module;
        this.exec = this.process;
    }
}
//--------------------------------------------------------------------------
//------------------- Base Interact Component ------------------------------
// The base for all other Interaction Components
export class BaseInteractionComponent extends BaseComponent {
    name; //derived from the builder
    description; //derived from the builder if not directly defined
    builder; //Contains our name and description, and is the builder for our interaction;
    category;
    permissions; // a function that receives an interaction and returns if the function is allowed to be executed
    guildId;
    constructor(BaseInteractionComponentOptions) {
        super(BaseInteractionComponentOptions);
        this.name = BaseInteractionComponentOptions.builder.name;
        //description is implimented in child classes, we only impliment here as a fallback
        this.description = "";
        this.builder = BaseInteractionComponentOptions.builder;
        this.category = BaseInteractionComponentOptions.category || this.module?.file || "General";
        this.guildId = BaseInteractionComponentOptions.guildId;
        this.permissions = BaseInteractionComponentOptions.permissions;
        this.exec = (interaction) => {
            if (!interaction.isCommand() || interaction.commandName != this.name)
                return;
            if (this.guildId && !interaction.commandGuildId || interaction.commandGuildId != this.guildId)
                return;
            if (!this.enabled || !this.permissions(interaction)) {
                if (interaction.isRepliable())
                    interaction.reply({ content: "I'm sorry, but you aren't allowed to do that.", ephemeral: true });
                console.log("I'm sorry," + this.name + "is restricted behind a permissions lock");
                return "I'm sorry, This feature is restricted behind a permissions lock";
            }
            else if (!this.bypassSmite && this.module?.client instanceof ChironClient && this.module?.client.config.smiteArray.includes(interaction.user.id)) {
                if (interaction.isRepliable()) {
                    interaction.reply({ content: "This feature is unavailable to you.", ephemeral: true });
                    return smiteLog(interaction.user.id, this.module.name, "Interaction", this.name);
                }
                else
                    return "Nothing to be done";
            }
            else if (this.module?.client instanceof ChironClient)
                return this.process(interaction);
            else
                throw new Error("Invalid Client");
        };
    }
}
//--------------------------------------------------------------------------
//------------------- Slash Command Component ------------------------------
// Slash command Component
export class SlashCommandComponent extends BaseInteractionComponent {
    builder; //Contains our name and description, and is the builder for our interaction;
    constructor(SlashCommandComponentOptions) {
        super(SlashCommandComponentOptions);
        this.description = SlashCommandComponentOptions.description || SlashCommandComponentOptions.builder.description || "";
        this.builder = SlashCommandComponentOptions.builder;
    }
}
export class ContextMenuCommandComponent extends BaseInteractionComponent {
    builder; //Contains our name and description
    description;
    constructor(ContextMenuCommandComponentOptions) {
        super(ContextMenuCommandComponentOptions);
        this.description = ContextMenuCommandComponentOptions.description || "";
        this.builder = ContextMenuCommandComponentOptions.builder;
    }
}
//--------------------------------------------------------------------------
//event handler
export class EventComponent extends BaseComponent {
    bypassSmite;
    trigger;
    process;
    constructor(EventComponentOptions) {
        super(EventComponentOptions);
        this.trigger = EventComponentOptions.trigger;
        this.bypassSmite = EventComponentOptions.bypassSmite || false;
        this.process = EventComponentOptions.process;
        this.guildId = EventComponentOptions.guildId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.exec = ([arg1, arg2, arg3]) => {
            //Handle Guild limiting
            if (this.guildId) {
                //Try to find the guild id connected to the event if the event is limited to a specific guild
                const foundGuildId = (arg1 instanceof Guild) ? arg1.id :
                    (arg2 instanceof Guild) ? arg2.id :
                        (arg3 instanceof Guild) ? arg3.id :
                            arg1 ? (arg1?.guild?.id ||
                                arg1?.guildId ||
                                arg1?.first()?.guild.id ||
                                arg1?.message?.guildId ||
                                arg1?.first()?.guildMember?.guild.id) :
                                arg2 ? (arg2?.guildId ||
                                    arg2?.guild?.id ||
                                    arg2?.first()?.message.guildId) :
                                    arg3 ? (arg3?.guild?.id ||
                                        arg3?.guildId) :
                                        null;
                if (!foundGuildId || foundGuildId != this.guildId)
                    return;
            }
            //Find the User ID of the person who triggered the event, and check if they are smited,
            if (!this.bypassSmite && this.module?.client instanceof ChironClient && this.module?.client.config.smiteArray.length > 0) {
                const triggeringUser = (arg1 instanceof User || arg1 instanceof GuildMember) ? arg1.id :
                    (arg2 instanceof User || arg2 instanceof GuildMember) ? arg2.id :
                        (arg3 instanceof User || arg3 instanceof GuildMember) ? arg3.id :
                            arg1?.member?.id ||
                                arg1?.user?.id ||
                                arg1?.creatorId ||
                                arg1?.recipient?.id ||
                                arg1?.author?.id ||
                                arg1?.executor?.id ||
                                arg1?.user?.id ||
                                arg1?.creatorId ||
                                arg1?.inviter?.id ||
                                arg2?.member?.id ||
                                arg2?.user?.id ||
                                arg2?.creatorId ||
                                arg2?.recipient?.id ||
                                arg2?.author?.id ||
                                arg2?.creatorId ||
                                arg3?.member?.id ||
                                arg3?.user?.id ||
                                null;
                if (triggeringUser && this.module?.client.config.smiteArray.includes(triggeringUser)) {
                    return smiteLog(triggeringUser, this.module.name, this.trigger, "event");
                }
            }
            if (this.module?.client instanceof ChironClient)
                return this.process([arg1, arg2, arg3]);
            else
                throw new Error("Invalid Client");
        };
    }
}
//-------------------------------------------------------------------------
// Message Component interaction
export class MessageComponentInteractionComponent extends EventComponent {
    customId;
    process;
    permissions;
    trigger = Events.InteractionCreate;
    constructor(MessageComponentInteractionComponentOptions) {
        super(MessageComponentInteractionComponentOptions);
        this.permissions = MessageComponentInteractionComponentOptions.permissions || (() => true);
        this.trigger = Events.InteractionCreate;
        this.process = MessageComponentInteractionComponentOptions.process;
        this.customId = (string) => {
            if (typeof MessageComponentInteractionComponentOptions.customId == "function") {
                return MessageComponentInteractionComponentOptions.customId(string);
            }
            else {
                return string == MessageComponentInteractionComponentOptions.customId;
            }
        };
        this.exec = (interaction) => {
            if (!(this.module?.client instanceof ChironClient))
                throw new Error("Invalid Client");
            if (!(interaction instanceof (ChatInputCommandInteraction) ||
                interaction instanceof (MessageContextMenuCommandInteraction) ||
                interaction instanceof (UserContextMenuCommandInteraction) ||
                interaction instanceof (AutocompleteInteraction))) {
                if (!this.customId(interaction.customId))
                    return;
                const id = interaction?.member?.user.id || interaction?.user?.id;
                if (id) {
                    if (this.module?.client instanceof ChironClient && this.module?.client.config.smiteArray.includes(id)) {
                        interaction.reply({ ephemeral: true, content: "I'm sorry, I can't do that for you. (Response code SM173)" });
                        return "Smite System Blocked Event Triggered by " + id;
                    }
                    if (!this.permissions(interaction)) {
                        interaction.reply({ content: "You are not authorized to do that", ephemeral: true });
                    }
                }
                return this.process(interaction);
            }
        };
    }
}
//--------------------------------------------------------------------------
//------------------------ Schedule Components ----------------------------
export class ScheduleComponent extends BaseComponent {
    chronSchedule; //the number of seconds to wait between refresh intervals
    job;
    exec;
    constructor(ScheduleComponentOptions) {
        super(ScheduleComponentOptions);
        this.chronSchedule = ScheduleComponentOptions.chronSchedule;
        this.exec = (date) => {
            if (this.module?.client instanceof ChironClient)
                return this.process(date);
            else
                throw new Error("Invalid Client");
        };
    }
}
//-------------------------------------------------------------------------
//---------------- Module Loading and unloading components ----------------
export class ModuleOnLoadComponent extends BaseComponent {
}
export class ModuleOnUnloadComponent extends BaseComponent {
}
//-------------------------------------------------------------------------
//------------------ Message Command --------------------------------------
export class MessageCommandComponent extends EventComponent {
    name;
    description;
    category;
    trigger;
    permissions; // a function that receives an interaction and returns if the function is allowed to be executed
    process;
    bypassSmite = false;
    enabled = true;
    exec;
    constructor(MessageCommandOptions) {
        super(MessageCommandOptions);
        this.bypassSmite = MessageCommandOptions.bypassSmite || false;
        this.enabled = MessageCommandOptions.enabled || true;
        this.trigger = Events.MessageCreate;
        this.name = MessageCommandOptions.name;
        this.description = MessageCommandOptions.description;
        this.category = MessageCommandOptions.category || path.basename(__filename);
        this.permissions = MessageCommandOptions.permissions;
        this.process = MessageCommandOptions.process;
        this.exec = (message) => {
            if (!this.enabled)
                return "disabled";
            if (this.module?.client && this.module?.client instanceof ChironClient) {
                if (!this.bypassSmite && this.module.client.config.smiteArray.includes(message.author.id)) {
                    return smiteLog(message.author.id, this.module.name, this.trigger, this.name);
                }
                const parsed = this.module.client.parser(message, this.module.client);
                if (parsed && parsed.command == this.name) {
                    if (this.module?.client instanceof ChironClient)
                        return this.process(message, parsed.suffix);
                    else
                        throw new Error("Invalid Client");
                }
                else
                    return "Not a command";
            }
            else
                throw new Error("No Client found. Make sure your Client.modules.register() is after Client.login()");
        };
    }
}
//# sourceMappingURL=Module.js.map