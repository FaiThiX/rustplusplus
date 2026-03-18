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

const Constants = require('../util/constants.js');
const Map = require('../util/map.js');
const Timer = require('../util/timer');

class MapMarkers {
    constructor(mapMarkers, rustplus, client) {
        this._markers = mapMarkers.markers;

        this._rustplus = rustplus;
        this._client = client;

        this._types = {
            Player: 1,
            Explosion: 2,
            VendingMachine: 3,
            CH47: 4,
            CargoShip: 5,
            Crate: 6,
            GenericRadius: 7,
            PatrolHelicopter: 8,
            TravelingVendor: 9
        }

        this._players = [];
        this._vendingMachines = [];
        this._ch47s = [];
        this._cargoShips = [];
        this._genericRadiuses = [];
        this._patrolHelicopters = [];
        this._travelingVendors = [];
        this._deepSeas = [];

        /* Timers */
        this.cargoShipEgressTimers = new Object();
        this.cargoShipEgressAfterHarbor1Timers = new Object();
        this.cargoShipEgressAfterHarbor2Timers = new Object();
        this.cargoShipLockedCrateSpawnIntervals = new Object();
        this.cargoShipLockedCrateSpawnTimeouts = new Object();
        this.cargoShipLockedCrateNextSpawnTimes = new Object();
        this.cargoShipUndockingNotificationTimeouts = new Object();
        this.cargoShipUndockingNotificationEndTimes = new Object();
        this.crateSmallOilRigTimer = null;
        this.crateSmallOilRigLocation = null;
        this.crateLargeOilRigTimer = null;
        this.crateLargeOilRigLocation = null;
        this.deepSeaTimer = null;

        /* Event dates */
        this.timeSinceCargoShipWasOut = null;
        this.timeSinceCH47WasOut = null;
        this.timeSinceSmallOilRigWasTriggered = null;
        this.timeSinceLargeOilRigWasTriggered = null;
        this.timeSincePatrolHelicopterWasOnMap = null;
        this.timeSincePatrolHelicopterWasDestroyed = null;
        this.timeSinceTravelingVendorWasOnMap = null;
        this.timeSinceDeepSeaSpawned = null;
        this.timeSinceDeepSeaWasOnMap = null;

        /* Event location */
        this.patrolHelicopterDestroyedLocation = null;

        /* Vending Machine variables */
        this.knownVendingMachines = [];

        /* CargoShip meta data */
        this.cargoShipMetaData = new Object();

        /* DeepSea. */
        this.isDeepSeaActive = false;

        this.updateMapMarkers(mapMarkers);
    }

    /* Getters and Setters */
    get markers() { return this._markers; }
    set markers(markers) { this._markers = markers; }
    get rustplus() { return this._rustplus; }
    set rustplus(rustplus) { this._rustplus = rustplus; }
    get client() { return this._client; }
    set client(client) { this._client = client; }
    get types() { return this._types; }
    set types(types) { this._types = types; }
    get players() { return this._players; }
    set players(players) { this._players = players; }
    get vendingMachines() { return this._vendingMachines; }
    set vendingMachines(vendingMachines) { this._vendingMachines = vendingMachines; }
    get ch47s() { return this._ch47s; }
    set ch47s(ch47s) { this._ch47s = ch47s; }
    get cargoShips() { return this._cargoShips; }
    set cargoShips(cargoShips) { this._cargoShips = cargoShips; }
    get genericRadiuses() { return this._genericRadiuses; }
    set genericRadiuses(genericRadiuses) { this._genericRadiuses = genericRadiuses; }
    get patrolHelicopters() { return this._patrolHelicopters; }
    set patrolHelicopters(patrolHelicopters) { this._patrolHelicopters = patrolHelicopters; }
    get travelingVendors() { return this._travelingVendors; }
    set travelingVendors(travelingVendors) { this._travelingVendors = travelingVendors; }
    get deepSeas() { return this._deepSeas; }
    set deepSeas(deepSeas) { this._deepSeas = deepSeas; }

    getType(type) {
        if (!Object.values(this.types).includes(type)) {
            return null;
        }

        switch (type) {
            case this.types.Player: {
                return this.players;
            } break;

            case this.types.VendingMachine: {
                return this.vendingMachines;
            } break;

            case this.types.CH47: {
                return this.ch47s;
            } break;

            case this.types.CargoShip: {
                return this.cargoShips;
            } break;

            case this.types.GenericRadius: {
                return this.genericRadiuses;
            } break;

            case this.types.PatrolHelicopter: {
                return this.patrolHelicopters;
            } break;

            case this.types.TravelingVendor: {
                return this.travelingVendors;
            } break;

            default: {
                return null;
            } break;
        }
    }

    getMarkersOfType(type, markers) {
        if (!Object.values(this.types).includes(type)) {
            return [];
        }

        let markersOfType = [];
        for (let marker of markers) {
            if (marker.type === type) {
                markersOfType.push(marker);
            }
        }

        return markersOfType;
    }

    getMarkerByTypeId(type, id) {
        return this.getType(type).find(e => e.id === id);
    }

    getMarkerByTypeXY(type, x, y) {
        return this.getType(type).find(e => e.x === x && e.y === y);
    }

    isMarkerPresentByTypeId(type, id, markers = null) {
        if (markers) {
            return markers.some(e => e.id === id);
        }
        else {
            return this.getType(type).some(e => e.id === id);
        }
    }

    getNewMarkersOfTypeId(type, markers) {
        let newMarkersOfType = [];

        for (let marker of this.getMarkersOfType(type, markers)) {
            if (!this.isMarkerPresentByTypeId(type, marker.id)) {
                newMarkersOfType.push(marker);
            }
        }

        return newMarkersOfType
    }

    getLeftMarkersOfTypeId(type, markers) {
        let leftMarkersOfType = this.getType(type).slice();

        for (let marker of this.getMarkersOfType(type, markers)) {
            if (this.isMarkerPresentByTypeId(type, marker.id)) {
                leftMarkersOfType = leftMarkersOfType.filter(e => e.id !== marker.id);
            }
        }

        return leftMarkersOfType;
    }

    getRemainingMarkersOfTypeId(type, markers) {
        let remainingMarkersOfType = [];

        for (let marker of markers) {
            if (this.isMarkerPresentByTypeId(type, marker.id)) {
                remainingMarkersOfType.push(marker);
            }
        }

        return remainingMarkersOfType;
    }

