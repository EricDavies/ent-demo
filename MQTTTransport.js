/**
 * Created by eric on 01/09/16.
 */
/// <reference path="./Promise.d.ts" />
define(["require", "exports"], function (require, exports) {
    "use strict";
    function getTimeString() {
        return (new Date()).toLocaleTimeString();
    }
    var PendingRequest = (function () {
        function PendingRequest() {
        }
        return PendingRequest;
    }());
    ;
    var MQTTTransport = (function () {
        function MQTTTransport(destTopic, proxy, loggingEnabled) {
            this.messageCounter = 0;
            this.loggingEnabled = false;
            this.pendingRequests = {};
            this.loggingEnabled = loggingEnabled;
            this.destTopic = destTopic;
            this.proxy = proxy;
        }
        MQTTTransport.prototype.enableLogging = function (loggingEnabled) {
            this.loggingEnabled = loggingEnabled;
        };
        MQTTTransport.prototype.setListener = function (listener) {
            this.transportListener = listener;
        };
        MQTTTransport.prototype.onConnectionLost = function (responseObject) {
            this.transportListener.onConnectionLost(responseObject.errorMessage);
        };
        MQTTTransport.prototype.onMessageArrived = function (parsedJson) {
            if (parsedJson["rpc"]) {
                var rpcBody = parsedJson["rpc"];
                var id = rpcBody["id"];
                if (rpcBody["method"]) {
                    this.transportListener.onMessage(parsedJson["rpc"]);
                }
                else if (this.pendingRequests[id]) {
                    clearTimeout(this.pendingRequests[id].timeout);
                    if (rpcBody["result"]) {
                        var params = rpcBody["result"];
                        if (this.enableLogging) {
                            console.log(getTimeString(), " pendingRequest for message " + id + " got result ", parsedJson);
                        }
                        this.pendingRequests[id].resolve(params);
                    }
                    else if (rpcBody["error"]) {
                        if (this.enableLogging) {
                            console.log(getTimeString(), " pendingRequest for message " + id + " got error ", parsedJson);
                        }
                        var params = rpcBody["error"];
                        this.pendingRequests[id].reject(new Error(params.message));
                    }
                    else {
                        console.log(getTimeString(), " Bad RPC received, no method/result/error fields", parsedJson);
                    }
                    delete this.pendingRequests[id];
                }
                else {
                    this.transportListener.onMessage(parsedJson["rpc"]);
                }
            }
            else if (this.loggingEnabled) {
                console.log(getTimeString(), " received nonrpc message", parsedJson);
            }
        };
        MQTTTransport.prototype.sendRequest = function (messageType, payload) {
            if (typeof payload == "undefined") {
                console.log(getTimeString(), " Attempt to send null message");
                return 0;
            }
            else {
                var rpcbody = {};
                this.messageCounter++;
                if (this.loggingEnabled) {
                    console.log(getTimeString(), " message counter incremented ", this.messageCounter);
                }
                rpcbody["jsonrpc"] = "2.0";
                rpcbody["method"] = messageType;
                rpcbody["params"] = payload;
                rpcbody["id"] = this.messageCounter;
                this.proxy.sendRPCMessage(this.destTopic, rpcbody);
                return this.messageCounter;
            }
        };
        MQTTTransport.prototype.sendRequest2 = function (messageType, payload) {
            if (this.loggingEnabled) {
                console.log(getTimeString(), " entered sendRequest2 with messageType " + messageType, payload);
            }
            var self = this;
            return new Promise(function (resolve, reject) {
                if (self.loggingEnabled) {
                    console.log(getTimeString(), " entered sendRequest2 then clause with messageType " + messageType, payload);
                }
                var id = self.sendRequest(messageType, payload);
                if (self.loggingEnabled) {
                    console.log("sendRequest2 saw id of " + id);
                }
                var pending = {
                    timeout: setTimeout(function () {
                        if (self.loggingEnabled) {
                            console.log(getTimeString(), " Pending request for id " + id + " timed out");
                        }
                        reject(new Error("timed out"));
                        delete self.pendingRequests[id];
                    }, 10000),
                    messageId: id,
                    resolve: resolve,
                    reject: reject
                };
                self.pendingRequests[id] = pending;
            });
        };
        MQTTTransport.prototype.sendResponse = function (id, payload) {
            if (typeof payload == "undefined") {
                console.log(getTimeString(), " Attempt to send null message");
            }
            else {
                var rpcbody = {};
                rpcbody["jsonrpc"] = "2.0";
                rpcbody["result"] = payload;
                rpcbody["id"] = id;
                this.proxy.sendRPCMessage(this.destTopic, rpcbody);
            }
        };
        MQTTTransport.prototype.sendAck = function (id) {
            this.sendResponse(id, { ack: true });
        };
        MQTTTransport.prototype.sendError = function (id, errorCode, errorDescription, errorData) {
            var rpcbody = {};
            var errorBody = {};
            errorBody["code"] = errorCode;
            errorBody["message"] = errorDescription;
            if (errorData) {
                errorBody["data"] = errorData;
            }
            rpcbody["jsonrpc"] = "2.0";
            rpcbody["error"] = errorBody;
            rpcbody["id"] = id;
            this.proxy.sendRPCMessage(this.destTopic, rpcbody);
        };
        MQTTTransport.prototype.getResponseAddress = function () {
            return this.proxy.getResponseAddress();
        };
        return MQTTTransport;
    }());
    ;
    var MQTTBuilder = (function () {
        function MQTTBuilder() {
            this.QOS = 1;
            this.messageCounter = 0;
            this.loggingEnabled = false;
            this.pendingRequests = {};
            this.transports = {};
            this.MY_CLIENTID = Date.now().toString(16);
            this.MY_TOPIC = "peer/" + this.MY_CLIENTID;
            this.STATUS_TOPIC = this.MY_TOPIC + "/status";
        }
        MQTTBuilder.prototype.enableLogging = function (value) {
            this.loggingEnabled = value;
        };
        MQTTBuilder.prototype.getUserId = function () {
            return this.MY_CLIENTID;
        };
        MQTTBuilder.prototype.build = function (address) {
            var newTransport = new MQTTTransport(address, this, this.loggingEnabled);
            this.transports[address] = newTransport;
            return newTransport;
        };
        /**
         * Sends a raw text string to the server.
         * @param message the text to be sent.
         */
        MQTTBuilder.prototype.sendRawMessage = function (destTopic, message) {
            var mywindow = window;
            var mqttMsg = new mywindow.Paho.MQTT.Message(message);
            mqttMsg.destinationName = destTopic;
            this.mqttClient.send(mqttMsg);
            if (this.loggingEnabled) {
                console.log(getTimeString(), " sending to", destTopic, " message: ", message);
            }
        };
        /**
         * This converts the rpc message to text and then invokes sendRawMessage.
         * @param rpcMessage
         */
        MQTTBuilder.prototype.sendRPCMessage = function (destTopic, rpcMessage) {
            var fullMessage = {};
            fullMessage["peerId"] = this.MY_CLIENTID;
            fullMessage["replyTo"] = this.MY_TOPIC;
            fullMessage["rpc"] = rpcMessage;
            this.sendRawMessage(destTopic, JSON.stringify(fullMessage));
        };
        MQTTBuilder.prototype.distributeMessages = function (message) {
            if (this.loggingEnabled) {
                console.log(getTimeString(), " incoming message ", message.payloadString);
            }
            var messageString = message.payloadString;
            var parsedJson;
            try {
                parsedJson = JSON.parse(messageString);
            }
            catch (jsonParseError) {
                console.log("Bad JSON received ", messageString);
                return;
            }
            if (parsedJson["rpc"]) {
                var replyTo = parsedJson["replyTo"];
                if (!replyTo) {
                    if (this.loggingEnabled) {
                        console.log(getTimeString(), " received rpc message with no replyTo field", message);
                    }
                }
                else if (this.transports[replyTo]) {
                    this.transports[replyTo].onMessageArrived(parsedJson);
                }
                else {
                    if (this.loggingEnabled) {
                        console.log(getTimeString(), " received message that doesn't have a handler, message was ", message);
                    }
                }
            }
            else if (this.loggingEnabled) {
                console.log(getTimeString(), " received nonrpc message", message);
            }
        };
        MQTTBuilder.prototype.buildStatusMessage = function (connected) {
            return JSON.stringify({
                peerId: this.MY_CLIENTID,
                replyTo: this.MY_TOPIC,
                rpc: {
                    jsonrpc: "2.0",
                    method: "peerStatus",
                    params: {
                        peerType: "browser-app",
                        maxConcurrentCalls: (connected ? 40 : 0),
                        acceptNewCalls: 0,
                        connected: connected
                    }
                }
            });
        };
        /**
         * Connect to the server.
         * @param url the url of the server to connect to.
         * @param port
         * @param listener a listener object for asynchronous events.
         */
        MQTTBuilder.prototype.connect = function (url, port, listener, username, credential) {
            var _this = this;
            this.transportBuilderListener = listener;
            console.log(getTimeString(), " starting connection");
            var mywindow = window;
            this.mqttClient = new mywindow.Paho.MQTT.Client(url, port, this.MY_CLIENTID);
            var lastWill = new mywindow.Paho.MQTT.Message(this.buildStatusMessage(false));
            lastWill.retained = false;
            lastWill.qos = 2;
            lastWill.destinationName = this.STATUS_TOPIC;
            var options = {
                timeout: 3,
                useSSL: true,
                cleanSession: false,
                willMessage: lastWill,
                onSuccess: function () {
                    if (_this.loggingEnabled) {
                        console.log(getTimeString(), " mqtt connected");
                    }
                    // Connection succeeded; subscribe to our topic, you can add multiple lines of these
                    _this.mqttClient.subscribe(_this.MY_TOPIC, { qos: 1 });
                    var mywindow = window;
                    var mqttMsg = new mywindow.Paho.MQTT.Message(_this.buildStatusMessage(true));
                    mqttMsg.destinationName = _this.STATUS_TOPIC;
                    mqttMsg.retained = true;
                    _this.mqttClient.send(mqttMsg);
                    _this.transportBuilderListener.onConnectionSuccess();
                },
                onFailure: function (message) {
                    if (_this.loggingEnabled) {
                        console.log(getTimeString(), " Connection failed: " + message.errorMessage);
                    }
                    _this.transportBuilderListener.onConnectionFailure(message.errorMessage);
                }
            };
            this.mqttClient.onConnectionLost = function (responseObject) {
                _this.transportBuilderListener.onConnectionLost(responseObject.errorMessage);
                for (var i in _this.transports) {
                    _this.transports[i].onConnectionLost(responseObject);
                }
            };
            this.mqttClient.onMessageArrived = function (message) {
                try {
                    _this.distributeMessages(message);
                }
                catch (e1) {
                    console.log("Exception ", e1, " stack was ", e1.stack);
                    console.log("Triggering message was ", message);
                }
            };
            this.mqttClient.connect(options);
        };
        MQTTBuilder.prototype.getResponseAddress = function () {
            return this.MY_TOPIC;
        };
        MQTTBuilder.prototype.close = function () {
            var mywindow = window;
            var mqttMsg = new mywindow.Paho.MQTT.Message(this.buildStatusMessage(false));
            mqttMsg.destinationName = this.STATUS_TOPIC;
            mqttMsg.retained = true;
            this.mqttClient.send(mqttMsg);
            this.mqttClient.disconnect();
        };
        return MQTTBuilder;
    }());
    exports.MQTTBuilder = MQTTBuilder;
});
