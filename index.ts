/*
    Copyright (C) 2025 Alexander Emanuelsson (alexemanuelol)

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

import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

import { createLogger } from './src/managers/loggerManager';
import { LocaleManager, Languages, isValidLanguage } from './src/managers/LocaleManager';
import { CredentialsManager } from './src/managers/credentialsManager';
import { GuildInstanceManager } from './src/managers/guildInstanceManager';
import { DiscordManager } from './src/managers/discordManager';
import { RustPlusManager } from './src/managers/rustPlusManager';
import { FcmListenerManager } from './src/managers/fcmListenerManager';

dotenv.config();

export const config = {
    general: {
        debug: process.env.RPP_DEBUG === 'true',
        language: isValidLanguage(process.env.RPP_LANGUAGE) ? process.env.RPP_LANGUAGE as Languages : Languages.ENGLISH,
        serverPollingHandlerIntervalMs: Number(process.env.RPP_SERVER_POLLING_HANDLER_INTERVAL_MS ?? '') || 10_000,
        showCallStackOnError: (process.env.RPP_SHOW_CALL_STACK_ON_ERROR === 'true') || false,
        reconnectIntervalMs: Number(process.env.RPP_RECONNECT_INTERVAL_MS ?? '') || 15_000
    },
    discord: {
        username: process.env.RPP_DISCORD_USERNAME || 'rustplusplus',
        clientId: process.env.RPP_DISCORD_CLIENT_ID ||
            (() => { throw new Error('RPP_DISCORD_CLIENT_ID is required.'); })(),
        token: process.env.RPP_DISCORD_TOKEN ||
            (() => { throw new Error('RPP_DISCORD_TOKEN is required.'); })(),
        useCache: process.env.RPP_USE_CACHE === 'true',
        enforceNameChange: process.env.RPP_ENFORCE_NAME_CHANGE === 'true',
        enforceAvatarChange: process.env.RPP_ENFORCE_AVATAR_CHANGE === 'true',
        enforceChannelPermissions: process.env.RPP_ENFORCE_CHANNEL_PERMISSIONS === 'true'
    }
}

export const log = createLogger(path.join(__dirname, 'logs', 'rustplusplus.log'));

function createMissingDirectories() {
    const directories = ['logs', 'guildInstances', 'credentials', 'maps'];

    directories.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    });
}
createMissingDirectories();

export const localeManager = new LocaleManager(config.general.language);
export const credentialsManager = new CredentialsManager(path.join(__dirname, 'credentials'));
export const guildInstanceManager = new GuildInstanceManager(
    path.join(__dirname, 'guildInstances'),
    path.join(__dirname, 'src', 'templates')
);

export const rustPlusManager = new RustPlusManager();
export const discordManager = new DiscordManager();
discordManager.build();

export const fcmListenerManager = new FcmListenerManager(discordManager);

process.on('unhandledRejection', error => {
    log.error(`[index.ts] Unhandled Rejection: ${error}`);
    console.log(error);
});