    isMarkerPresentByTypeXY(type, x, y, markers = null) {
        if (markers) {
            return markers.some(e => e.x === x && e.y === y);
        }
        else {
            return this.getType(type).some(e => e.x === x && e.y === y);
        }
    }

    getNewMarkersOfTypeXY(type, markers) {
        let newMarkersOfType = [];

        for (let marker of this.getMarkersOfType(type, markers)) {
            if (!this.isMarkerPresentByTypeXY(type, marker.x, marker.y)) {
                newMarkersOfType.push(marker);
            }
        }

        return newMarkersOfType;
    }

    getLeftMarkersOfTypeXY(type, markers) {
        let leftMarkersOfType = this.getType(type).slice();

        for (let marker of this.getMarkersOfType(type, markers)) {
            if (this.isMarkerPresentByTypeXY(type, marker.x, marker.y)) {
                leftMarkersOfType = leftMarkersOfType.filter(e => e.x !== marker.x || e.y !== marker.y);
            }
        }

        return leftMarkersOfType;
    }

    getRemainingMarkersOfTypeXY(type, markers) {
        let remainingMarkersOfType = [];

        for (let marker of markers) {
            if (this.isMarkerPresentByTypeXY(type, marker.x, marker.y)) {
                remainingMarkersOfType.push(marker);
            }
        }

        return remainingMarkersOfType;
    }

    getCargoShipMetaData(id) {
        if (!this.cargoShipMetaData[id]) {
            this.cargoShipMetaData[id] = {
                lockedCrateSpawnCounter: 0,
                harborsDocked: [],
                dockingStatus: null,
                isLeaving: false,
                prevPoint: null,
                isDepartureCertain: true
            };
        }

        return this.cargoShipMetaData[id];
    }

    getCargoHarbors() {
        if (!this.rustplus?.map?.monuments) {
            return [];
        }

        return this.rustplus.map.monuments.filter(monument => /harbor/.test(monument.token));
    }

    getClosestCargoHarbor(x, y, harbors = null) {
        const harborList = harbors ?? this.getCargoHarbors();
        let closestHarbor = null;
        let minDistance = Number.POSITIVE_INFINITY;

        for (const harbor of harborList) {
            const distance = Map.getDistance(x, y, harbor.x, harbor.y);
            if (distance < minDistance) {
                minDistance = distance;
                closestHarbor = harbor;
            }
        }

        return closestHarbor;
    }

    stopCargoShipTimer(timerCollection, id) {
        if (timerCollection[id]) {
            timerCollection[id].stop();
            delete timerCollection[id];
        }
    }

    clearCargoShipLockedCrateSpawnScheduler(id) {
        if (this.cargoShipLockedCrateSpawnIntervals[id]) {
            clearInterval(this.cargoShipLockedCrateSpawnIntervals[id]);
            delete this.cargoShipLockedCrateSpawnIntervals[id];
        }

        if (this.cargoShipLockedCrateSpawnTimeouts[id]) {
            clearTimeout(this.cargoShipLockedCrateSpawnTimeouts[id]);
            delete this.cargoShipLockedCrateSpawnTimeouts[id];
        }

        delete this.cargoShipLockedCrateNextSpawnTimes[id];
    }

    scheduleCargoShipLockedCrateSpawnTimeout(id, delayMs) {
        if (!this.cargoShipMetaData[id] ||
            this.cargoShipMetaData[id].lockedCrateSpawnCounter >= Constants.CARGO_SHIP_LOOT_ROUNDS) {
            this.clearCargoShipLockedCrateSpawnScheduler(id);
            return;
        }

        if (this.cargoShipLockedCrateSpawnTimeouts[id]) {
            clearTimeout(this.cargoShipLockedCrateSpawnTimeouts[id]);
            delete this.cargoShipLockedCrateSpawnTimeouts[id];
        }

        if (delayMs <= 0) {
            this.notifyCargoShipLockedCrateSpawn(id);

            if (this.cargoShipMetaData[id] &&
                this.cargoShipMetaData[id].lockedCrateSpawnCounter < Constants.CARGO_SHIP_LOOT_ROUNDS &&
                !this.cargoShipLockedCrateSpawnIntervals[id]) {
                this.cargoShipLockedCrateNextSpawnTimes[id] =
                    Date.now() + Constants.CARGO_SHIP_LOOT_ROUNDS_SPACING_MS;
                this.cargoShipLockedCrateSpawnIntervals[id] = setInterval(() => {
                    this.notifyCargoShipLockedCrateSpawn(id);
                }, Constants.CARGO_SHIP_LOOT_ROUNDS_SPACING_MS);
            }
            return;
        }

        this.cargoShipLockedCrateNextSpawnTimes[id] = Date.now() + delayMs;
        this.cargoShipLockedCrateSpawnTimeouts[id] = setTimeout(() => {
            delete this.cargoShipLockedCrateSpawnTimeouts[id];

            if (!this.cargoShipMetaData[id]) {
                delete this.cargoShipLockedCrateNextSpawnTimes[id];
                return;
            }

            this.notifyCargoShipLockedCrateSpawn(id);

            if (this.cargoShipMetaData[id] &&
                this.cargoShipMetaData[id].lockedCrateSpawnCounter < Constants.CARGO_SHIP_LOOT_ROUNDS) {
                this.cargoShipLockedCrateNextSpawnTimes[id] =
                    Date.now() + Constants.CARGO_SHIP_LOOT_ROUNDS_SPACING_MS;
                this.cargoShipLockedCrateSpawnIntervals[id] = setInterval(() => {
                    this.notifyCargoShipLockedCrateSpawn(id);
                }, Constants.CARGO_SHIP_LOOT_ROUNDS_SPACING_MS);
            }
        }, delayMs);
    }




    /* Update event map markers */

    updateMapMarkers(mapMarkers) {
        this.updatePlayers(mapMarkers);
        this.updateCargoShips(mapMarkers);
        this.updatePatrolHelicopters(mapMarkers);
        this.updateCH47s(mapMarkers);
        this.updateVendingMachines(mapMarkers);
        this.updateGenericRadiuses(mapMarkers);
        this.updateTravelingVendors(mapMarkers);

        if (this.rustplus &&
            this.rustplus.persistentRuntimeStateRestored &&
            typeof (this.rustplus.persistMapMarkersRuntimeState) === 'function') {
            this.rustplus.persistMapMarkersRuntimeState();
        }
    }

