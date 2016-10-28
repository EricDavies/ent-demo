/**
 * Created by eric on 30/09/16.
 */
/// <reference path="./jsonpatch.d.ts"/>
define(["require", "exports", "./JSONPatchBuilder"], function (require, exports, JSONPatchBuilder_1) {
    "use strict";
    var PerPeerData = (function () {
        function PerPeerData() {
        }
        return PerPeerData;
    }());
    exports.PerPeerData = PerPeerData;
    ;
    var PerRoomData = (function () {
        function PerRoomData() {
        }
        return PerRoomData;
    }());
    exports.PerRoomData = PerRoomData;
    ;
    /**
     * This class manages the communication to a microservice that manages discovery based on rooms.
     */
    var RoomControlClient = (function () {
        function RoomControlClient(transport, roomListener) {
            this.confirmedRooms = {};
            this.roomData = {};
            this.myUserCfg = {};
            this.selfUserName = null;
            this.transport = transport;
            this.transport.setListener(this);
            this.listener = roomListener;
        }
        /** Called when a successful connection is lost, ie, after onConnectionSuccess succeeds
         * @param errorMessage A humanly readable message explaining why the connection was lost.
         * */
        RoomControlClient.prototype.onConnectionLost = function (errorMessage) {
            for (var roomName in this.confirmedRooms) {
                this.listener.selfRemovedFromRoom(roomName);
            }
            this.confirmedRooms = null;
        };
        RoomControlClient.prototype.applyRoomUpdate = function (roomName, patch) {
            this.roomData[roomName] = jsonpatch.apply_patch(this.roomData[roomName], patch);
        };
        /** Called when a message fails to send properly. In a properly running system, you wouldn't see this.
         * @param errorMessage A humanly readable message explaining why the send failed.
         * */
        RoomControlClient.prototype.onSendFailure = function (errorMessage) {
        };
        /**
         * Called when a JSON message is received.
         * @param message - a message in JSON format received from the server.
         */
        RoomControlClient.prototype.onMessage = function (message) {
            var roomName = message.params.roomName;
            switch (message.method) {
                case "removedFromRoom":
                    this.transport.sendAck(message.id);
                    delete this.confirmedRooms[roomName];
                    this.listener.selfRemovedFromRoom(roomName);
                    break;
                case "addedToRoom":
                    this.transport.sendAck(message.id);
                    this.listener.selfAddedToRoom(roomName);
                    this.confirmedRooms[roomName] = roomName;
                    this.roomData[roomName] = { peers: {} };
                    break;
                case "roomData":
                    this.transport.sendAck(message.id);
                    this.roomData[roomName] =
                        jsonpatch.apply_patch(this.roomData[roomName], message.params.roomOccupantPatch);
                    this.listener.peersInRoomUpdated(roomName, this.roomData[roomName].peers);
                    break;
            }
        };
        // sends an update request to the ApiFieldController.
        //
        RoomControlClient.prototype.UpdateMyRoomApiFields = function (roomName, fields) {
            var patch = JSONPatchBuilder_1.JSONPatchBuilder(this.peerApiFields[roomName], fields);
            if (patch.length > 0) {
                this.peerApiFields = JSON.parse(JSON.stringify(fields));
                return this.transport.sendRequest2("updatePeerApiField", { roomName: roomName, peerFieldUpdate: patch });
            }
            else {
                return this.buildSuccessPromise();
            }
        };
        /**
         * Sets the presence state on the server.
         * @param {String} state - one of 'away','chat','dnd','xa'
         * @param {String} statusText - User configurable status string. May be length limited.
         * @example   easyrtc.updatePresence('dnd', 'sleeping');
         */
        RoomControlClient.prototype.setPresence = function (state, statusText) {
            return this.transport.sendRequest2("updateStatus", { state: state, statusText: statusText });
        };
        // does this need to be checked and hence be a promise
        //
        RoomControlClient.prototype.SetApplication = function (applicationName) {
            this.applicationName = applicationName;
        };
        RoomControlClient.prototype.GetRoomNames = function () {
            var self = this;
            return new Promise(function (resolve, reject) {
                self.transport.sendRequest2("requestRoomNames", { applicationName: self.applicationName }).then(function (body) {
                    resolve(body.roomNames);
                }, reject);
            });
        };
        RoomControlClient.prototype.JoinRoom = function (roomName) {
            var self = this;
            return new Promise(function (resolve, reject) {
                self.transport.sendRequest2("requestJoinRoom", { applicationName: self.applicationName, roomName: roomName }).then(function (body) {
                    resolve(roomName);
                }, reject);
            });
        };
        RoomControlClient.prototype.LeaveRoom = function (roomName) {
            var self = this;
            return new Promise(function (resolve, reject) {
                self.transport.sendRequest2("requestLeaveRoom", { applicationName: self.applicationName, roomName: roomName }).then(function (body) {
                    resolve(roomName);
                }, reject);
            });
        };
        RoomControlClient.prototype.QueryRoom = function (roomName) {
            var self = this;
            return new Promise(function (resolve, reject) {
                self.transport.sendRequest2("requestQueryRoom", { applicationName: self.applicationName, roomName: roomName }).then(function (body) {
                    resolve(body.roomOccupants);
                }, reject);
            });
        };
        RoomControlClient.prototype.SetUsername = function (username) {
            this.transport.sendRequest("setUsername", { username: username });
        };
        RoomControlClient.prototype.updateUserCfg = function (userCfg) {
            var patch = JSONPatchBuilder_1.JSONPatchBuilder(this.myUserCfg, userCfg);
            if (patch.length > 0) {
                this.myUserCfg = JSON.parse(JSON.stringify(userCfg));
                return this.transport.sendRequest2("updateUserCfg", { userCfg: patch });
            }
            else {
                return this.buildSuccessPromise();
            }
        };
        RoomControlClient.prototype.buildSuccessPromise = function () {
            return new Promise(function (resolve, reject) {
                resolve(undefined);
            });
        };
        RoomControlClient.prototype.getRoomField = function (roomName, fieldName) {
            var fields = this.getRoomFields(roomName);
            if (!fields) {
                return {};
            }
            return fields[fieldName];
        };
        ;
        RoomControlClient.prototype.getRoomFields = function (roomName) {
            var room = this.roomData[roomName];
            if (!room) {
                return null;
            }
            var fields = room.roomFields;
            return (fields) ? fields : {};
        };
        RoomControlClient.prototype.getRoomApiField = function (roomName, easyrtcid, fieldName) {
            var room = this.roomData[roomName];
            if (!room || !room.peers) {
                return null;
            }
            var peer = room.peers[easyrtcid];
            return (!peer || !peer.apiFields) ? undefined : peer[fieldName].fieldValue;
        };
        ;
        RoomControlClient.prototype.sendPeerMessage = function (message, ackHandler) {
            this.transport.sendRequest2("peer2PeerMessage", message).then(function () {
                ackHandler({ msgType: "ack", msgData: [] });
            }, function (error) {
                ackHandler({ msgType: "error", msgData: { errorText: error.message } });
            });
        };
        return RoomControlClient;
    }());
    exports.RoomControlClient = RoomControlClient;
});
