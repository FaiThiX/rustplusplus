/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

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

const Config = require('../../config');

let hasPrintedProxyError = false;
let proxyCache = {
    url: null,
    options: null
};

function getRustPlusWebSocketOptions() {
    const proxyUrl = `${Config.general.socksProxyUrl || ''}`.trim();
    if (proxyUrl.length === 0) return null;

    if (proxyCache.url === proxyUrl) return proxyCache.options;

    try {
        const { SocksProxyAgent } = require('socks-proxy-agent');
        proxyCache.url = proxyUrl;
        proxyCache.options = {
            agent: new SocksProxyAgent(proxyUrl)
        };

        return proxyCache.options;
    }
    catch (e) {
        if (!hasPrintedProxyError) {
            hasPrintedProxyError = true;
            console.log(`[rustplusplus] Invalid RPP_SOCKS_PROXY_URL. Falling back to direct connection. (${e.message})`);
        }

        proxyCache.url = proxyUrl;
        proxyCache.options = null;
        return null;
    }
}

module.exports = {
    getRustPlusWebSocketOptions
};