    updatePlayers(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeId(this.types.Player, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeId(this.types.Player, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.Player, mapMarkers.markers);

        /* Player markers that are new. */
        for (let marker of newMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            marker.location = pos;

            this.players.push(marker);
        }

        /* Player markers that have left. */
        for (let marker of leftMarkers) {
            this.players = this.players.filter(e => e.id !== marker.id);
        }

        /* Player markers that still remains. */
        for (let marker of remainingMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            let player = this.getMarkerByTypeId(this.types.Player, marker.id);

            player.x = marker.x;
            player.y = marker.y;
            player.location = pos;
        }
    }

    updateVendingMachines(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeXY(this.types.VendingMachine, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeXY(this.types.VendingMachine, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeXY(this.types.VendingMachine, mapMarkers.markers);

        /* VendingMachine markers that are new. */
        for (let marker of newMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            marker.location = pos;

            if (!this.rustplus.isFirstPoll && !Map.isOutsideGridSystem(marker.x, marker.y, mapSize, 4 * Map.gridDiameter)) {
                if (!this.knownVendingMachines.some(e => e.x === marker.x && e.y === marker.y)) {
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.vendingMachineDetectedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'newVendingMachine', { location: pos.string }),
                        null,
                        Constants.COLOR_NEW_VENDING_MACHINE);
                }
            }

            this.knownVendingMachines.push({ x: marker.x, y: marker.y });
            this.vendingMachines.push(marker);
        }

        /* VendingMachine markers that have left. */
        for (let marker of leftMarkers) {
            this.vendingMachines = this.vendingMachines.filter(e => e.x !== marker.x || e.y !== marker.y);
        }

        /* VendingMachine markers that still remains. */
        for (let marker of remainingMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            let vendingMachine = this.getMarkerByTypeXY(this.types.VendingMachine, marker.x, marker.y);

            vendingMachine.id = marker.id;
            vendingMachine.location = pos;
            vendingMachine.sellOrders = marker.sellOrders;
        }

        let mapSize = this.rustplus.info.correctedMapSize;
        let deepSeaMarkers = this.vendingMachines.filter(marker =>
            Map.isOutsideGridSystem(marker.x, marker.y, mapSize, 4 * Map.gridDiameter));

        if (deepSeaMarkers.length > 0) {
            if (!this.isDeepSeaActive) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.deepSeaDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'deepSeaDetected'),
                    'deepSea',
                    Constants.COLOR_DEEP_SEA_DETECTED);
                if (this.timeSinceDeepSeaSpawned === null) {
                    this.timeSinceDeepSeaSpawned = new Date();
                }
                this.timeSinceDeepSeaWasOnMap = null;
                this.isDeepSeaActive = true;
            }

