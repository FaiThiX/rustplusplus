/*
    Copyright (C) 2024 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus

*/

import { Guild } from 'discord.js';

const { DiscordBot } = require('../structures/DiscordBot.js');
const DiscordTools = require('../discordTools/discordTools.js');

export async function removeGuildChannels(client: typeof DiscordBot, guild: Guild) {
    const guildId = guild.id;
    const instance = client.getInstance(guildId);

    let categoryId = null;
    for (const [channelName, channelId] of Object.entries(instance.channelIds)) {
        if (channelName === 'category') {
            categoryId = channelId;
            continue;
        }

        await DiscordTools.removeTextChannel(guildId, channelId);
        instance.channelIds[channelName] = null;
    }

    await DiscordTools.removeCategory(guildId, categoryId);
    instance.channelIds['category'] = null;

    client.setInstance(guildId, instance);
}