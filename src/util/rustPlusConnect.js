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

const protobuf = require("protobufjs");
const WebSocket = require('ws');

const RUSTPLUS_PROTO_PATH = require.resolve('@liamcottle/rustplus.js/rustplus.proto');

function connectRustPlusWebSocket(rustplus, webSocketOptions = null) {
    protobuf.load(RUSTPLUS_PROTO_PATH).then((root) => {
        if (rustplus.websocket) {
            rustplus.disconnect();
        }

        rustplus.AppRequest = root.lookupType("rustplus.AppRequest");
        rustplus.AppMessage = root.lookupType("rustplus.AppMessage");

        rustplus.emit('connecting');

        const address = rustplus.useFacepunchProxy ?
            `wss://companion-rust.facepunch.com/game/${rustplus.server}/${rustplus.port}` :
            `ws://${rustplus.server}:${rustplus.port}`;

        rustplus.websocket = webSocketOptions ? new WebSocket(address, webSocketOptions) :
            new WebSocket(address);

        rustplus.websocket.on('open', () => {
            rustplus.emit('connected');
        });

        rustplus.websocket.on('error', (e) => {
            rustplus.emit('error', e);
        });

        rustplus.websocket.on('message', (data) => {
            const message = rustplus.AppMessage.decode(data);

            if (message.response && message.response.seq && rustplus.seqCallbacks[message.response.seq]) {
                const callback = rustplus.seqCallbacks[message.response.seq];
                const result = callback(message);

                delete rustplus.seqCallbacks[message.response.seq];

                if (result) {
                    return;
                }
            }

            rustplus.emit('message', rustplus.AppMessage.decode(data));
        });

        rustplus.websocket.on('close', () => {
            rustplus.emit('disconnected');
        });
    });
}

module.exports = connectRustPlusWebSocket;