            this.deepSeas = deepSeaMarkers.slice();
        }
        else {
            if (this.isDeepSeaActive) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.deepSeaLeftMapSetting,
                    this.client.intlGet(this.rustplus.guildId, 'deepSeaLeftMap'),
                    'deepSea',
                    Constants.COLOR_DEEP_SEA_LEFT_MAP);
                this.isDeepSeaActive = false;
                this.timeSinceDeepSeaWasOnMap = new Date();
                this.timeSinceDeepSeaSpawned = null;
            }

            this.deepSeas = [];
        }
    }

    updateCH47s(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeId(this.types.CH47, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeId(this.types.CH47, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.CH47, mapMarkers.markers);

        /* CH47 markers that are new. */
        for (let marker of newMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            marker.location = pos;

            let smallOilRig = [], largeOilRig = [];
            for (let monument of this.rustplus.map.monuments) {
                if (monument.token === 'oil_rig_small') {
                    smallOilRig.push({ x: monument.x, y: monument.y })
                }
                else if (monument.token === 'large_oil_rig') {
                    largeOilRig.push({ x: monument.x, y: monument.y })
                }
            }

            let found = false;
            if (!this.rustplus.isFirstPoll) {
                for (let oilRig of smallOilRig) {
                    if (Map.getDistance(marker.x, marker.y, oilRig.x, oilRig.y) <=
                        Constants.OIL_RIG_CHINOOK_47_MAX_SPAWN_DISTANCE) {
                        found = true;
                        let oilRigLocation = Map.getPos(oilRig.x, oilRig.y, mapSize, this.rustplus);
                        marker.ch47Type = 'smallOilRig';

                        this.rustplus.sendEvent(
                            this.rustplus.notificationSettings.heavyScientistCalledSetting,
                            this.client.intlGet(this.rustplus.guildId, 'heavyScientistsCalledSmall',
                                { location: oilRigLocation.location }),
                            'small',
                            Constants.COLOR_HEAVY_SCIENTISTS_CALLED_SMALL,
                            this.rustplus.isFirstPoll,
                            'small_oil_rig_logo.png');

                        if (this.crateSmallOilRigTimer) {
                            this.crateSmallOilRigTimer.stop();
                        }

                        let instance = this.client.getInstance(this.rustplus.guildId);
                        this.crateSmallOilRigTimer = new Timer.timer(
                            this.notifyCrateSmallOilRigOpen.bind(this),
                            instance.serverList[this.rustplus.serverId].oilRigLockedCrateUnlockTimeMs,
                            oilRigLocation.location);
                        this.crateSmallOilRigTimer.start();

                        this.crateSmallOilRigLocation = oilRigLocation.location;
                        this.timeSinceSmallOilRigWasTriggered = new Date();
                        break;
                    }
                }
            }

            if (!found && !this.rustplus.isFirstPoll) {
                for (let oilRig of largeOilRig) {
                    if (Map.getDistance(marker.x, marker.y, oilRig.x, oilRig.y) <=
                        Constants.OIL_RIG_CHINOOK_47_MAX_SPAWN_DISTANCE) {
                        found = true;
                        let oilRigLocation = Map.getPos(oilRig.x, oilRig.y, mapSize, this.rustplus);
                        marker.ch47Type = 'largeOilRig';

                        this.rustplus.sendEvent(
                            this.rustplus.notificationSettings.heavyScientistCalledSetting,
                            this.client.intlGet(this.rustplus.guildId, 'heavyScientistsCalledLarge',
                                { location: oilRigLocation.location }),
                            'large',
                            Constants.COLOR_HEAVY_SCIENTISTS_CALLED_LARGE,
                            this.rustplus.isFirstPoll,
                            'large_oil_rig_logo.png');

                        if (this.crateLargeOilRigTimer) {
                            this.crateLargeOilRigTimer.stop();
                        }

                        let instance = this.client.getInstance(this.rustplus.guildId);
                        this.crateLargeOilRigTimer = new Timer.timer(
                            this.notifyCrateLargeOilRigOpen.bind(this),
                            instance.serverList[this.rustplus.serverId].oilRigLockedCrateUnlockTimeMs,
                            oilRigLocation.location);
                        this.crateLargeOilRigTimer.start();

                        this.crateLargeOilRigLocation = oilRigLocation.location;
                        this.timeSinceLargeOilRigWasTriggered = new Date();
                        break;
                    }
                }
            }

            if (!found) {
                /* Offset that is used to determine if CH47 just spawned */
                let offset = 4 * Map.gridDiameter;

                /* If CH47 is located outside the grid system + the offset */
                if (Map.isOutsideGridSystem(marker.x, marker.y, mapSize, offset)) {
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.chinook47DetectedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'chinook47EntersMap', { location: pos.string }),
                        'chinook',
                        Constants.COLOR_CHINOOK47_ENTERS_MAP);
                }
                else {
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.chinook47DetectedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'chinook47Located', { location: pos.string }),
                        'chinook',
                        Constants.COLOR_CHINOOK47_LOCATED);
                }
                marker.ch47Type = 'crate';
            }

            this.ch47s.push(marker);
        }

        /* CH47 markers that have left. */
        for (let marker of leftMarkers) {
            if (marker.ch47Type === 'crate') {
                this.timeSinceCH47WasOut = new Date();
                this.rustplus.log(this.client.intlGet(null, 'eventCap'),
                    this.client.intlGet(null, 'chinook47LeftMap', { location: marker.location.string }));
            }

            this.ch47s = this.ch47s.filter(e => e.id !== marker.id);
        }

        /* CH47 markers that still remains. */
        for (let marker of remainingMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            let ch47 = this.getMarkerByTypeId(this.types.CH47, marker.id);

            ch47.x = marker.x;
            ch47.y = marker.y;
            ch47.location = pos;
        }
    }

    updateCargoShips(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeId(this.types.CargoShip, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeId(this.types.CargoShip, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.CargoShip, mapMarkers.markers);
        let mapSize = this.rustplus.info.correctedMapSize;
        let numberOfGrids = Math.max(1, Math.floor(mapSize / Map.gridDiameter));
        let gridDiameter = mapSize / numberOfGrids;
        let harbors = this.getCargoHarbors();
        let harborCount = harbors.length;
        let instance = this.client.getInstance(this.rustplus.guildId);

        /* CargoShip markers that are new. */
        for (let marker of newMarkers) {
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            let offset = 4 * gridDiameter;
            let isOutside = Map.isOutsideGridSystem(marker.x, marker.y, mapSize, offset);

            this.rustplus.cargoShipTracers[marker.id] = [{ x: marker.x, y: marker.y }];
            this.cargoShipMetaData[marker.id] = {
                lockedCrateSpawnCounter: 0,
                harborsDocked: [],
                dockingStatus: null,
                isLeaving: false,
                prevPoint: null,
                isDepartureCertain: true
            };

            marker.location = pos;
            marker.onItsWayOut = false;

            if (isOutside) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.cargoShipDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'cargoShipEntersMap', { location: pos.string }),
                    'cargo',
                    Constants.COLOR_CARGO_SHIP_ENTERS_MAP);
            }
            else {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.cargoShipDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'cargoShipLocated', { location: pos.string }),
                    'cargo',
                    Constants.COLOR_CARGO_SHIP_LOCATED);
            }

            this.cargoShips.push(marker);

            if (!this.rustplus.isFirstPoll) {
                this.cargoShipEgressTimers[marker.id] = new Timer.timer(
                    this.notifyCargoShipEgress.bind(this),
                    instance.serverList[this.rustplus.serverId].cargoShipEgressTimeMs,
                    marker.id);
                this.cargoShipEgressTimers[marker.id].start();

                this.notifyCargoShipLockedCrateSpawn(marker.id);
                if (this.cargoShipMetaData[marker.id].lockedCrateSpawnCounter <
                    Constants.CARGO_SHIP_LOOT_ROUNDS) {
                    this.cargoShipLockedCrateNextSpawnTimes[marker.id] =
                        Date.now() + Constants.CARGO_SHIP_LOOT_ROUNDS_SPACING_MS;
                    this.cargoShipLockedCrateSpawnIntervals[marker.id] = setInterval(() => {
                        this.notifyCargoShipLockedCrateSpawn(marker.id);
                    }, Constants.CARGO_SHIP_LOOT_ROUNDS_SPACING_MS);
                }
            }
        }

        /* CargoShip markers that have left. */
        for (let marker of leftMarkers) {
            let cargoShip = this.getMarkerByTypeId(this.types.CargoShip, marker.id) ?? marker;

            this.rustplus.sendEvent(
                this.rustplus.notificationSettings.cargoShipLeftSetting,
                this.client.intlGet(this.rustplus.guildId, 'cargoShipLeftMap', { location: cargoShip.location.string }),
                'cargo',
                Constants.COLOR_CARGO_SHIP_LEFT_MAP);

            this.stopCargoShipTimer(this.cargoShipEgressTimers, marker.id);
            this.stopCargoShipTimer(this.cargoShipEgressAfterHarbor1Timers, marker.id);
            this.stopCargoShipTimer(this.cargoShipEgressAfterHarbor2Timers, marker.id);
            this.clearCargoShipLockedCrateSpawnScheduler(marker.id);
            if (this.cargoShipUndockingNotificationTimeouts[marker.id]) {
                clearTimeout(this.cargoShipUndockingNotificationTimeouts[marker.id]);
                delete this.cargoShipUndockingNotificationTimeouts[marker.id];
            }
            delete this.cargoShipUndockingNotificationEndTimes[marker.id];

            this.timeSinceCargoShipWasOut = new Date();

            delete this.cargoShipMetaData[marker.id];
            this.cargoShips = this.cargoShips.filter(e => e.id !== marker.id);
            delete this.rustplus.cargoShipTracers[marker.id];
        }

        /* CargoShip markers that still remains. */
        for (let marker of remainingMarkers) {
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            let cargoShip = this.getMarkerByTypeId(this.types.CargoShip, marker.id);
            let cargoShipMeta = this.getCargoShipMetaData(marker.id);
            let closestHarbor = this.getClosestCargoHarbor(marker.x, marker.y, harbors);
            let prevPoint = cargoShipMeta.prevPoint;
            let isSameDir = prevPoint && Map.isSameDirection(prevPoint, {
                x: cargoShip.x,
                y: cargoShip.y
            }, {
                x: marker.x,
                y: marker.y
            });
            let hasEgressTimer = Object.prototype.hasOwnProperty.call(this.cargoShipEgressTimers, marker.id);
            let isOutside = Map.isOutsideGridSystem(marker.x, marker.y, mapSize, 4 * gridDiameter);
            let isLeaving = cargoShipMeta.isLeaving;

            if (!this.rustplus.cargoShipTracers[marker.id]) {
                this.rustplus.cargoShipTracers[marker.id] = [];
            }
            this.rustplus.cargoShipTracers[marker.id].push({ x: marker.x, y: marker.y });

            if (closestHarbor) {
                let prevDist = Map.getDistance(cargoShip.x, cargoShip.y, closestHarbor.x, closestHarbor.y);
                let currDist = Map.getDistance(marker.x, marker.y, closestHarbor.x, closestHarbor.y);
                let harborAlreadyDocked = cargoShipMeta.harborsDocked.some(e =>
                    e.x === closestHarbor.x && e.y === closestHarbor.y);
                let hasDockingStatus = cargoShipMeta.dockingStatus !== null;
                let allHarborsDocked = harborCount === 0 || cargoShipMeta.harborsDocked.length === harborCount;
                let isStandingStill = cargoShip.x === marker.x && cargoShip.y === marker.y;
                let harborLocation = Map.getPos(closestHarbor.x, closestHarbor.y, mapSize, this.rustplus);
                let harborName = harborLocation.monument ?? harborLocation.location;
                let harborGrid = Map.getGridPos(closestHarbor.x, closestHarbor.y, mapSize) ?? harborLocation.location;

                let startHarborApproach =
                    prevDist > Constants.CARGO_SHIP_HARBOR_DOCKING_DISTANCE &&
                    currDist <= Constants.CARGO_SHIP_HARBOR_DOCKING_DISTANCE &&
                    !hasDockingStatus && !harborAlreadyDocked && !allHarborsDocked;

                let justDocked =
                    currDist <= Constants.CARGO_SHIP_HARBOR_DOCKING_DISTANCE &&
                    ((hasDockingStatus && cargoShipMeta.dockingStatus === 'docking' && isStandingStill) ||
                        (!hasDockingStatus && isStandingStill));

                let startHarborDeparture =
                    hasDockingStatus && cargoShipMeta.dockingStatus === 'docked' && !isStandingStill;

                let justUndocked =
                    prevDist < Constants.CARGO_SHIP_HARBOR_UNDOCKED_DISTANCE &&
                    currDist >= Constants.CARGO_SHIP_HARBOR_UNDOCKED_DISTANCE &&
                    hasDockingStatus &&
                    (cargoShipMeta.dockingStatus === 'docking' || cargoShipMeta.dockingStatus === 'undocking');

                let abortFalseHarborApproach =
                    hasDockingStatus &&
                    cargoShipMeta.dockingStatus === 'docking' &&
                    !isStandingStill &&
                    currDist > Constants.CARGO_SHIP_HARBOR_DOCKING_DISTANCE &&
                    currDist >= prevDist;

                if (startHarborApproach) {
                    cargoShipMeta.dockingStatus = 'docking';

                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.cargoShipDockingSetting,
                        this.client.intlGet(this.rustplus.guildId, 'cargoShipDocking', {
                            location: harborName,
                            grid: harborGrid
                        }),
                        'cargo',
                        Constants.COLOR_CARGO_SHIP_DOCKED);
                }
                else if (justDocked) {
                    cargoShipMeta.dockingStatus = 'docked';
                    if (!harborAlreadyDocked) {
                        cargoShipMeta.harborsDocked.push({ x: closestHarbor.x, y: closestHarbor.y });
                    }

                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.cargoShipDockedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'cargoShipDocked', {
                            location: harborName,
                            grid: harborGrid
                        }),
                        'cargo',
                        Constants.COLOR_CARGO_SHIP_DOCKED);

                    if (this.cargoShipUndockingNotificationTimeouts[marker.id]) {
                        clearTimeout(this.cargoShipUndockingNotificationTimeouts[marker.id]);
                    }
                    this.cargoShipUndockingNotificationEndTimes[marker.id] =
                        Date.now() + Constants.CARGO_SHIP_HARBOR_DOCKING_TIME_MS -
                        (60 * 1000 + 10 * 1000);
                    this.cargoShipUndockingNotificationTimeouts[marker.id] = setTimeout(
                        this.notifyCargoShipUndockingSoon.bind(this, marker.id, mapSize),
                        Constants.CARGO_SHIP_HARBOR_DOCKING_TIME_MS - (60 * 1000 + 10 * 1000)
                    );
                }
                else if (startHarborDeparture) {
                    cargoShipMeta.dockingStatus = 'undocking';

                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.cargoShipUndockingSetting,
                        this.client.intlGet(this.rustplus.guildId, 'cargoShipUndocking', {
                            location: harborName,
                            grid: harborGrid
                        }),
                        'cargo',
                        Constants.COLOR_CARGO_SHIP_DOCKED);

                    if (this.cargoShipUndockingNotificationTimeouts[marker.id]) {
                        clearTimeout(this.cargoShipUndockingNotificationTimeouts[marker.id]);
                        delete this.cargoShipUndockingNotificationTimeouts[marker.id];
                    }
                    delete this.cargoShipUndockingNotificationEndTimes[marker.id];
                }
                else if (justUndocked) {
                    if (Object.prototype.hasOwnProperty.call(this.cargoShipEgressTimers, marker.id) &&
                        allHarborsDocked &&
                        cargoShipMeta.dockingStatus === 'undocking') {
                        let timeLeftMs = this.cargoShipEgressTimers[marker.id].getTimeLeft();
                        let cargoLocation = pos.string;

                        if (timeLeftMs < Constants.CARGO_SHIP_LEAVE_AFTER_HARBOR_NO_CRATES_MS) {
                            this.stopCargoShipTimer(this.cargoShipEgressTimers, marker.id);
                            this.cargoShipEgressAfterHarbor1Timers[marker.id] = new Timer.timer(
                                this.notifyCargoShipEgressAfterHarbor.bind(this, marker.id, true),
                                Constants.CARGO_SHIP_LEAVE_AFTER_HARBOR_NO_CRATES_MS
                            );
                            this.cargoShipEgressAfterHarbor1Timers[marker.id].start();
                        }

                        if (timeLeftMs < Constants.CARGO_SHIP_LEAVE_AFTER_HARBOR_NO_CRATES_MS ||
                            (timeLeftMs >= Constants.CARGO_SHIP_LEAVE_AFTER_HARBOR_NO_CRATES_MS &&
                                timeLeftMs < Constants.CARGO_SHIP_LEAVE_AFTER_HARBOR_WITH_CRATES_MS)) {
                            this.stopCargoShipTimer(this.cargoShipEgressAfterHarbor2Timers, marker.id);
                            this.cargoShipEgressAfterHarbor2Timers[marker.id] = new Timer.timer(
                                this.notifyCargoShipEgressAfterHarbor.bind(this, marker.id, false),
                                Constants.CARGO_SHIP_LEAVE_AFTER_HARBOR_WITH_CRATES_MS
                            );
                            this.cargoShipEgressAfterHarbor2Timers[marker.id].start();
                            cargoShipMeta.isDepartureCertain = false;
                        }

                        let timeLeftMin = (timeLeftMs / (60 * 1000)).toFixed(1);

                        if (timeLeftMs < Constants.CARGO_SHIP_LEAVE_AFTER_HARBOR_NO_CRATES_MS) {
                            this.rustplus.sendEvent(
                                this.rustplus.notificationSettings.cargoShipLeavingSetting,
                                this.client.intlGet(this.rustplus.guildId, 'cargoShipLeavingSoon', {
                                    location: cargoLocation,
                                    first: '2',
                                    second: '19.5'
                                }),
                                'cargo',
                                Constants.COLOR_CARGO_SHIP_ENTERS_EGRESS_STAGE);
                        }
                        else if (timeLeftMs < Constants.CARGO_SHIP_LEAVE_AFTER_HARBOR_WITH_CRATES_MS) {
                            this.rustplus.sendEvent(
                                this.rustplus.notificationSettings.cargoShipLeavingSetting,
                                this.client.intlGet(this.rustplus.guildId, 'cargoShipLeavingSoon', {
                                    location: cargoLocation,
                                    first: `${timeLeftMin}`,
                                    second: '19.5'
                                }),
                                'cargo',
                                Constants.COLOR_CARGO_SHIP_ENTERS_EGRESS_STAGE);
                        }
                        else {
                            this.rustplus.sendEvent(
                                this.rustplus.notificationSettings.cargoShipLeavingSetting,
                                this.client.intlGet(this.rustplus.guildId, 'cargoShipLeavingInTime', {
                                    location: cargoLocation,
                                    min: `${timeLeftMin}`
                                }),
                                'cargo',
                                Constants.COLOR_CARGO_SHIP_ENTERS_EGRESS_STAGE);
                        }
                    }

                    cargoShipMeta.dockingStatus = null;
                }
                else if (abortFalseHarborApproach) {
                    cargoShipMeta.dockingStatus = null;
                }
            }

            if (!isLeaving && isSameDir && !hasEgressTimer && isOutside) {
                cargoShipMeta.isLeaving = true;
                cargoShip.onItsWayOut = true;

                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.cargoShipLeavingSetting,
                    this.client.intlGet(this.rustplus.guildId, 'cargoShipLeaving', {
                        location: pos.string
                    }),
                    'cargo',
                    Constants.COLOR_CARGO_SHIP_ENTERS_EGRESS_STAGE);
            }

            cargoShipMeta.prevPoint = { x: cargoShip.x, y: cargoShip.y };
            cargoShip.x = marker.x;
            cargoShip.y = marker.y;
            cargoShip.location = pos;
            cargoShip.onItsWayOut = cargoShipMeta.isLeaving;
        }
    }

    updateGenericRadiuses(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeId(this.types.GenericRadius, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeId(this.types.GenericRadius, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.GenericRadius, mapMarkers.markers);

        /* GenericRadius markers that are new. */
        for (let marker of newMarkers) {
            this.genericRadiuses.push(marker);
        }

        /* GenericRadius markers that have left. */
        for (let marker of leftMarkers) {
            this.genericRadiuses = this.genericRadiuses.filter(e => e.id !== marker.id);
        }

        /* GenericRadius markers that still remains. */
        for (let marker of remainingMarkers) {
            let genericRadius = this.getMarkerByTypeId(this.types.GenericRadius, marker.id);

            genericRadius.x = marker.x;
            genericRadius.y = marker.y;
        }
    }

    updatePatrolHelicopters(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeId(this.types.PatrolHelicopter, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeId(this.types.PatrolHelicopter, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.PatrolHelicopter, mapMarkers.markers);

        /* PatrolHelicopter markers that are new. */
        for (let marker of newMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            this.rustplus.patrolHelicopterTracers[marker.id] = [{ x: marker.x, y: marker.y }];

            marker.location = pos;

            /* Offset that is used to determine if PatrolHelicopter just spawned */
            let offset = 4 * Map.gridDiameter;

            /* If PatrolHelicopter is located outside the grid system + the offset */
            if (Map.isOutsideGridSystem(marker.x, marker.y, mapSize, offset)) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterEntersMap', {
                        location: pos.string
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_ENTERS_MAP);
            }
            else {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterLocatedAt', {
                        location: pos.string
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_LOCATED_AT);
            }

            this.patrolHelicopters.push(marker);
        }

        /* PatrolHelicopter markers that have left. */
        for (let marker of leftMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;

            if (Map.isOutsideGridSystem(marker.x, marker.y, mapSize)) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterLeftSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterLeftMap', {
                        location: marker.location.string
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_LEFT_MAP);

                this.timeSincePatrolHelicopterWasOnMap = new Date();
            }
            else {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterDestroyedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterTakenDown', {
                        location: marker.location.string
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_TAKEN_DOWN);

                this.timeSincePatrolHelicopterWasDestroyed = new Date();
                this.timeSincePatrolHelicopterWasOnMap = new Date();

                this.patrolHelicopterDestroyedLocation = Map.getGridPos(marker.x, marker.y, mapSize);
            }

            this.patrolHelicopters = this.patrolHelicopters.filter(e => e.id !== marker.id);
            delete this.rustplus.patrolHelicopterTracers[marker.id];
        }

        /* PatrolHelicopter markers that still remains. */
        for (let marker of remainingMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            let patrolHelicopter = this.getMarkerByTypeId(this.types.PatrolHelicopter, marker.id);

            this.rustplus.patrolHelicopterTracers[marker.id].push({ x: marker.x, y: marker.y });

            patrolHelicopter.x = marker.x;
            patrolHelicopter.y = marker.y;
            patrolHelicopter.location = pos;
        }
    }

    updateTravelingVendors(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeId(this.types.TravelingVendor, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeId(this.types.TravelingVendor, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.TravelingVendor, mapMarkers.markers);

        /* TravelingVendor markers that are new. */
        for (let marker of newMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            marker.location = pos;
            marker.isHalted = false;

            this.rustplus.sendEvent(
                this.rustplus.notificationSettings.travelingVendorDetectedSetting,
                this.client.intlGet(this.rustplus.guildId, 'travelingVendorSpawnedAt', { location: pos.string }),
                'travelingVendor',
                Constants.COLOR_TRAVELING_VENDOR_LOCATED_AT);

            this.travelingVendors.push(marker);
        }
        
        /* TravelingVendor markers that have left. */
        for (let marker of leftMarkers) {
            this.rustplus.sendEvent(
                this.rustplus.notificationSettings.travelingVendorLeftSetting,
                this.client.intlGet(this.rustplus.guildId, 'travelingVendorLeftMap', { location: marker.location.string }),
                'travelingVendor',
                Constants.COLOR_TRAVELING_VENDOR_LEFT_MAP);

            this.timeSinceTravelingVendorWasOnMap = new Date();

            this.travelingVendors = this.travelingVendors.filter(e => e.id !== marker.id);
        }

        /* TravelingVendor markers that still remains. */
        for (let marker of remainingMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            let travelingVendor = this.getMarkerByTypeId(this.types.TravelingVendor, marker.id);

            /* If TravelingVendor is halted */
            if (!this.rustplus.isFirstPoll && !travelingVendor.isHalted) {
                if (marker.x === travelingVendor.x && marker.y === travelingVendor.y) {
                    travelingVendor.isHalted = true;
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.travelingVendorHaltedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'travelingVendorHaltedAt', { location: pos.string }),
                        'travelingVendor',
                        Constants.COLOR_TRAVELING_VENDOR_HALTED);
                }
            }
            /* If TravelingVendor is moving again */
            else if (!this.rustplus.isFirstPoll && travelingVendor.isHalted) {
                if (marker.x !== travelingVendor.x || marker.y !== travelingVendor.y) {
                    travelingVendor.isHalted = false;
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.travelingVendorHaltedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'travelingVendorResumedAt', { location: pos.string }),
                        'travelingVendor',
                        Constants.COLOR_TRAVELING_VENDOR_MOVING);
                }
            }
            travelingVendor.x = marker.x;
            travelingVendor.y = marker.y;
            travelingVendor.location = pos;
        }
    }



    /* Timer notification functions */

    notifyCargoShipEgress(args) {
        let id = Array.isArray(args) ? args[0] : args;
        let marker = this.getMarkerByTypeId(this.types.CargoShip, id);
        let cargoShipMeta = this.cargoShipMetaData[id];
        let allHarborsDocked = cargoShipMeta &&
            cargoShipMeta.harborsDocked.length === this.getCargoHarbors().length;
        let hasDockingStatus = cargoShipMeta && cargoShipMeta.dockingStatus !== null;

        this.stopCargoShipTimer(this.cargoShipEgressTimers, id);

        if (!marker || !cargoShipMeta || !allHarborsDocked || hasDockingStatus) {
            return;
        }

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.cargoShipLeavingSetting,
            this.client.intlGet(this.rustplus.guildId,
                cargoShipMeta.isDepartureCertain ? 'cargoShipLeaving' : 'cargoShipLeavingMaybe',
                { location: marker.location.string }),
            'cargo',
            Constants.COLOR_CARGO_SHIP_ENTERS_EGRESS_STAGE);
    }

    notifyCargoShipEgressAfterHarbor(id, firstTimer) {
        let cargoShip = this.getMarkerByTypeId(this.types.CargoShip, id);
        if (!cargoShip) {
            this.stopCargoShipTimer(firstTimer ? this.cargoShipEgressAfterHarbor1Timers :
                this.cargoShipEgressAfterHarbor2Timers, id);
            return;
        }

        this.stopCargoShipTimer(firstTimer ? this.cargoShipEgressAfterHarbor1Timers :
            this.cargoShipEgressAfterHarbor2Timers, id);

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.cargoShipLeavingSetting,
            this.client.intlGet(this.rustplus.guildId,
                firstTimer ? 'cargoShipLeavingNoLockedCratesLeft' : 'cargoShipLeaving',
                { location: cargoShip.location.string }),
            'cargo',
            Constants.COLOR_CARGO_SHIP_ENTERS_EGRESS_STAGE);
    }

    notifyCargoShipLockedCrateSpawn(id) {
        let cargoShipMeta = this.cargoShipMetaData[id];
        let cargoShip = this.getMarkerByTypeId(this.types.CargoShip, id);
        if (!cargoShipMeta || !cargoShip) {
            this.clearCargoShipLockedCrateSpawnScheduler(id);
            return;
        }

        cargoShipMeta.lockedCrateSpawnCounter++;

        if (cargoShipMeta.lockedCrateSpawnCounter >= Constants.CARGO_SHIP_LOOT_ROUNDS) {
            this.clearCargoShipLockedCrateSpawnScheduler(id);
        }
        else {
            this.cargoShipLockedCrateNextSpawnTimes[id] =
                Date.now() + Constants.CARGO_SHIP_LOOT_ROUNDS_SPACING_MS;
        }

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.cargoShipLockedCrateSpawnedSetting,
            this.client.intlGet(this.rustplus.guildId, 'cargoShipLockedCrateSpawned', {
                location: cargoShip.location.string
            }),
            'cargo',
            Constants.COLOR_CARGO_SHIP_LOCATED,
            false,
            'locked_crate_cargoship_logo.png');
    }

    notifyCargoShipUndockingSoon(id, mapSize) {
        let cargoShip = this.getMarkerByTypeId(this.types.CargoShip, id);
        if (!cargoShip) {
            if (this.cargoShipUndockingNotificationTimeouts[id]) {
                clearTimeout(this.cargoShipUndockingNotificationTimeouts[id]);
                delete this.cargoShipUndockingNotificationTimeouts[id];
            }
            delete this.cargoShipUndockingNotificationEndTimes[id];
            return;
        }

        let harbor = this.getClosestCargoHarbor(cargoShip.x, cargoShip.y);
        if (!harbor) {
            if (this.cargoShipUndockingNotificationTimeouts[id]) {
                clearTimeout(this.cargoShipUndockingNotificationTimeouts[id]);
                delete this.cargoShipUndockingNotificationTimeouts[id];
            }
            delete this.cargoShipUndockingNotificationEndTimes[id];
            return;
        }

        let harborLocation = Map.getPos(harbor.x, harbor.y, mapSize, this.rustplus);
        let harborName = harborLocation.monument ?? harborLocation.location;
        let harborGrid = Map.getGridPos(harbor.x, harbor.y, mapSize) ?? harborLocation.location;

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.cargoShipUndockingSetting,
            this.client.intlGet(this.rustplus.guildId, 'cargoShipUndockingSoon', {
                location: harborName,
                grid: harborGrid
            }),
            'cargo',
            Constants.COLOR_CARGO_SHIP_DOCKED);

        if (this.cargoShipUndockingNotificationTimeouts[id]) {
            clearTimeout(this.cargoShipUndockingNotificationTimeouts[id]);
            delete this.cargoShipUndockingNotificationTimeouts[id];
        }
        delete this.cargoShipUndockingNotificationEndTimes[id];
    }

    notifyCrateSmallOilRigOpen(args) {
        let oilRigLocation = args[0];

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.lockedCrateOilRigUnlockedSetting,
            this.client.intlGet(this.rustplus.guildId, 'lockedCrateSmallOilRigUnlocked', {
                location: oilRigLocation
            }),
            'small',
            Constants.COLOR_LOCKED_CRATE_SMALL_OILRIG_UNLOCKED,
            this.rustplus.isFirstPoll,
            'locked_crate_small_oil_rig_logo.png');

        this.crateSmallOilRigTimer.stop();
        this.crateSmallOilRigTimer = null;
        this.crateSmallOilRigLocation = null;
    }

    notifyCrateLargeOilRigOpen(args) {
        let oilRigLocation = args[0];

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.lockedCrateOilRigUnlockedSetting,
            this.client.intlGet(this.rustplus.guildId, 'lockedCrateLargeOilRigUnlocked', {
                location: oilRigLocation
            }),
            'large',
            Constants.COLOR_LOCKED_CRATE_LARGE_OILRIG_UNLOCKED,
            this.rustplus.isFirstPoll,
            'locked_crate_large_oil_rig_logo.png');

        this.crateLargeOilRigTimer.stop();
        this.crateLargeOilRigTimer = null;
        this.crateLargeOilRigLocation = null;
    }

    /* Help functions */

    getClosestMonument(x, y) {
        let minDistance = 1000000;
        let closestMonument = null;
        for (let monument of this.rustplus.map.monuments) {
            let distance = Map.getDistance(x, y, monument.x, monument.y);
            if (distance < minDistance && this.validCrateMonuments.includes(monument.token)) {
                minDistance = distance;
                closestMonument = monument;
            }
        }

        return closestMonument;
    }

    reset() {
        this.players = [];
        this.vendingMachines = [];
        this.ch47s = [];
        this.cargoShips = [];
        this.genericRadiuses = [];
        this.patrolHelicopters = [];
        this.travelingVendors = [];
        this.deepSeas = [];

        for (const [id, timer] of Object.entries(this.cargoShipEgressTimers)) {
            timer.stop();
        }
        this.cargoShipEgressTimers = new Object();
        for (const [id, timer] of Object.entries(this.cargoShipEgressAfterHarbor1Timers)) {
            timer.stop();
        }
        this.cargoShipEgressAfterHarbor1Timers = new Object();
        for (const [id, timer] of Object.entries(this.cargoShipEgressAfterHarbor2Timers)) {
            timer.stop();
        }
        this.cargoShipEgressAfterHarbor2Timers = new Object();
        for (const [id, interval] of Object.entries(this.cargoShipLockedCrateSpawnIntervals)) {
            clearInterval(interval);
        }
        this.cargoShipLockedCrateSpawnIntervals = new Object();
        for (const [id, timeoutId] of Object.entries(this.cargoShipLockedCrateSpawnTimeouts)) {
            clearTimeout(timeoutId);
        }
        this.cargoShipLockedCrateSpawnTimeouts = new Object();
        this.cargoShipLockedCrateNextSpawnTimes = new Object();
        for (const [id, timeoutId] of Object.entries(this.cargoShipUndockingNotificationTimeouts)) {
            clearTimeout(timeoutId);
        }
        this.cargoShipUndockingNotificationTimeouts = new Object();
        this.cargoShipUndockingNotificationEndTimes = new Object();
        if (this.crateSmallOilRigTimer) {
            this.crateSmallOilRigTimer.stop();
        }
        this.crateSmallOilRigTimer = null;
        if (this.crateLargeOilRigTimer) {
            this.crateLargeOilRigTimer.stop();
        }
        this.crateLargeOilRigTimer = null;

        this.timeSinceCargoShipWasOut = null;
        this.timeSinceCH47WasOut = null;
        this.timeSinceSmallOilRigWasTriggered = null;
        this.timeSinceLargeOilRigWasTriggered = null;
        this.timeSincePatrolHelicopterWasOnMap = null;
        this.timeSincePatrolHelicopterWasDestroyed = null;
        this.timeSinceTravelingVendorWasOnMap = null;
        this.timeSinceDeepSeaSpawned = null;
        this.timeSinceDeepSeaWasOnMap = null;

        this.patrolHelicopterDestroyedLocation = null;

        this.knownVendingMachines = [];
        this.cargoShipMetaData = new Object();
        this.subscribedItemsId = [];
        this.foundItems = [];

        this.crateSmallOilRigLocation = null;
        this.crateLargeOilRigLocation = null;

        this.isDeepSeaActive = false;
    }
}

module.exports = MapMarkers;
