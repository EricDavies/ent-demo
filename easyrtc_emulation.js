/**
 * Created by eric on 28/09/16.
 */
define(["require", "exports", "./callControlClient", "./roomControlClient", "./MQTTTransport", "./MediaResources"], function (require, exports, CCC, RCC, MQTTTransport_1, MR) {
    "use strict";
    /* global define, module, require, console, MediaStreamTrack, createIceServer, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription */
    /*!
     Script: easyrtc.js
    
     Provides client side support for the EasyRTC framework.
     See the easyrtc_client_api.md and easyrtc_client_tutorial.md
     for more details.
    
     About: License
    
     Copyright (c) 2016, Priologic Software Inc.
     All rights reserved.
    
     Redistribution and use in source and binary forms, with or without
     modification, are permitted provided that the following conditions are met:
    
     * Redistributions of source code must retain the above copyright notice,
     this list of conditions and the following disclaimer.
     * Redistributions in binary form must reproduce the above copyright
     notice, this list of conditions and the following disclaimer in the
     documentation and/or other materials provided with the distribution.
    
     THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
     AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
     IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
     ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
     LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
     CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
     SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
     INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
     CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
     ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
     POSSIBILITY OF SUCH DAMAGE.
     */
    var ReceivedMediaConstraints = (function () {
        function ReceivedMediaConstraints() {
        }
        return ReceivedMediaConstraints;
    }());
    exports.ReceivedMediaConstraints = ReceivedMediaConstraints;
    var ReceivePeerCallbackWithSource = (function () {
        function ReceivePeerCallbackWithSource() {
        }
        return ReceivePeerCallbackWithSource;
    }());
    var ReceivePeerCallbackWithMsgType = (function () {
        function ReceivePeerCallbackWithMsgType() {
        }
        return ReceivePeerCallbackWithMsgType;
    }());
    var ReceivePeerCallbackMap = (function () {
        function ReceivePeerCallbackMap() {
        }
        return ReceivePeerCallbackMap;
    }());
    var PeerConnType = (function () {
        function PeerConnType() {
            this.connectionAccepted = false;
            this.remoteStreamsPerCallId = {}; //   was pc: RTCPeerConnection;
            this.liveRemoteStreams = {}; // remote media streams by name
            this.remoteStreamIdToName = {};
            this.dataChannelReady = false;
        }
        PeerConnType.prototype.getRemoteStreamByName = function (streamName) {
            if (!streamName) {
                streamName = "default";
            }
            return this.liveRemoteStreams[streamName];
        };
        PeerConnType.prototype.numberOfActiveCalls = function () {
            return Object.keys(this.remoteStreamsPerCallId).length;
        };
        PeerConnType.prototype.removeCallId = function (callId) {
            if (this.remoteStreamsPerCallId[callId]) {
                delete this.remoteStreamsPerCallId[callId];
            }
        };
        PeerConnType.prototype.removeStream = function (callId, stream) {
            if (!this.remoteStreamsPerCallId[callId])
                return;
            var fixedArray = [];
            for (var i = 0; i < this.remoteStreamsPerCallId[callId].length; i++) {
                if (this.remoteStreamsPerCallId[callId][i].id != stream.id) {
                    fixedArray.push(this.remoteStreamsPerCallId[callId][i]);
                }
            }
            this.remoteStreamsPerCallId[callId] = fixedArray;
        };
        return PeerConnType;
    }());
    var UserSettings = (function () {
        function UserSettings() {
        }
        return UserSettings;
    }());
    var DesiredVideoProperties = (function () {
        function DesiredVideoProperties() {
        }
        return DesiredVideoProperties;
    }());
    var Easyrtc = (function () {
        function Easyrtc() {
            this.applicationName = "default";
            this.easyrtcsid = null;
            this._desiredVideoProperties = null;
            this.roomData = {};
            this.receivePeer = {
                cb: null,
                msgTypes: {}
            };
            this.errCodes = {
                BAD_NAME: "BAD_NAME",
                CALL_ERR: "CALL_ERR",
                DEVELOPER_ERR: "DEVELOPER_ERR",
                SYSTEM_ERR: "SYSTEM_ERR",
                CONNECT_ERR: "CONNECT_ERR",
                MEDIA_ERR: "MEDIA_ERR",
                MEDIA_WARNING: "MEDIA_WARNING",
                INTERNAL_ERR: "INTERNAL_ERR",
                PEER_GONE: "PEER_GONE",
                ALREADY_CONNECTED: "ALREADY_CONNECTED",
                BAD_CREDENTIAL: "BAD_CREDENTIAL",
                ICECANDIDATE_ERR: "ICECANDIDATE_ERR",
                NOVIABLEICE: "NOVIABLEICE",
                SIGNAL_ERR: "SIGNAL_ERR",
            };
            this.debugPrinter = function (message) {
                console.log(message);
            };
            this.localMediaStreams = {};
            this.roomsToJoinOnConnect = [];
            this.receiveAudioEnabled = true;
            this.receiveVideoEnabled = true;
            this.autoInitUserMedia = true;
            /** @private */
            this.iceCandidateFilter = null;
            /** @private */
            this.iceConnectionStateChangeListener = null;
            /** @private */
            this.connectionOptions = {
                'connect timeout': 10000,
                'force new connection': true
            };
            this.onPeerClosed = null;
            this.onPeerFailing = null;
            this.onPeerRecovered = null;
            /**
             * Sets a function that listens on IceConnectionStateChange events.
             *
             * During ICE negotiation the peer connection fires the iceconnectionstatechange event.
             * It is sometimes useful for the application to learn about these changes, especially if the ICE connection fails.
             * The function should accept three parameters: the easyrtc id of the peer, the iceconnectionstatechange event target,
             * and the ice connection state itself.
             * @param {Function} listener
             */
            this.setIceConnectionStateChangeListener = function (listener) {
                this.iceConnectionStateChangeListener = listener;
            };
            /**
             * Controls whether a default local media stream should be acquired automatically during calls and accepts
             * if a list of streamNames is not supplied. The default is true, which mimics the behaviour of earlier releases
             * that didn't support multiple streams. This function should be called before easyrtc.call or before entering an
             * accept  callback.
             * @param {Boolean} flag true to allocate a default local media stream.
             */
            this.setAutoInitUserMedia = function (flag) {
                this.autoInitUserMedia = !!flag;
            };
            /**
             * This function performs a printf like formatting. It actually takes an unlimited
             * number of arguments, the declared arguments arg1, arg2, arg3 are present just for
             * documentation purposes.
             * @param {String} format A string like "abcd{1}efg{2}hij{1}."
             * @param {String} arg1 The value that replaces {1}
             * @param {String} arg2 The value that replaces {2}
             * @param {String} arg3 The value that replaces {3}
             * @returns {String} the formatted string.
             */
            this.format = function (format) {
                var args = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                    args[_i - 1] = arguments[_i];
                }
                var formatted = format;
                for (var i = 1; i < args.length; i++) {
                    var regexp = new RegExp('\\{' + (i - 1) + '\\}', 'gi');
                    formatted = formatted.replace(regexp, args[i]);
                }
                return formatted;
            };
            /** @private */
            //
            // Maps a key to a language specific string using the easyrtc_lang map.
            // Defaults to the key if the key can not be found, but outputs a warning in that case.
            // This function is only used internally by easyrtc.js
            //
            this.haveAudioVideo = {
                audio: false,
                video: false
            };
            /**
             * @private
             * @param {String} key
             */
            this.getConstantString = function (key) {
                if (window["easyrtc_lang"][key]) {
                    return window["easyrtc_lang"][key];
                }
                else {
                    this.showError(this.errCodes.DEVELOPER_ERR, "Could not find key='" + key + "' in easyrtc_lang");
                    return key;
                }
            };
            /** @private */
            //
            // this is a list of the events supported by the generalized event listener.
            //
            this.allowedEvents = {
                roomOccupant: true,
                roomOccupants: true // this receives a {roomName:..., occupants:...} value for a specific room
            };
            /** @private */
            //
            // A map of eventListeners. The key is the event type.
            //
            this.eventListeners = {};
            /**
             * Removes an event listener.
             * @param {String} eventName
             * @param {Function} eventListener
             */
            this.removeEventListener = function (eventName, eventListener) {
                this.event(eventName, "removeEventListener");
                var listeners = this.eventListeners[eventName];
                var i = 0;
                if (listeners) {
                    for (i = 0; i < listeners.length; i++) {
                        if (listeners[i] === eventListener) {
                            if (i < listeners.length - 1) {
                                listeners[i] = listeners[listeners.length - 1];
                            }
                            listeners.length = listeners.length - 1;
                        }
                    }
                }
            };
            /**
             * Emits an event, or in other words, calls all the eventListeners for a
             * particular event.
             * @param {String} eventName
             * @param {Object} eventData
             */
            this.emitEvent = function (eventName, eventData) {
                var event = new Event(eventName, "emitEvent");
                var listeners = this.eventListeners[eventName];
                var i = 0;
                if (listeners) {
                    for (i = 0; i < listeners.length; i++) {
                        listeners[i](eventName, eventData);
                    }
                }
            };
            /** @private */
            this.username = null;
            /** Flag to indicate that user is currently logging out */
            this.loggingOut = false;
            /** @private */
            this.disconnecting = false;
            /** @private */
            this.sessionFields = [];
            /** @private */
            this.receivedMediaConstraints = { offerToReceiveVideo: true, offerToReceiveAudio: true };
            /** @private */
            this.oldConfig = {};
            /** @private */
            this.offersPending = {};
            /** @private */
            this.credential = null;
            /** @private */
            this.audioEnabled = true;
            /** @private */
            this.videoEnabled = true;
            /** Your easyrtcid */
            this.myEasyrtcid = "";
            /** The height of the local media stream video in pixels. This field is set an indeterminate period
             * of time after easyrtc.initMediaSource succeeds. Note: in actuality, the dimensions of a video stream
             * change dynamically in response to external factors, you should check the videoWidth and videoHeight attributes
             * of your video objects before you use them for pixel specific operations.
             */
            this.nativeVideoHeight = 0;
            /** This constant determines how long (in bytes) a message can be before being split in chunks of that size.
             * This is because there is a limitation of the length of the message you can send on the
             * data channel between browsers.
             */
            this.maxP2PMessageLength = 1000;
            /** The width of the local media stream video in pixels. This field is set an indeterminate period
             * of time after easyrtc.initMediaSource succeeds.  Note: in actuality, the dimensions of a video stream
             * change dynamically in response to external factors, you should check the videoWidth and videoHeight attributes
             * of your video objects before you use them for pixel specific operations.
             */
            this.nativeVideoWidth = 0;
            /** The rooms the user is in. This only applies to room oriented applications and is set at the same
             * time a token is received.
             */
            this.roomJoin = {};
            /** @private */
            this._desiredAudioProperties = {}; // default camera
            /** This function is used to set the dimensions of the local camera, usually to get HD.
             *  If called, it must be called before calling easyrtc.initMediaSource (explicitly or implicitly).
             *  assuming it is supported. If you don't pass any parameters, it will use default camera dimensions.
             * @param {Number} width in pixels
             * @param {Number} height in pixels
             * @param {number} frameRate is optional
             * @example
             *    easyrtc.setVideoDims(1280,720);
             * @example
             *    easyrtc.setVideoDims();
             */
            this.setVideoDims = function (width, height, frameRate) {
                this._desiredVideoProperties.width = width;
                this._desiredVideoProperties.height = height;
                if (frameRate !== undefined) {
                    this._desiredVideoProperties.frameRate = frameRate;
                }
            };
            this._presetMediaConstraints = null;
            /** @private */
            this.dataEnabled = false;
            /** @private */
            this.serverPath = null; // this was null, but that was generating an error.
            /** @private */
            this.roomOccupantListener = null;
            /** @private */
            this.onDataChannelOpen = null;
            /** @private */
            this.onDataChannelClose = null;
            /** @private */
            this.lastLoggedInList = {};
            /** @private */
            this.receiveServerCB = null;
            /** @private */
            // dummy placeholder for when we aren't connected
            this.updateConfigurationInfo = function () { };
            this.peerConns = {};
            //
            // there can be multiple remoteStreamsPerCallId per easyrtcid, but not the other way around
            // of course.
            //
            this.callIdToEasyrtcid = {};
            /** @private */
            //
            // a map keeping track of whom we've requested a call with so we don't try to
            // call them a second time before they've responded.
            //
            this.acceptancePending = {};
            /** @private
             * @param caller
             * @param helper
             */
            this.acceptCheck = function (caller, helper) {
                helper(true);
            };
            /** @private
             * @param easyrtcid
             * @param stream
             */
            this.streamAcceptor = function (easyrtcid, stream, streamName) { return void {}; };
            /** @private
             * @param easyrtcid
             */
            this.onStreamClosed = function (easyrtcid) {
            };
            /** @private
             * @param easyrtcid
             */
            this.callCancelled = function (easyrtcid) {
            };
            this.roomEntryListener = null;
            /**
             * Returns the user assigned id's of currently active local media streams.
             * @return {Array}
             */
            this.getLocalMediaIds = function () {
                var mediaIds = [];
                for (var name_1 in this.localMediaStreams) {
                    mediaIds.push(this.localMediaStreams[name_1].id);
                }
                return mediaIds;
            };
            /**
             * This function is used to enable and disable the local microphone. If you disable
             * the microphone, sounds stops being transmitted to your peers. By default, the microphone
             * is enabled.
             * @param {Boolean} enable - true to enable the microphone, false to disable it.
             * @param {String} streamName - an optional streamName
             */
            this.enableMicrophone = function (enable, streamName) {
                var stream = this.getLocalMediaStream(streamName);
                if (stream && stream.getAudioTracks) {
                    MR.enableMediaTracks(enable, stream.getAudioTracks());
                }
            };
            /**
             * @private
             * @param {String} x
             */
            this.formatError = function (x) {
                if (x === null || typeof x === 'undefined') {
                    return "null";
                }
                if (typeof x === 'string') {
                    return x;
                }
                else if (x.type && x.description) {
                    return x.type + " : " + x.description;
                }
                else if (typeof x === 'object') {
                    try {
                        return JSON.stringify(x);
                    }
                    catch (oops) {
                        var result = "{";
                        for (var name_2 in x) {
                            if (x.hasOwnProperty(name_2)) {
                                if (typeof x[name_2] === 'string') {
                                    result = result + name_2 + "='" + x[name_2] + "' ";
                                }
                            }
                        }
                        result = result + "}";
                        return result;
                    }
                }
                else {
                    return "Strange case";
                }
            };
            /**
             * Sets the callCancelled callback. This will be called when a remote user
             * initiates a call to you, but does a "hangup" before you have a chance to get his video stream.
             * @param {Function} callCancelled takes an easyrtcid as an argument and a boolean that indicates whether
             *  the call was explicitly cancelled remotely (true), or actually accepted by the user attempting a call to
             *  the same party.
             * @example
             *     easyrtc.setCallCancelled( function(easyrtcid, explicitlyCancelled){
             *        if( explicitlyCancelled ){
             *            console.log(easyrtc.idToName(easyrtcid) + " stopped trying to reach you");
             *         }
             *         else{
             *            console.log("Implicitly called "  + easyrtc.idToName(easyrtcid));
             *         }
             *     });
             */
            this.setCallCancelled = function (callCancelled) {
                this.callCancelled = callCancelled;
            };
            /**  Sets a callback to receive notification of a media stream closing. The usual
             *  use of this is to clear the source of your video object so you aren't left with
             *  the last frame of the video displayed on it.
             *  @param {Function} onStreamClosed takes an easyrtcid as it's first parameter, the stream as it's second argument, and name of the video stream as it's third.
             *  @example
             *     easyrtc.setOnStreamClosed( function(easyrtcid, stream, streamName){
             *         easyrtc.setVideoObjectSrc( document.getElementById("callerVideo"), "");
             *         ( easyrtc.idToName(easyrtcid) + " closed stream " + stream.id + " " + streamName);
             *     });
             */
            this.setOnStreamClosed = function (onStreamClosed) {
                this.onStreamClosed = onStreamClosed;
            };
            this.disconnectListener = null;
            /** Value returned by easyrtc.getConnectStatus if the other user isn't connected to us. */
            this.NOT_CONNECTED = "not connected";
            /** Value returned by easyrtc.getConnectStatus if the other user is in the process of getting connected */
            this.BECOMING_CONNECTED = "connection in progress to us.";
            /** Value returned by easyrtc.getConnectStatus if the other user is connected to us. */
            this.IS_CONNECTED = "is connected";
            /**
             * Hangs up on all current connections.
             * @example
             *    easyrtc.hangupAll();
             */
            this.hangupAll = function () {
                for (var otherUser in this.peerConns) {
                    if (!this.peerConns.hasOwnProperty(otherUser)) {
                        continue;
                    }
                    this.callControl.endCall(otherUser);
                }
            };
            /**
             * The idea of aggregating timers is that there are events that convey state and these can fire more frequently
             * than desired. Aggregating timers allow a bunch of events to be collapsed into one by only firing the last
             * event.
             * @private
             */
            this.aggregatingTimers = {};
        }
        Easyrtc.prototype.setDebugPrinter = function (printMethod) {
            this.debugPrinter = printMethod;
        };
        // change this to accept variadic arguments.
        Easyrtc.prototype.debugOut = function () {
            var message = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                message[_i - 0] = arguments[_i];
            }
            if (this.debugPrinter) {
                this.debugPrinter(message);
            }
        };
        Easyrtc.prototype.isEmptyObj = function (obj) {
            if (obj === null || obj === undefined) {
                return true;
            }
            var key;
            for (key in obj) {
                if (obj.hasOwnProperty(key)) {
                    return false;
                }
            }
            return true;
        };
        /** @private */
        //
        // this function replaces the deprecated MediaStream.stop method
        //
        Easyrtc.prototype.stopStream = function (stream) {
            MR.StopStream(stream);
        };
        /**
         * Sets functions which filter sdp records before calling setLocalDescription or setRemoteDescription.
         * This is advanced functionality which can break things, easily. See the easyrtc_rates.js file for a
         * filter builder.
         * @param {Function} localFilter a function that takes an sdp string and returns an sdp string.
         * @param {Function} remoteFilter a function that takes an sdp string and returns an sdp string.
         */
        Easyrtc.prototype.setSdpFilters = function (localFilter, remoteFilter) {
            this.callControl.SetSdpLocalFilter(localFilter);
            this.callControl.SetSdpRemoteFilter(remoteFilter);
        };
        ;
        /**
         * Sets a function to warn about the peer connection closing.
         *  @param {Function} handler: a function that gets an easyrtcid as an argument.
         */
        Easyrtc.prototype.setPeerClosedListener = function (handler) {
            this.onPeerClosed = handler;
        };
        ;
        /**
         * Sets a function to receive warnings about the peer connection
         * failing. The peer connection may recover by itthis.
         *  @param {Function} failingHandler: a function that gets an easyrtcid as an argument.
         *  @param {Function} recoveredHandler: a function that gets an easyrtcid as an argument.
         */
        Easyrtc.prototype.setPeerFailingListener = function (failingHandler, recoveredHandler) {
            this.onPeerFailing = failingHandler;
            this.onPeerRecovered = recoveredHandler;
        };
        ;
        /**
         * Sets a function which filters IceCandidate records being sent or received.
         *
         * Candidate records can be received while they are being generated locally (before being
         * sent to a peer), and after they are received by the peer. The filter receives two arguments, the candidate record and a boolean
         * flag that is true for a candidate being received from another peer,
         * and false for a candidate that was generated locally. The candidate record has the form:
         *  {type: 'candidate', label: sdpMLineIndex, id: sdpMid, candidate: candidateString}
         * The function should return one of the following: the input candidate record, a modified candidate record, or null (indicating that the
         * candidate should be discarded).
         * @param {Function} filter
         */
        Easyrtc.prototype.setIceCandidateFilter = function (filter) {
            this.callControl.SetCustomIceFilter(filter);
        };
        ;
        /**
         * This function checks if a socket is actually connected.
         * @private
         * @param {Object} socket a socket.io socket.
         * @return true if the socket exists and is connected, false otherwise.
         */
        Easyrtc.prototype.isSocketConnected = function (socket) {
            return socket && ((socket.socket && socket.socket.connected) || socket.connected);
        };
        /**
         * TODO: change change to validEventCheck
         * This function checks if an attempt was made to add an event listener or
         * or emit an unlisted event, since such is typically a typo.
         * @private
         * @param {String} eventName
         * @param {String} callingFunction the name of the calling function.
         */
        Easyrtc.prototype.event = function (eventName, callingFunction) {
            if (typeof eventName !== 'string') {
                this.showError(this.errCodes.DEVELOPER_ERR, callingFunction + " called without a string as the first argument");
                throw "developer error";
            }
            if (!this.allowedEvents[eventName]) {
                this.showError(this.errCodes.DEVELOPER_ERR, callingFunction + " called with a bad event name = " + eventName);
                throw "developer error";
            }
        };
        /**
         * Adds an event listener for a particular type of event.
         * Currently the only eventName supported is "roomOccupant".
         * @param {String} eventName the type of the event
         * @param {Function} eventListener the function that expects the event.
         * The eventListener gets called with the eventName as it's first argument, and the event
         * data as it's second argument.
         * @returns {void}
         */
        Easyrtc.prototype.addEventListener = function (eventName, eventListener) {
            this.event(eventName, "addEventListener");
            if (typeof eventListener !== 'function') {
                this.showError(this.errCodes.DEVELOPER_ERR, "addEventListener called with a non-function for second argument");
                throw "developer error";
            }
            //
            // remove the event listener if it's already present so we don't end up with two copies
            //
            this.removeEventListener(eventName, eventListener);
            this.eventListeners[eventName] = this.eventListeners[eventName] || [];
            this.eventListeners[eventName].push(eventListener);
        };
        ;
        /**
         * Control whether the client requests audio from a peer during a call.
         * Must be called before the call to have an effect.
         * @param value - true to receive audio, false otherwise. The default is true.
         */
        Easyrtc.prototype.enableAudioReceive = function (value) {
            this.receiveAudioEnabled = value;
        };
        ;
        /**
         * Control whether the client requests video from a peer during a call.
         * Must be called before the call to have an effect.
         * @param value - true to receive video, false otherwise. The default is true.
         */
        Easyrtc.prototype.enableVideoReceive = function (value) {
            this.receiveVideoEnabled = value;
        };
        ;
        /**
         * Sets the audio output device of a Video object.
         * That is to say, this controls what speakers get the sound.
         * In theory, this works on Chrome but probably doesn't work anywhere else yet.
         * This code was cribbed from https://webrtc.github.io/samples/src/content/devices/multi/.
         *  @param {Object} element an HTML5 video element
         *  @param {String} sinkId a deviceid from getAudioSinkList
         */
        Easyrtc.prototype.setAudioOutput = function (element, sinkId) {
            if (typeof element["sinkId"] !== 'undefined') {
                element["setSinkId"](sinkId)
                    .then(function () {
                    this.debugOut('Success, audio output device attached: ' + sinkId + ' to ' +
                        'element with ' + element.title + ' as source.');
                })
                    .catch(function (error) {
                    var errorMessage = error.message;
                    if (error.name === 'SecurityError') {
                        errorMessage = 'You need to use HTTPS for selecting audio output ' +
                            'device: ' + error;
                    }
                    this.debugOut(errorMessage);
                });
            }
            else {
                this.debugOut("Browser does not support output device selection.");
            }
        };
        /**
         * Gets a list of the available audio sinks (ie, speakers)
         * @param {Function} callback receives list of {deviceId:String, groupId:String, label:String, kind:"audio"}
         * @example  easyrtc.getAudioSinkList( function(list) {
         *               var i;
         *               for( i = 0; i < list.length; i++ ) {
         *                   console.log("label=" + list[i].label + ", id= " + list[i].deviceId);
         *               }
         *          });
         */
        Easyrtc.prototype.getAudioSinkList = function (callback) {
            MR.GetSpeakerList().then(function (devices) {
                callback(devices);
            }, function (error) {
                callback(null);
            });
        };
        /**
         * Gets a list of the available audio sources (ie, microphones)
         * @param {Function} callback receives list of {deviceId:String, groupId:String, label:String, kind:"audio"}
         * @example  easyrtc.getAudioSourceList( function(list) {
         *               var i;
         *               for( i = 0; i < list.length; i++ ) {
         *                   console.log("label=" + list[i].label + ", id= " + list[i].deviceId);
         *               }
         *          });
         */
        Easyrtc.prototype.getAudioSourceList = function (callback) {
            MR.GetMicrophoneList().then(function (devices) {
                callback(devices);
            }, function (error) {
                callback(null);
            });
        };
        /**
         * Gets a list of the available video sources (ie, cameras)
         * @param {Function} callback receives list of {deviceId:String, groupId:String, label:String, kind:"video"}
         * @example  easyrtc.getVideoSourceList( function(list) {
         *               var i;
         *               for( i = 0; i < list.length; i++ ) {
         *                   console.log("label=" + list[i].label + ", id= " + list[i].deviceId);
         *               }
         *          });
         */
        Easyrtc.prototype.getVideoSourceList = function (callback) {
            MR.GetCameraList().then(function (devices) {
                callback(devices);
            }, function (error) {
                callback(null);
            });
        };
        ;
        /** Checks if the supplied string is a valid user name (standard identifier rules)
         * @param {String} name
         * @return {Boolean} true for a valid user name
         * @example
         *    var name = document.getElementById('nameField').value;
         *    if( !easyrtc.isNameValid(name)){
         *        console.error("Bad user name");
         *    }
         */
        Easyrtc.prototype.isNameValid = function (name) {
            return Easyrtc.usernameRegExp.test(name);
        };
        ;
        /**
         * This function sets the name of the cookie that client side library will look for
         * and transmit back to the server as it's easyrtcsid in the first message.
         * @param {String} cookieId
         */
        Easyrtc.prototype.setCookieId = function (cookieId) {
            // TODO: figure out what to do with cookie support
            // this.cookieId = cookieId;
        };
        ;
        /**
         * Specify particular video source. Call this before you call easyrtc.initMediaSource().
         * @param {String} videoSrcId is a id value from one of the entries fetched by getVideoSourceList. null for default.
         * @example easyrtc.setVideoSource( videoSrcId);
         */
        Easyrtc.prototype.setVideoSource = function (videoSrcId) {
            this._desiredVideoProperties.deviceId = videoSrcId;
        };
        ;
        /**
         * Specify particular video source. Call this before you call easyrtc.initMediaSource().
         * @param {String} audioSrcId is a id value from one of the entries fetched by getAudioSourceList. null for default.
         * @example easyrtc.setAudioSource( audioSrcId);
         */
        Easyrtc.prototype.setAudioSource = function (audioSrcId) {
            this._desiredAudioProperties.deviceId = audioSrcId;
        };
        ;
        /** Set the application name. Applications can only communicate with other applications
         * that share the same API Key and application name. There is no predefined set of application
         * names. Maximum length is
         * @param {String} name
         * @example
         *    easyrtc.setApplicationName('simpleAudioVideo');
         */
        Easyrtc.prototype.setApplicationName = function (name) {
            this.applicationName = name;
        };
        ;
        /** Enable or disable logging to the console.
         * Note: if you want to control the printing of debug messages, override the
         *    easyrtc.debugPrinter variable with a function that takes a message string as it's argument.
         *    This is exactly what easyrtc.enableDebug does when it's enable argument is true.
         * @param {Boolean} enable - true to turn on debugging, false to turn off debugging. Default is false.
         * @example
         *    easyrtc.enableDebug(true);
         */
        Easyrtc.prototype.enableDebug = function (enable) {
            if (enable) {
                this.setDebugPrinter(function (message) {
                    var now = new Date().toISOString();
                    var stackString = new Error().stack;
                    var srcLine = "location unknown";
                    if (stackString) {
                        var stackFrameStrings = stackString.split('\n');
                        srcLine = "";
                        if (stackFrameStrings.length >= 5) {
                            srcLine = stackFrameStrings[4];
                        }
                    }
                    console.log("debug " + now + " : " + message + " [" + srcLine + "]");
                });
            }
            else {
                this.debugPrinter = null;
            }
        };
        ;
        /**
         * Determines if the local browser supports WebRTC GetUserMedia (access to camera and microphone).
         * @returns {Boolean} True getUserMedia is supported.
         */
        Easyrtc.prototype.supportsGetUserMedia = function () {
            return MR.supportsGetUserMedia();
        };
        ;
        /**
         * Determines if the local browser supports WebRTC Peer connections to the extent of being able to do video chats.
         * @returns {Boolean} True if Peer connections are supported.
         */
        Easyrtc.prototype.supportsPeerConnections = function () {
            return CCC.supportsPeerConnections();
        };
        ;
        /** Determines whether the current browser supports the new data channels.
         * EasyRTC will not open up connections with the old data channels.
         * @returns {Boolean}
         */
        Easyrtc.prototype.supportsDataChannels = function () {
            return CCC.supportsDataChannels();
        };
        ;
        /** @private */
        //
        // Experimental function to determine if statistics gathering is supported.
        //
        Easyrtc.prototype.supportsStatistics = function () {
            return CCC.supportsStatistics();
        };
        ;
        /**
         * This function gets the raw RTCPeerConnection for a given easyrtcid. If there are more than one, returns the first.
         * @param {String} easyrtcid
         * @param {RTCPeerConnection} for that easyrtcid, or null if no connection exists
         * Submitted by Fabian Bernhard.
         */
        //       public getPeerConnectionByUserId(easyrtcid:string):RTCPeerConnection {
        // TODO:
        //            let peerconns:RTCPeerConnection[] = this.getPeerConnectionsByUserId(easyrtcid);
        //            if( peerConns.length >0) {
        //                return peerConns[0];
        //            }
        //            else {
        //                return null;
        //            }
        //        };
        /**
         * Returns the list of RTCPeerConnections associated with a given easyrtcid.
         * @param userId
         * @returns {RTCPeerConnection[]}
         */
        // public getPeerConnectionsByUserId(userId:string):RTCPeerConnection {
        //     let peerconns:RTCPeerConnection[] = [];
        //     if (peerConns && peerConns[userId]) {
        //         for( let callId of this.peerConns[userId].remoteStreamsPerCallId ) {
        //             let item: RTCPeerConnection = this.callControl.getPeerConnection(callId);
        //             if( item) {
        //                 peerconns.push(item);
        //             }
        //         }
        //     }
        //     return peerconns;
        // };
        /**
         * This function gets the statistics for a particular peer connection.
         * var count = 0;
         var i;
         for (i in this.peerConns) {
                    if (peerConns.hasOwnProperty(i)) {
                        if (this.getConnectStatus(i) === this.IS_CONNECTED) {
                            count++;
                        }
                    }
                }
         return count;
         * @param {String} easyrtcid
         * @param {Function} callback gets the easyrtcid for the peer and a map of {userDefinedKey: value}. If there is no peer connection to easyrtcid, then the map will
         *  have a value of {connected:false}.
         * @param {Object} filter depends on whether Chrome or Firefox is used. See the default filters for guidance.
         * It is still experimental.
         */
        // public getPeerStatistics = function(easyrtcid:string, callback:StatsCallback, filter:any) {
        //     if( !peerConns[easyrtcid]) {
        //         return;
        //     }
        //
        //     for( let callid of this.peerConns[easyrtcid].remoteStreamsPerCallId)
        //     {
        //         let f = (results: {[key:string]:any})=>{
        //             callback(easyrtcid, results);
        //         }
        //         if( typeof filter === "undefined") {
        //             this.callControl.getStatistics(callId).then( f, (error:Error)=>{});
        //         }
        //         else {
        //             this.callControl.getRawStatistics(callId).then( f, (error:Error)=>{});
        //         }
        //     }
        // };
        /** Provide a set of application defined fields that will be part of this instances
         * configuration information. This data will get sent to other peers via the websocket
         * path.
         * @param {String} roomName - the room the field is attached to.
         * @param {String} fieldName - the name of the field.
         * @param {Object} fieldValue - the value of the field.
         * @example
         *   easyrtc.setRoomApiField("trekkieRoom",  "favorite_alien", "Mr Spock");
         *   easyrtc.setRoomOccupantListener( function(roomName, list){
         *      for( var i in list ){
         *         console.log("easyrtcid=" + i + " favorite alien is " + list[i].apiFields.favorite_alien);
         *      }
         *   });
         */
        Easyrtc.prototype.setRoomApiField = function (roomName, fieldName, fieldValue) {
            // TODO:
        };
        ;
        /**
         * Default error reporting function. The default implementation displays error messages
         * in a programmatically created div with the id easyrtcErrorDialog. The div has title
         * component with a class name of easyrtcErrorDialog_title. The error messages get added to a
         * container with the id easyrtcErrorDialog_body. Each error message is a text node inside a div
         * with a class of easyrtcErrorDialog_element. There is an "okay" button with the className of easyrtcErrorDialog_okayButton.
         * @param {String} messageCode An error message code
         * @param {String} message the error message text without any markup.
         * @example
         *     easyrtc.showError("BAD_NAME", "Invalid username");
         */
        Easyrtc.prototype.showError = function (messageCode, message) {
            this.onError({ errorCode: messageCode, errorText: message });
        };
        /**
         * @private
         * @param errorObject
         */
        Easyrtc.prototype.onError = function (errorObject) {
            this.debugOut("saw error " + errorObject.errorText);
            var errorDiv = document.getElementById('easyrtcErrorDialog');
            var errorBody;
            if (!errorDiv) {
                errorDiv = document.createElement("div");
                errorDiv.id = 'easyrtcErrorDialog';
                var title = document.createElement("div");
                title.innerHTML = "Error messages";
                title.className = "easyrtcErrorDialog_title";
                errorDiv.appendChild(title);
                errorBody = document.createElement("div");
                errorBody.id = "easyrtcErrorDialog_body";
                errorDiv.appendChild(errorBody);
                var clearButton = document.createElement("button");
                clearButton.appendChild(document.createTextNode("Okay"));
                clearButton.className = "easyrtcErrorDialog_okayButton";
                clearButton.onclick = function () {
                    errorBody.innerHTML = ""; // remove all inner nodes
                    errorDiv.style.display = "none";
                };
                errorDiv.appendChild(clearButton);
                document.body.appendChild(errorDiv);
            }
            errorBody = document.getElementById("easyrtcErrorDialog_body");
            var messageNode = document.createElement("div");
            messageNode.className = 'easyrtcErrorDialog_element';
            messageNode.appendChild(document.createTextNode(errorObject.errorText));
            errorBody.appendChild(messageNode);
            errorDiv.style.display = "block";
        };
        ;
        /**
         * A convenience function to ensure that a string doesn't have symbols that will be interpreted by HTML.
         * @param {String} idString
         * @return {String} The cleaned string.
         * @example
         *   console.log( easyrtc.cleanId('&hello'));
         */
        Easyrtc.prototype.cleanId = function (idString) {
            var MAP = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;'
            };
            return idString.replace(/[&<>]/g, function (c) {
                return MAP[c];
            });
        };
        ;
        /**
         * Set a callback that will be invoked when the application enters or leaves a room.
         * @param {Function} handler - the first parameter is true for entering a room, false for leaving a room. The second parameter is the room name.
         * @example
         *   easyrtc.setRoomEntryListener(function(entry, roomName){
         *       if( entry ){
         *           console.log("entering room " + roomName);
         *       }
         *       else{
         *           console.log("leaving room " + roomName);
         *       }
         *   });
         */
        Easyrtc.prototype.setRoomEntryListener = function (handler) {
            this.roomEntryListener = handler;
        };
        ;
        /**
         * Set the callback that will be invoked when the list of people logged in changes.
         * The callback expects to receive a room name argument, and
         * a map whose ideas are easyrtcids and whose values are in turn maps
         * supplying user specific information. The inner maps have the following keys:
         * username, applicationName, browserFamily, browserMajor, osFamily, osMajor, deviceFamily.
         * The third argument to the listener is the innerMap for the connections own data (not needed by most applications).
         * @param {Function} listener
         * @example
         *   easyrtc.setRoomOccupantListener( function(roomName, list, selfInfo){
         *      for( var i in list ){
         *         ("easyrtcid=" + i + " belongs to user " + list[i].username);
         *      }
         *   });
         */
        Easyrtc.prototype.setRoomOccupantListener = function (listener) {
            this.roomOccupantListener = listener;
        };
        ;
        /**
         * Sets a callback that is called when a data channel is open and ready to send data.
         * The callback will be called with an easyrtcid as it's sole argument.
         * @param {Function} listener
         * @example
         *    easyrtc.setDataChannelOpenListener( function(easyrtcid){
         *         easyrtc.sendDataP2P(easyrtcid, "greeting", "hello");
         *    });
         */
        Easyrtc.prototype.setDataChannelOpenListener = function (listener) {
            this.onDataChannelOpen = listener;
        };
        ;
        /** Sets a callback that is called when a previously open data channel closes.
         * The callback will be called with an easyrtcid as it's sole argument.
         * @param {Function} listener
         * @example
         *    easyrtc.setDataChannelCloseListener( function(easyrtcid){
         *            ("No longer connected to " + easyrtc.idToName(easyrtcid));
         *    });
         */
        Easyrtc.prototype.setDataChannelCloseListener = function (listener) {
            this.onDataChannelClose = listener;
        };
        ;
        /** Returns the number of live peer connections the client has.
         * @return {Number}
         * @example
         *    ("You have " + easyrtc.getConnectionCount() + " peer connections");
         */
        Easyrtc.prototype.getConnectionCount = function () {
            if (this.callControl) {
                return this.callControl.GetCallCount();
            }
            else {
                return 0;
            }
        };
        ;
        /** Sets the maximum length in bytes of P2P messages that can be sent.
         * @param {Number} maxLength maximum length to set
         * @example
         *     easyrtc.setMaxP2PMessageLength(10000);
         */
        Easyrtc.prototype.setMaxP2PMessageLength = function (maxLength) {
            //         this.maxP2PMessageLength = maxLength;
        };
        ;
        /** Sets whether audio is transmitted by the local user in any subsequent calls.
         * @param {Boolean} enabled true to include audio, false to exclude audio. The default is true.
         * @example
         *      easyrtc.enableAudio(false);
         */
        Easyrtc.prototype.enableAudio = function (enabled) {
            this.audioEnabled = enabled;
        };
        ;
        /**
         *Sets whether video is transmitted by the local user in any subsequent calls.
         * @param {Boolean} enabled - true to include video, false to exclude video. The default is true.
         * @example
         *      easyrtc.enableVideo(false);
         */
        Easyrtc.prototype.enableVideo = function (enabled) {
            this.videoEnabled = enabled;
        };
        ;
        /**
         * Sets whether WebRTC data channels are used to send inter-client messages.
         * This is only the messages that applications explicitly send to other applications, not the WebRTC signaling messages.
         * @param {Boolean} enabled  true to use data channels, false otherwise. The default is false.
         * @example
         *     easyrtc.enableDataChannels(true);
         */
        Easyrtc.prototype.enableDataChannels = function (enabled) {
            this.dataEnabled = enabled;
        };
        ;
        /**
         * @private
         * @param {Boolean} enable
         * @param {Array} tracks - an array of MediaStreamTrack
         */
        Easyrtc.prototype.enableMediaTracks = function (enable, tracks) {
            MR.enableMediaTracks(enable, tracks);
        };
        /** @private */
        //
        // fetches a stream by name. Treat a null/undefined streamName as "default".
        //
        Easyrtc.prototype.getLocalMediaStreamByName = function (streamName) {
            if (!streamName) {
                streamName = "default";
            }
            if (this.localMediaStreams.hasOwnProperty(streamName)) {
                return this.localMediaStreams[streamName];
            }
            else {
                return null;
            }
        };
        /**
         * Allow an externally created mediastream (ie, created by another
         * library) to be used within easyrtc. Tracking when it closes
         * must be done by the supplying party.
         */
        Easyrtc.prototype.register3rdPartyLocalMediaStream = function (stream, streamName) {
            this.localMediaStreams[streamName] = stream;
        };
        ;
        Easyrtc.prototype.getNameOfRemoteStream = function (easyrtcId, webrtcStream) {
            var streamId;
            if (typeof (webrtcStream) == "string") {
                streamId = webrtcStream;
            }
            else if (typeof (webrtcStream) == "object" && webrtcStream.hasOwnProperty("id")) {
                streamId = webrtcStream.id;
            }
            else {
                return "default";
            }
            if (!this.peerConns[easyrtcId]) {
                return null;
            }
            else {
                return this.peerConns[easyrtcId].remoteStreamIdToName[streamId];
            }
        };
        ;
        /**
         * Close the local media stream. You usually need to close the existing media stream
         * of a camera before reacquiring it at a different resolution.
         * @param {String} streamName - an option stream name.
         */
        Easyrtc.prototype.closeLocalStream = function (streamName) {
            var stream = this.getLocalMediaStreamByName(streamName);
            if (stream) {
                MR.StopStream(stream);
                delete this.localMediaStreams[streamName];
            }
        };
        ;
        /**
         * This function is used to enable and disable the local camera. If you disable the
         * camera, video objects which display it will "freeze" until the camera is re-enabled. *
         * By default, a camera is enabled.
         * @param {Boolean} enable - true to enable the camera, false to disable it.
         * @param {String} streamName - the name of the stream, optional.
         */
        Easyrtc.prototype.enableCamera = function (enable, streamName) {
            var stream = this.getLocalMediaStreamByName(streamName);
            if (stream && stream.getVideoTracks) {
                MR.enableMediaTracks(enable, stream.getVideoTracks());
            }
        };
        ;
        /**
         * Mute a video object.
         * @param {String} videoObjectName - A DOMObject or the id of the DOMObject.
         * @param {Boolean} mute - true to mute the video object, false to unmute it.
         */
        Easyrtc.prototype.muteVideoObject = function (videoObjectName, mute) {
            var videoObject;
            if (typeof (videoObjectName) === 'string') {
                videoObject = document.getElementById(videoObjectName);
                if (!videoObject) {
                    throw "Unknown video object " + videoObjectName;
                }
            }
            else if (!videoObjectName) {
                throw "muteVideoObject passed a null";
            }
            else {
                videoObject = videoObjectName;
            }
            videoObject.muted = !!mute;
        };
        ;
        /**
         * Returns a URL for your local camera and microphone.
         *  It can be called only after easyrtc.initMediaSource has succeeded.
         *  It returns a url that can be used as a source by the Chrome video element or the &lt;canvas&gt; element.
         *  @param {String} streamName - an option stream name.
         *  @return {URL}
         *  @example
         *      document.getElementById("myVideo").src = easyrtc.getLocalStreamAsUrl();
         */
        Easyrtc.prototype.getLocalStreamAsUrl = function (streamName) {
            var stream = this.getLocalMediaStreamByName(streamName);
            if (stream === null) {
                throw "Developer error: attempt to get a MediaStream without invoking easyrtc.initMediaSource successfully";
            }
            return MR.createObjectURL(stream);
        };
        ;
        /**
         * Returns a media stream for your local camera and microphone.
         *  It can be called only after easyrtc.initMediaSource has succeeded.
         *  It returns a stream that can be used as an argument to easyrtc.setVideoObjectSrc.
         *  Returns null if there is no local media stream acquired yet.
         * @return {?MediaStream}
         * @example
         *    easyrtc.setVideoObjectSrc( document.getElementById("myVideo"), easyrtc.getLocalStream());
         */
        Easyrtc.prototype.getLocalStream = function (streamName) {
            return this.localMediaStreams[streamName || "default"] || null;
        };
        /** Clears the media stream on a video object.
         *
         * @param {Object} element the video object.
         * @example
         *    easyrtc.clearMediaStream( document.getElementById('selfVideo'));
         *
         */
        Easyrtc.prototype.clearMediaStream = function (element) {
            MR.ClearMediaStream(element);
        };
        /**
         *  Sets a video or audio object from a media stream.
         *  Chrome uses the src attribute and expects a URL, while firefox
         *  uses the mozSrcObject and expects a stream. This procedure hides
         *  that from you.
         *  If the media stream is from a local webcam, you may want to add the
         *  easyrtcMirror class to the video object so it looks like a proper mirror.
         *  The easyrtcMirror class is defined in this.css.
         *  Which is could be added using the same path of easyrtc.js file to an HTML file
         *  @param {Object} element an HTML5 video element
         *  @param {MediaStream|String} stream a media stream as returned by easyrtc.getLocalStream or your stream acceptor.
         * @example
         *    easyrtc.setVideoObjectSrc( document.getElementById("myVideo"), easyrtc.getLocalStream());
         *
         */
        Easyrtc.prototype.setVideoObjectSrc = function (element, stream) {
            MR.SetVideoObjectSrc(element, stream);
        };
        /**
         * This function builds a new named local media stream from a set of existing audio and video tracks from other media streams.
         * @param {String} streamName is the name of the new media stream.
         * @param {Array} audioTracks is an array of MediaStreamTracks
         * @param {Array} videoTracks is an array of MediaStreamTracks
         * @returns {?MediaStream} the track created.
         * @example
         *    easyrtc.buildLocalMediaStream("myComposedStream",
         *             easyrtc.getLocalStream("camera1").getVideoTracks(),
         *             easyrtc.getLocalStream("camera2").getAudioTracks());
         */
        Easyrtc.prototype.buildLocalMediaStream = function (streamName, audioTracks, videoTracks) {
            var template = null;
            if (window["MediaStream"]) {
                template = new MediaStream();
            }
            if (!template) {
                for (var someName in this.localMediaStreams) {
                    template = this.localMediaStreams[someName];
                    break;
                }
            }
            if (!template) {
                for (var easyrtcid in this.peerConns) {
                    for (var callId in this.peerConns[easyrtcid].remoteStreamsPerCallId) {
                        for (var streamName_1 in this.peerConns[easyrtcid].remoteStreamsPerCallId[callId]) {
                            template = this.peerConns[easyrtcid].remoteStreamsPerCallId[callId][streamName_1];
                            break;
                        }
                        if (template)
                            break;
                    }
                    if (template)
                        break;
                }
            }
            if (template) {
                return MR.buildLocalMediaStream(streamName, audioTracks, videoTracks, template);
            }
            else {
                throw "Developer error: no stream (local or remote) to use as a template for building a new stream";
            }
        };
        /* @private*/
        /** Load Easyrtc Stylesheet.
         *   Easyrtc Stylesheet define easyrtcMirror class and some basic css class for using easyrtc.js.
         *   That way, developers can override it or use it's own css file minified css or package.
         * @example
         *       easyrtc.loadStylesheet();
         *
         */
        Easyrtc.prototype.loadStylesheet = function () {
            //
            // check to see if we already have an easyrtc.css file loaded
            // if we do, we can exit immediately.
            //
            var links = document.getElementsByTagName("link");
            for (var cssIndex in links) {
                if (links.hasOwnProperty(cssIndex)) {
                    var css = links[cssIndex];
                    if (css.href && (css.href.match(/\/easyrtc.css/))) {
                        return;
                    }
                }
            }
            //
            // add the easyrtc.css file since it isn't present
            //
            var easySheet = document.createElement("link");
            easySheet.setAttribute("rel", "stylesheet");
            easySheet.setAttribute("type", "text/css");
            easySheet.setAttribute("href", "/easyrtc/easyrtc.css");
            var headSection = document.getElementsByTagName("head")[0];
            var firstHead = headSection.childNodes[0];
            headSection.insertBefore(easySheet, firstHead);
        };
        ;
        /**
         * Initializes your access to a local camera and microphone.
         * Failure could be caused a browser that didn't support WebRTC, or by the user not granting permission.
         * If you are going to call easyrtc.enableAudio or easyrtc.enableVideo, you need to do it before
         * calling easyrtc.initMediaSource.
         * @param {function(Object)} successCallback - will be called with localmedia stream on success.
         * @param {function(String,String)} errorCallback - is called with an error code and error description.
         * @param {String} streamName - an optional name for the media source so you can use multiple cameras and
         * screen share simultaneously.
         * @example
         *       easyrtc.initMediaSource(
         *          function(mediastream){
         *              easyrtc.setVideoObjectSrc( document.getElementById("mirrorVideo"), mediastream);
         *          },
         *          function(errorCode, errorText){
         *               easyrtc.showError(errorCode, errorText);
         *          });
         */
        Easyrtc.prototype.initMediaSource = function (successCallback, errorCallback, streamName) {
            this.debugOut("about to request local media");
            if (!streamName) {
                streamName = "default";
            }
            this.haveAudioVideo = {
                audio: this.audioEnabled,
                video: this.videoEnabled
            };
            if (!errorCallback) {
                errorCallback = function (errorCode, errorText) {
                    var message = "easyrtc.initMediaSource: " + this.formatError(errorText);
                    this.debugOut(message);
                    this.showError(this.errCodes.MEDIA_ERR, message);
                };
            }
            var a;
            if (!successCallback) {
                this.showError(this.errCodes.DEVELOPER_ERR, "easyrtc.initMediaSource not supplied a successCallback");
                return;
            }
            //  var mode = this.getUserMediaConstraints();
            /** @private
             * @param {Object} stream - A mediaStream object.
             *  */
            var self = this;
            function assignStream(m) {
                self.localMediaStreams[streamName] = m;
                MR.GetResolutionOfMediaStream(m).then(function (videoAttribs) {
                    self.nativeVideoHeight = videoAttribs.height;
                    self.nativeVideoWidth = videoAttribs.width;
                    if (self._desiredVideoProperties && (self._desiredVideoProperties.height &&
                        (self.nativeVideoHeight !== self._desiredVideoProperties.height ||
                            self.nativeVideoWidth !== self._desiredVideoProperties.width))) {
                        self.showError(self.errCodes.MEDIA_WARNING, self.format(self.getConstantString("resolutionWarning"), " " + self._desiredVideoProperties.width, " " + self._desiredVideoProperties.height, " " + self.nativeVideoWidth, " " + self.nativeVideoHeight));
                    }
                    successCallback(m);
                }, function (error) {
                    self.showError(self.errCodes.MEDIA_WARNING, self.format(self.getConstantString("resolutionWarning"), "" + (self._desiredVideoProperties ? self._desiredVideoProperties.width : 640), "" + (self._desiredVideoProperties ? self._desiredVideoProperties.height : 480), "unavailable", "unavailable"));
                    successCallback(m);
                });
            }
            function invokeError(error) {
                errorCallback(self.errCodes.MEDIA_ERR, self.format(self.getConstantString("gumFailed"), error.message));
            }
            MR.AllocateMediaStream(this.haveAudioVideo).then(assignStream, invokeError);
        };
        /**
         * Sets the callback used to decide whether to accept or reject an incoming call.
         * @param {Function} acceptCheck takes the arguments (callerEasyrtcid, acceptor).
         * The acceptCheck callback is passed an easyrtcid and an acceptor function. The acceptor function should be called with either
         * a true value (accept the call) or false value( reject the call) as it's first argument, and optionally,
         * an array of local media streamNames as a second argument.
         * @example
         *      easyrtc.setAcceptChecker( function(easyrtcid, acceptor){
         *           if( easyrtc.idToName(easyrtcid) === 'Fred' ){
         *              acceptor(true);
         *           }
         *           else if( easyrtc.idToName(easyrtcid) === 'Barney' ){
         *              setTimeout( function(){
         acceptor(true, ['myOtherCam']); // myOtherCam presumed to a streamName
         }, 10000);
         *           }
         *           else{
         *              acceptor(false);
         *           }
         *      });
         */
        Easyrtc.prototype.setAcceptChecker = function (acceptCheck) {
            // this.acceptCheck = acceptCheck;
        };
        ;
        /**
         * easyrtc.setStreamAcceptor sets a callback to receive media streams from other peers, independent
         * of where the call was initiated (caller or callee).
         * @param {Function} acceptor takes arguments (caller, mediaStream, mediaStreamName)
         * @example
         *  easyrtc.setStreamAcceptor(function(easyrtcid, stream, streamName){
         *     document.getElementById('callerName').innerHTML = easyrtc.idToName(easyrtcid);
         *     easyrtc.setVideoObjectSrc( document.getElementById("callerVideo"), stream);
         *  });
         */
        Easyrtc.prototype.setStreamAcceptor = function (acceptor) {
            this.streamAcceptor = acceptor;
        };
        ;
        /** Sets the easyrtc.onError field to a user specified function.
         * @param {Function} errListener takes an object of the form {errorCode: String, errorText: String}
         * @example
         *    easyrtc.setOnError( function(errorObject){
         *        document.getElementById("errMessageDiv").innerHTML += errorObject.errorText;
         *    });
         */
        Easyrtc.prototype.setOnError = function (errListener) {
            this.onError = errListener;
        };
        ;
        /**
         * Sets a listener for data sent from another client (either peer to peer or via websockets).
         * If no msgType or source is provided, the listener applies to all events that aren't otherwise handled.
         * If a msgType but no source is provided, the listener applies to all messages of that msgType that aren't otherwise handled.
         * If a msgType and a source is provided, the listener applies to only message of the specified type coming from the specified peer.
         * The most specific case takes priority over the more general.
         * @param {Function} listener has the signature (easyrtcid, msgType, msgData, targeting).
         *   msgType is a string. targeting is null if the message was received using WebRTC data channels, otherwise it
         *   is an object that contains one or more of the following string valued elements {targetEasyrtcid, targetGroup, targetRoom}.
         * @param {String} msgType - a string, optional.
         * @param {String} source - the sender's easyrtcid, optional.
         * @example
         *     easyrtc.setPeerListener( function(easyrtcid, msgType, msgData, targeting){
         *         console.log("From " + easyrtc.idToName(easyrtcid) +
         *             " sent the following data " + JSON.stringify(msgData));
         *     });
         *     easyrtc.setPeerListener( function(easyrtcid, msgType, msgData, targeting){
         *         console.log("From " + easyrtc.idToName(easyrtcid) +
         *             " sent the following data " + JSON.stringify(msgData));
         *     }, 'food', 'dkdjdekj44--');
         *     easyrtc.setPeerListener( function(easyrtcid, msgType, msgData, targeting){
         *         console.log("From " + easyrtcid +
         *             " sent the following data " + JSON.stringify(msgData));
         *     }, 'drink');
         *
         *
         */
        Easyrtc.prototype.setPeerListener = function (listener, msgType, source) {
            if (!msgType) {
                this.receivePeer.cb = listener;
            }
            else {
                if (!this.receivePeer.msgTypes[msgType]) {
                    this.receivePeer.msgTypes[msgType] = { sources: {}, cb: null };
                }
                if (!source) {
                    this.receivePeer.msgTypes[msgType].cb = listener;
                }
                else {
                    this.receivePeer.msgTypes[msgType].sources[source] = { cb: listener };
                }
            }
        };
        /* This function serves to distribute peer messages to the various peer listeners */
        /** @private
         * @param {String} easyrtcid
         * @param {Object} msg - needs to contain a msgType and a msgData field.
         * @param {Object} targeting
         */
        Easyrtc.prototype.receivePeerDistribute = function (easyrtcid, msg, targeting) {
            var msgType = msg.msgType;
            var msgData = msg.msgData;
            if (!msgType) {
                this.debugOut("received peer message without msgType", msg);
                return;
            }
            try {
                if (this.receivePeer.msgTypes[msgType]) {
                    if (this.receivePeer.msgTypes[msgType].sources[easyrtcid] &&
                        this.receivePeer.msgTypes[msgType].sources[easyrtcid].cb) {
                        this.receivePeer.msgTypes[msgType].sources[easyrtcid].cb(easyrtcid, msgType, msgData, targeting);
                        return;
                    }
                    if (this.receivePeer.msgTypes[msgType].cb) {
                        this.receivePeer.msgTypes[msgType].cb(easyrtcid, msgType, msgData, targeting);
                        return;
                    }
                }
                if (this.receivePeer.cb) {
                    this.receivePeer.cb(easyrtcid, msgType, msgData, targeting);
                    return;
                }
                this.debugOut("No message handler for message ", msg);
            }
            catch (error) {
                this.showError(this.errCodes.DEVELOPER_ERR, "application level message handler died for message " + JSON.stringify(msg));
            }
        };
        ;
        /**
         * Sets a listener for messages from the server.
         * @param {Function} listener has the signature (msgType, msgData, targeting)
         * @example
         *     easyrtc.setServerListener( function(msgType, msgData, targeting){
         *         ("The Server sent the following message " + JSON.stringify(msgData));
         *     });
         */
        // public setServerListener(listener:ReceiveServerCallback):void {
        //     receiveServerCB = listener;
        // };
        /**
         * Sets the url of the Socket server.
         * The node.js server is great as a socket server, but it doesn't have
         * all the hooks you'd like in a general web server, like PHP or Python
         * plug-ins. By setting the serverPath your application can get it's regular
         * pages from a regular web server, but the EasyRTC library can still reach the
         * socket server.
         * @param {String} socketUrl
         * @param {Object} options an optional dictionary of options for socket.io's connect method.
         * The default is {'connect timeout': 10000,'force new connection': true }
         * @example
         *     easyrtc.setSocketUrl(":8080", options);
         */
        Easyrtc.prototype.setSocketUrl = function (socketUrl, options) {
            this.debugOut("WebRTC signaling server URL set to " + socketUrl);
            var parts = socketUrl.split(":");
            if (parts.length != 2) {
                this.showError(this.errCodes.DEVELOPER_ERR, "Illegal URL, must be host_or_ip:port, no protocol");
            }
            this.serverHost = parts[0];
            this.serverPort = parseInt(parts[1]);
            if (options && Object.keys(options).length > 0) {
                this.showError(this.errCodes.DEVELOPER_ERR, "Connection options not currently supported by Enterprise client");
            }
        };
        ;
        /**
         * Sets the user name associated with the connection.
         * @param {String} username must obey standard identifier conventions.
         * @returns {Boolean} true if the call succeeded, false if the username was invalid.
         * @example
         *    if( !easyrtc.setUsername("JohnSmith") ){
         *        console.error("bad user name);
         *    }
         *
         */
        Easyrtc.prototype.setUsername = function (username) {
            // if( this.myEasyrtcid ) {
            //     this.showError(this.errCodes.DEVELOPER_ERR, "easyrtc.setUsername called after authentication");
            //     return false;
            // }
            // else if (this.isNameValid(username)) {
            //     this.username = username;
            //     return true;
            // }
            // else {
            //     this.showError(this.errCodes.BAD_NAME, this.format(this.getConstantString("badUserName"), username));
            //     return false;
            // }
        };
        ;
        /**
         * Get an array of easyrtcids that are using a particular username
         * @param {String} username - the username of interest.
         * @param {String} room - an optional room name argument limiting results to a particular room.
         * @returns {Array} an array of {easyrtcid:id, roomName: roomName}.
         */
        Easyrtc.prototype.usernameToIds = function (username, room) {
            var results = [];
            for (var roomName in this.lastLoggedInList) {
                if (!this.lastLoggedInList.hasOwnProperty(roomName)) {
                    continue;
                }
                if (room && roomName !== room) {
                    continue;
                }
                for (var id in this.lastLoggedInList[roomName]) {
                    if (!this.lastLoggedInList[roomName].hasOwnProperty(id)) {
                        continue;
                    }
                    if (this.lastLoggedInList[roomName][id].username === username) {
                        results.push({
                            easyrtcid: id,
                            roomName: roomName
                        });
                    }
                }
            }
            return results;
        };
        ;
        /**
         * Returns another peers API field, if it exists.
         * @param {type} roomName
         * @param {type} easyrtcid
         * @param {type} fieldName
         * @returns {Object}  Undefined if the attribute does not exist, its value otherwise.
         */
        Easyrtc.prototype.getRoomApiField = function (roomName, easyrtcid, fieldName) {
            if (this.lastLoggedInList[roomName] &&
                this.lastLoggedInList[roomName][easyrtcid] &&
                this.lastLoggedInList[roomName][easyrtcid].apiField &&
                this.lastLoggedInList[roomName][easyrtcid].apiField[fieldName]) {
                return this.lastLoggedInList[roomName][easyrtcid].apiField[fieldName].fieldValue;
            }
            else {
                return undefined;
            }
        };
        ;
        /**
         * Set the authentication credential if needed.
         * @param {Object} credentialParm - a JSONable object.
         */
        Easyrtc.prototype.setCredential = function (credentialParm) {
            try {
                JSON.stringify(credentialParm);
                this.credential = credentialParm;
            }
            catch (oops) {
                this.showError(this.errCodes.BAD_CREDENTIAL, "easyrtc.setCredential passed a non-JSON-able object");
                throw "easyrtc.setCredential passed a non-JSON-able object";
            }
        };
        ;
        /**
         * Sets the listener for socket disconnection by external (to the API) reasons.
         * @param {Function} disconnectListener takes no arguments and is not called as a result of calling easyrtc.disconnect.
         * @example
         *    easyrtc.setDisconnectListener(function(){
         *        easyrtc.showError("SYSTEM-ERROR", "Lost our connection to the socket server");
         *    });
         */
        Easyrtc.prototype.setDisconnectListener = function (disconnectListener) {
            this.disconnectListener = disconnectListener;
        };
        ;
        /**
         * Convert an easyrtcid to a user name. This is useful for labeling buttons and messages
         * regarding peers.
         * @param {String} easyrtcid
         * @return {String} the username associated with the easyrtcid, or the easyrtcid if there is
         * no associated username.
         * @example
         *    console.log(easyrtcid + " is actually " + easyrtc.idToName(easyrtcid));
         */
        Easyrtc.prototype.idToName = function (easyrtcid) {
            return easyrtcid;
            var roomName;
            for (roomName in this.lastLoggedInList) {
                if (!this.lastLoggedInList.hasOwnProperty(roomName)) {
                    continue;
                }
                if (this.lastLoggedInList[roomName][easyrtcid]) {
                    if (this.lastLoggedInList[roomName][easyrtcid].username) {
                        return this.lastLoggedInList[roomName][easyrtcid].username;
                    }
                }
            }
            return easyrtcid;
        };
        ;
        /* used in easyrtc.connect */
        /** @private */
        //  /** @private */
        // private pc_config:RTCPeerConnectionConfig = {};
        //  /** @private */
        //  private pc_config_to_use:RTCPeerConnectionConfig = null;
        //  /** @private */
        /**
         * Determines whether fresh ice server configuration should be requested from the server for each peer connection.
         * @param {Boolean} value the default is false.
         */
        Easyrtc.prototype.setUseFreshIceEachPeerConnection = function (value) {
            this.debugOut("On enterprise, you always get fresh ice with a peer connection.");
        };
        /**
         * Returns the last ice config supplied by the EasyRTC server. This function is not normally used, it is provided
         * for people who want to try filtering ice server configuration on the client.
         * @return {Object} which has the form {iceServers:[ice_server_entry, ice_server_entry, ...]}
         */
        Easyrtc.prototype.getServerIce = function () {
            this.debugOut("On enterprise, not supported.");
            return { iceServers: [] };
        };
        ;
        /**
         * Sets the ice server configuration that will be used in subsequent calls. You only need this function if you are filtering
         * the ice server configuration on the client or if you are using TURN certificates that have a very short lifespan.
         * @param {Object} ice An object with iceServers element containing an array of ice server entries.
         * @example
         *     easyrtc.setIceUsedInCalls( {"iceServers": [
         *      {
         *         "url": "stun:stun.sipgate.net"
         *      },
         *      {
         *         "url": "stun:217.10.68.152"
         *      },
         *      {
         *         "url": "stun:stun.sipgate.net:10000"
         *      }
         *      ]});
         *      easyrtc.call(...);
         */
        Easyrtc.prototype.setIceUsedInCalls = function (ice) {
            this.debugOut("On enterprise, not supported yet.");
        };
        ;
        /**
         * @private
         * @param easyrtcid
         * @param checkAudio
         * @param streamName
         */
        Easyrtc.prototype.haveTracks = function (easyrtcid, checkAudio, streamName) {
            var stream, peerConnObj;
            if (!easyrtcid) {
                stream = this.getLocalStream(streamName);
            }
            else {
                peerConnObj = this.peerConns[easyrtcid];
                if (!peerConnObj) {
                    this.showError(this.errCodes.DEVELOPER_ERR, "haveTracks called about a peer you don't have a connection to");
                    return false;
                }
                stream = peerConnObj.getRemoteStreamByName(streamName);
            }
            if (!stream) {
                return false;
            }
            var tracks;
            try {
                if (checkAudio) {
                    tracks = stream.getAudioTracks();
                }
                else {
                    tracks = stream.getVideoTracks();
                }
            }
            catch (oops) {
                // we return true here because if the media stream doesn't have a working getAudioTracks or getVideoTracks,
                // our least likely to be wrong guess is that it does have the actual tracks and let things proceed higher up.
                return true;
            }
            if (!tracks) {
                return false;
            }
            return tracks.length > 0;
        };
        /** Determines if a particular peer2peer connection has an audio track.
         * @param {String} easyrtcid - the id of the other caller in the connection. If easyrtcid is not supplied, checks the local media.
         * @param {String} streamName - an optional stream id.
         * @return {Boolean} true if there is an audio track or the browser can't tell us.
         */
        Easyrtc.prototype.haveAudioTrack = function (easyrtcid, streamName) {
            return this.haveTracks(easyrtcid, true, streamName);
        };
        ;
        /** Determines if a particular peer2peer connection has a video track.
         * @param {String} easyrtcid - the id of the other caller in the connection. If easyrtcid is not supplied, checks the local media.
         * @param {String} streamName - an optional stream id.     *
         * @return {Boolean} true if there is an video track or the browser can't tell us.
         */
        Easyrtc.prototype.haveVideoTrack = function (easyrtcid, streamName) {
            return this.haveTracks(easyrtcid, false, streamName);
        };
        ;
        /**
         * Gets a data field associated with a room.
         * @param {String} roomName - the name of the room.
         * @param {String} fieldName - the name of the field.
         * @return {Object} dataValue - the value of the field if present, undefined if not present.
         */
        Easyrtc.prototype.getRoomField = function (roomName, fieldName) {
            return this.roomControl.getRoomField(roomName, fieldName);
        };
        ;
        /** @private */
        // fields:{[key:string]:any};
        //
        // easyrtc.disconnect performs a clean disconnection of the client from the server.
        //
        Easyrtc.prototype.disconnectBody = function () {
            var key;
            this.loggingOut = true;
            this.disconnecting = true;
            if (this.callControl) {
                this.transportBuilder.close();
                this.callControl = null;
                this.roomControl = null;
            }
            this.hangupAll();
            //            lastLoggedInList = {};
            this.emitEvent("roomOccupant", {});
            //            this.roomData = {};
            this.roomJoin = {};
            this.loggingOut = false;
            this.myEasyrtcid = null;
            this.disconnecting = false;
        };
        /**
         * Disconnect from the EasyRTC server.
         * @example
         *    easyrtc.disconnect();
         */
        Easyrtc.prototype.disconnect = function () {
            this.debugOut("attempt to disconnect from WebRTC signalling server");
            this.disconnecting = true;
            this.hangupAll();
            this.loggingOut = true;
            //
            // The hangupAll may try to send configuration information back to the server.
            // Collecting that information is asynchronous, we don't actually close the
            // connection until it's had a chance to be sent. We allocate 100ms for collecting
            // the info, so 250ms should be sufficient for the disconnecting.
            //
            setTimeout(function () {
                this.disconnectBody();
            }, 250);
        };
        ;
        /**
         *Sends data to another user using previously established data channel. This method will
         * fail if no data channel has been established yet. Unlike the easyrtc.sendWS method,
         * you can't send a dictionary, convert dictionaries to strings using JSON.stringify first.
         * What data types you can send, and how large a data type depends on your browser.
         * @param {String} destUser (an easyrtcid)
         * @param {String} msgType - the type of message being sent (application specific).
         * @param {Object} msgData - a JSONable object.
         * @example
         *     easyrtc.sendDataP2P(someEasyrtcid, "roomData", {room:499, bldgNum:'asd'});
         */
        Easyrtc.prototype.sendDataP2P = function (destUser, msgType, msgData) {
            var outgoingMessage = {
                msgData: msgData,
                msgType: msgType,
                senderEasyrtcid: this.myEasyrtcid
            };
            var flattenedData = JSON.stringify(outgoingMessage);
            this.debugOut("sending p2p message to " + destUser + " with data=" + JSON.stringify(flattenedData));
            if (!this.peerConns[destUser]) {
                this.showError(this.errCodes.DEVELOPER_ERR, "Attempt to send data peer to peer without a connection to " + destUser + ' first.');
                return;
            }
            var callCandidates = Object.keys(this.peerConns[destUser].remoteStreamsPerCallId);
            for (var i = 0; i < callCandidates.length; i++) {
                var callId = callCandidates[i];
                if (this.callControl.haveOpenDataChannel(callId)) {
                    try {
                        this.callControl.sendDataChannelText(callId, flattenedData);
                    }
                    catch (sendDataErr) {
                        this.debugOut("sendDataP2P error: ", sendDataErr);
                        throw sendDataErr;
                    }
                    return;
                }
            }
            this.showError(this.errCodes.DEVELOPER_ERR, "Attempt to send data peer to peer without establishing a data channel to " + destUser + ' first.');
        };
        /** Sends data to another user using websockets. The easyrtc.sendServerMessage or easyrtc.sendPeerMessage methods
         * are wrappers for this method; application code should use them instead.
         * @param {String} destination - either a string containing the easyrtcId of the other user, or an object containing some subset of the following fields: targetEasyrtcid, targetGroup, targetRoom.
         * Specifying multiple fields restricts the scope of the destination (operates as a logical AND, not a logical OR).
         * @param {String} msgType -the type of message being sent (application specific).
         * @param {Object} msgData - a JSONable object.
         * @param {Function} ackhandler - by default, the ackhandler handles acknowledgments from the server that your message was delivered to it's destination.
         * However, application logic in the server can over-ride this. If you leave this null, a stub ackHandler will be used. The ackHandler
         * gets passed a message with the same msgType as your outgoing message, or a message type of "error" in which case
         * msgData will contain a errorCode and errorText fields.
         * @example
         *    easyrtc.sendDataWS(someEasyrtcid, "setPostalAddress", {room:499, bldgNum:'asd'},
         *      function(ackMsg){
         *          console.log("saw the following acknowledgment " + JSON.stringify(ackMsg));
         *      }
         *    );
         */
        Easyrtc.prototype.sendDataWS = function (destination, msgType, msgData, ackhandler) {
            this.debugOut("sending client message via websockets to " + JSON.stringify(destination) + " with data=" + JSON.stringify(msgData));
            if (!ackhandler) {
                var ackhandler_1 = function (msg) {
                    if (msg.msgType === "error") {
                        this.showError(msg.msgData.errorCode, msg.msgData.errorText);
                    }
                };
            }
            var outgoingMessage = {
                senderEasyrtcid: this.myEasyrtcid,
                msgType: msgType,
                msgData: msgData
            };
            if (destination) {
                if (typeof destination === 'string') {
                    outgoingMessage.targetEasyrtcid = destination;
                }
                else if (typeof destination === 'object') {
                    if (destination.targetEasyrtcid) {
                        outgoingMessage.targetEasyrtcid = destination.targetEasyrtcid;
                    }
                    if (destination.targetRoom) {
                        outgoingMessage.targetRoom = destination.targetRoom;
                    }
                }
            }
            if (this.roomControl) {
                this.roomControl.sendPeerMessage(outgoingMessage, ackhandler);
            }
            else {
                this.debugOut("websocket failed because no connection to server");
                throw "Attempt to send message without a valid connection to the server.";
            }
        };
        ;
        /** Sends data to another user. This method uses data channels if one has been set up, or websockets otherwise.
         * @param {String} destUser - a string containing the easyrtcId of the other user.
         * Specifying multiple fields restricts the scope of the destination (operates as a logical AND, not a logical OR).
         * @param {String} msgType -the type of message being sent (application specific).
         * @param {Object} msgData - a JSONable object.
         * @param {Function} ackHandler - a function which receives acknowledgments. May only be invoked in
         *  the websocket case.
         * @example
         *    easyrtc.sendData(someEasyrtcid, "roomData",  {room:499, bldgNum:'asd'},
         *       function ackHandler(msgType, msgData);
         *    );
         */
        Easyrtc.prototype.sendData = function (destUser, msgType, msgData, ackHandler) {
            // if (peerConns[destUser] && peerConns[destUser].dataChannelReady) {
            //     this.sendDataP2P(destUser, msgType, msgData);
            // }
            // else {
            //     this.sendDataWS(destUser, msgType, msgData, ackHandler);
            // }
        };
        ;
        /**
         * Sends a message to another peer on the easyrtcMsg channel.
         * @param {String} destination - either a string containing the easyrtcId of the other user, or an object containing some subset of the following fields: targetEasyrtcid, targetGroup, targetRoom.
         * Specifying multiple fields restricts the scope of the destination (operates as a logical AND, not a logical OR).
         * @param {String} msgType - the type of message being sent (application specific).
         * @param {Object} msgData - a JSONable object with the message contents.
         * @param {function(String, Object)} successCB - a callback function with results from the server.
         * @param {function(String, String)} failureCB - a callback function to handle errors.
         * @example
         *     easyrtc.sendPeerMessage(otherUser, 'offer_candy', {candy_name:'mars'},
         *             function(msgType, msgBody ){
         *                console.log("message was sent");
         *             },
         *             function(errorCode, errorText){
         *                console.log("error was " + errorText);
         *             });
         */
        Easyrtc.prototype.sendPeerMessage = function (destination, msgType, msgData, successCB, failureCB) {
            // let toPeer:string = null;
            // let inRoom:string = null;
            // if( typeof destination === "string") {
            //     toPeer = destination;
            // }
            // else {
            //     toPeer = destination.targetEasyrtcid;
            //     inRoom = destination.targetRoom;
            // }
            //
            // roomC.SendPeerMessage({msgData:msgData, msgType:msgType}, toPeer, inRoom).then(
            //     (a:boolean)=>{
            //         success("success", {});
            //     }, (error:Error)=>{
            //         failureCB("error", error.message);
            //     });
            // if (!destination) {
            //     this.showError(this.errCodes.DEVELOPER_ERR, "destination was null in sendPeerMessage");
            // }
            //
            // debugOut("sending peer message " + JSON.stringify(msgData));
            //
            // function ackHandler(response) {
            //     if (response.msgType === "error") {
            //         if (failureCB) {
            //             failureCB(response.msgData.errorCode, response.msgData.errorText);
            //         }
            //     }
            //     else {
            //         if (successCB) {
            //             // firefox complains if you pass an undefined as an parameter.
            //             successCB(response.msgType, response.msgData ? response.msgData : null);
            //         }
            //     }
            // }
            //
            // this.sendDataWS(destination, msgType, msgData, ackHandler);
        };
        ;
        /**
         * Sends a message to the application code in the server (ie, on the easyrtcMsg channel).
         * @param {String} msgType - the type of message being sent (application specific).
         * @param {Object} msgData - a JSONable object with the message contents.
         * @param {function(String, Object)} successCB - a callback function with results from the server.
         * @param {function(String, String)} failureCB - a callback function to handle errors.
         * @example
         *     easyrtc.sendServerMessage('get_candy', {candy_name:'mars'},
         *             function(msgType, msgData ){
         *                console.log("got candy count of " + msgData.barCount);
         *             },
         *             function(errorCode, errorText){
         *                console.log("error was " + errorText);
         *             });
         */
        Easyrtc.prototype.sendServerMessage = function (msgType, msgData, successCB, failureCB) {
            //
            // var dataToShip:BasicMessage = {msgType: msgType, msgData: msgData};
            // debugOut("sending server message " + JSON.stringify(dataToShip));
            //
            // function ackhandler(response) {
            //     if (response.msgType === "error") {
            //         if (failureCB) {
            //             failureCB(response.msgData.errorCode, response.msgData.errorText);
            //         }
            //     }
            //     else {
            //         if (successCB) {
            //             successCB(response.msgType, response.msgData ? response.msgData : null);
            //         }
            //     }
            // }
            //
            // this.sendDataWS(null, msgType, msgData, ackhandler);
        };
        /** Sends the server a request for the list of rooms the user can see.
         * You must have already be connected to use this function.
         * @param {function(Object)} callback - on success, this function is called with a map of the form  { roomName:{"roomName":String, "numberClients": Number}}.
         * The roomName appears as both the key to the map, and as the value of the "roomName" field.
         * @param {function(String, String)} errorCallback   is called on failure. It gets an errorCode and errorText as it's too arguments.
         * @example
         *    easyrtc.getRoomList(
         *        function(roomList){
         *           for(roomName in roomList){
         *              console.log("saw room " + roomName);
         *           }
         *         },
         *         function(errorCode, errorText){
         *            easyrtc.showError(errorCode, errorText);
         *         }
         *    );
         */
        /*
    
         */
        Easyrtc.prototype.getRoomList = function (callback, errorCallback) {
            this.roomControl.GetRoomNames().then(function (result) {
                callback(result);
            }, function (error) { return void {}; });
        };
        /**
         * Check if the client has a peer-2-peer connection to another user.
         * The return values are text strings so you can use them in debugging output.
         *  @param {String} otherUser - the easyrtcid of the other user.
         *  @return {String} one of the following values: easyrtc.NOT_CONNECTED, easyrtc.BECOMING_CONNECTED, easyrtc.IS_CONNECTED
         *  @example
         *     if( easyrtc.getConnectStatus(otherEasyrtcid) == easyrtc.NOT_CONNECTED ){
         *         easyrtc.call(otherEasyrtcid,
         *                  function(){ console.log("success"); },
         *                  function(){ console.log("failure"); });
         *     }
         */
        Easyrtc.prototype.getConnectStatus = function (otherUser) {
            if (!this.peerConns.hasOwnProperty(otherUser)) {
                return this.NOT_CONNECTED;
            }
            var peer = this.peerConns[otherUser];
            var bestState = this.NOT_CONNECTED;
            for (var callId in peer.remoteStreamsPerCallId) {
                var callConnectState = this.callControl.getIceState(callId);
                var collapsedState = this.NOT_CONNECTED;
                switch (callConnectState) {
                    case "new":
                    case "checking":
                        collapsedState = this.BECOMING_CONNECTED;
                        break;
                    case "connected":
                    case "completed":
                        collapsedState = this.IS_CONNECTED;
                }
                if (bestState == this.NOT_CONNECTED) {
                    bestState = collapsedState;
                }
                else if (bestState == this.BECOMING_CONNECTED && collapsedState == this.IS_CONNECTED) {
                    bestState = this.IS_CONNECTED;
                }
            }
            return bestState;
        };
        ;
        /** @private */
        //
        // This function calls the users onStreamClosed handler, passing it the easyrtcid of the peer, the stream itself,
        // and the name of the stream.
        //
        Easyrtc.prototype.emitOnStreamClosed = function (easyrtcid, stream) {
            if (!this.peerConns[easyrtcid]) {
                return;
            }
            var streamName;
            var id;
            if (stream.id) {
                id = stream.id;
            }
            else {
                id = "default";
            }
            streamName = this.peerConns[easyrtcid].remoteStreamIdToName[id] || "default";
            if (this.peerConns[easyrtcid].liveRemoteStreams[streamName] &&
                this.onStreamClosed) {
                delete this.peerConns[easyrtcid].liveRemoteStreams[streamName];
                this.onStreamClosed(easyrtcid, stream, streamName);
            }
            delete this.peerConns[easyrtcid].remoteStreamIdToName[id];
        };
        /** @private */
        Easyrtc.prototype.onRemoveStreamHelper = function (callId, stream) {
            var easyrtcId = this.callIdToEasyrtcId(callId);
            if (!easyrtcId) {
                return;
            }
            if (this.peerConns[easyrtcId]) {
                this.emitOnStreamClosed(easyrtcId, stream);
            }
            delete this.peerConns[easyrtcId].removeStream(callId, stream);
        };
        Easyrtc.prototype.onAddStreamHelper = function (callId, stream) {
            this.debugOut("saw incoming media stream");
            var easyrtcId = this.callIdToEasyrtcId(callId);
            if (!easyrtcId) {
                return;
            }
            var peerConn = this.peerConns[easyrtcId];
            peerConn.remoteStreamsPerCallId[callId].push(stream);
            if (!peerConn.startedAV) {
                peerConn.startedAV = true;
                //                       peerConn.sharingAudio = haveAudioVideo.audio;
                //                       peerConn.sharingVideo = haveAudioVideo.video;
                peerConn.connectTime = new Date().getTime();
                if (peerConn.callSuccessCB) {
                    if (peerConn.sharingAudio || peerConn.sharingVideo) {
                        peerConn.callSuccessCB(callId, "audiovideo");
                    }
                }
                if (this.audioEnabled || this.videoEnabled) {
                }
            }
            var remoteName = this.getNameOfRemoteStream(callId, stream.id || "default");
            if (!remoteName) {
                remoteName = "default";
            }
            peerConn.remoteStreamIdToName[stream.id || "default"] = remoteName;
            peerConn.liveRemoteStreams[remoteName] = stream;
            // theStream.streamName = remoteName;
            if (this.streamAcceptor) {
                this.streamAcceptor(easyrtcId, stream, remoteName);
            }
        };
        // Parse the uint32 PRIORITY field into its constituent parts from RFC 5245,
        // type preference, local preference, and (256 - component ID).
        // ex: 126 | 32252 | 255 (126 is host preference, 255 is component ID 1)
        Easyrtc.prototype.formatPriority = function (priority) {
            var s = '';
            s += (priority >> 24);
            s += ' | ';
            s += (priority >> 8) & 0xFFFF;
            s += ' | ';
            s += priority & 0xFF;
            return s;
        };
        Easyrtc.prototype.processAddedStream = function (peerConn, otherUser, theStream) {
        };
        Easyrtc.prototype.callIdToEasyrtcId = function (callId) {
            for (var easyrtcId in this.peerConns) {
                var callIds = this.peerConns[easyrtcId].remoteStreamsPerCallId;
                if (callIds[callId]) {
                    return easyrtcId;
                }
            }
            return null;
        };
        Easyrtc.prototype.IceConnectionStateHandler = function (callId, event, iceConnectionState) {
            var otherUser = this.callIdToEasyrtcId(callId);
            if (otherUser) {
                if (this.iceConnectionStateChangeListener) {
                    this.iceConnectionStateChangeListener(otherUser, event);
                }
                switch (iceConnectionState) {
                    case "connected":
                        if (this.peerConns[otherUser] && this.peerConns[otherUser].callSuccessCB) {
                            this.peerConns[otherUser].callSuccessCB(otherUser, "connection");
                        }
                        break;
                    case "failed":
                        if (this.peerConns[otherUser].callFailureCB) {
                            this.peerConns[otherUser].callFailureCB(this.errCodes.NOVIABLEICE, "No usable STUN/TURN path");
                        }
                        break;
                    case "disconnected":
                        if (this.onPeerFailing) {
                            this.onPeerFailing(otherUser);
                        }
                        if (this.peerConns[otherUser]) {
                            this.peerConns[otherUser].failing = Date.now();
                        }
                        break;
                    case "closed":
                        if (this.onPeerClosed) {
                            this.onPeerClosed(otherUser);
                        }
                        break;
                    case "completed":
                        if (this.peerConns[otherUser]) {
                            if (this.peerConns[otherUser].failing && this.onPeerRecovered) {
                                this.onPeerRecovered(otherUser);
                            }
                            this.peerConns[otherUser].failing = null;
                        }
                        break;
                }
            }
        };
        // TODO split buildPeerConnection it more thant 500 lines
        Easyrtc.prototype.buildPeerConnection = function (otherUser, isInitiator, callSuccessCB, callFailureCB) {
            if (!this.peerConns[otherUser]) {
                var newPeerConn = new PeerConnType;
                this.peerConns[otherUser] = newPeerConn;
            }
            this.peerConns[otherUser].isInitiator = isInitiator;
            this.peerConns[otherUser].callSuccessCB = callSuccessCB;
            this.peerConns[otherUser].callFailureCB = callFailureCB;
        };
        Easyrtc.prototype.handleCallIdStart = function (callId, peerId, callConstraints) {
            var self = this;
            function success(easyrtcId, mediaType) {
                self.debugOut("Saw success in building peer connection");
            }
            function failure(errCode, errText) {
                self.debugOut(errCode, errText);
            }
            if (!this.peerConns[peerId]) {
                this.buildPeerConnection(peerId, false, success, failure);
                this.peerConns[peerId].sharingData = callConstraints.mediaConstraints.dataChannelEnabled;
                this.peerConns[peerId].sharingAudio = callConstraints.mediaConstraints.mediaEnabled;
                this.peerConns[peerId].sharingVideo = callConstraints.mediaConstraints.mediaEnabled;
            }
            if (!this.peerConns[peerId].remoteStreamsPerCallId[callId]) {
                this.peerConns[peerId].remoteStreamsPerCallId[callId] = [];
            }
        };
        Easyrtc.prototype.handleCallIdFailed = function (callId) {
            var easyrtcid = this.callIdToEasyrtcId(callId);
            if (!easyrtcid) {
                return;
            }
            if (this.peerConns[easyrtcid].remoteStreamsPerCallId[callId]) {
                this.peerConns[easyrtcid].callFailureCB(this.errCodes.CALL_ERR, "Call failure");
                delete this.peerConns[easyrtcid].remoteStreamsPerCallId[callId];
            }
        };
        Easyrtc.prototype.handleCallIdEnd = function (callId) {
            var easyrtcid = this.callIdToEasyrtcId(callId);
            if (!easyrtcid) {
                return;
            }
            if (this.peerConns[easyrtcid].remoteStreamsPerCallId[callId]) {
                var streamsToClose = this.peerConns[easyrtcid].remoteStreamsPerCallId[callId];
                for (var i = 0; i < streamsToClose.length; i++) {
                    this.emitOnStreamClosed(easyrtcid, streamsToClose[i]);
                }
                delete this.peerConns[easyrtcid].remoteStreamsPerCallId[callId];
                if (Object.keys(this.peerConns[easyrtcid].remoteStreamsPerCallId).length == 0) {
                    delete this.peerConns[easyrtcid];
                }
            }
        };
        //     //
        //     // This function handles data channel message events.
        //     //
        //     var pendingTransfer = {};
        //     function dataChannelMessageHandler(event) {
        //         this.debugOut("saw dataChannel.onmessage event: ", event.data);
        //
        //         if (event.data === "dataChannelPrimed") {
        //             this.sendDataWS(otherUser, "dataChannelPrimed", "");
        //         }
        //         else {
        //             //
        //             // Chrome and Firefox Interop is passing a event with a strange data="", perhaps
        //             // as it's own form of priming message. Comparing the data against "" doesn't
        //             // work, so I'm going with parsing and trapping the parse error.
        //             //
        //             var msg;
        //
        //             try {
        //                 msg = JSON.parse(event.data);
        //             } catch (err) {
        //                 this.debugOut('Developer error, unable to parse event data');
        //             }
        //
        //             if (msg) {
        //                 if (msg.transfer && msg.transferId) {
        //                     if (msg.transfer === 'start') {
        //                         this.debugOut('start transfer #' + msg.transferId);
        //
        //                         var parts = parseInt(msg.parts);
        //                         pendingTransfer = {
        //                             chunks: [],
        //                             parts: parts,
        //                             transferId: msg.transferId
        //                         };
        //
        //                     } else if (msg.transfer === 'chunk') {
        //                         this.debugOut('got chunk for transfer #' + msg.transferId);
        //
        //                         // check data is valid
        //                         if (!(typeof msg.data === 'string' && msg.data.length <= this.maxP2PMessageLength)) {
        //                             this.debugOut('Developer error, invalid data');
        //
        //                             // check there's a pending transfer
        //                         } else if (!pendingTransfer) {
        //                             this.debugOut('Developer error, unexpected chunk');
        //
        //                             // check that transferId is valid
        //                         } else if (msg.transferId !== pendingTransfer.transferId) {
        //                             this.debugOut('Developer error, invalid transfer id');
        //
        //                             // check that the max length of transfer is not reached
        //                         } else if (pendingTransfer.chunks.length + 1 > pendingTransfer.parts) {
        //                             this.debugOut('Developer error, received too many chunks');
        //
        //                         } else {
        //                             pendingTransfer.chunks.push(msg.data);
        //                         }
        //
        //                     } else if (msg.transfer === 'end') {
        //                         this.debugOut('end of transfer #' + msg.transferId);
        //
        //                         // check there's a pending transfer
        //                         if (!pendingTransfer) {
        //                             this.debugOut('Developer error, unexpected end of transfer');
        //
        //                             // check that transferId is valid
        //                         } else if (msg.transferId !== pendingTransfer.transferId) {
        //                             this.debugOut('Developer error, invalid transfer id');
        //
        //                             // check that all the chunks were received
        //                         } else if (pendingTransfer.chunks.length !== pendingTransfer.parts) {
        //                             this.debugOut('Developer error, received wrong number of chunks');
        //
        //                         } else {
        //                             var chunkedMsg;
        //                             try {
        //                                 chunkedMsg = JSON.parse(pendingTransfer.chunks.join(''));
        //                             } catch (err) {
        //                                 this.debugOut('Developer error, unable to parse message');
        //                             }
        //
        //                             if (chunkedMsg) {
        //                                 this.receivePeerDistribute(otherUser, chunkedMsg, null);
        //                             }
        //                         }
        //                         pendingTransfer = {  };
        //
        //                     } else {
        //                         this.debugOut('Developer error, got an unknown transfer message' + msg.transfer);
        //                     }
        //                 } else {
        //                     this.receivePeerDistribute(otherUser, msg, null);
        //                 }
        //             }
        //         }
        //     }
        // }
        /** @private */
        Easyrtc.prototype.callBody = function (otherUser, callSuccessCB, callFailureCB, wasAcceptedCB, offeringStream, callIndex) {
            var callConstraints = CCC.CallConstraints.newInstance();
            callConstraints.networkConstraints.offeringPeerId = this.myEasyrtcid;
            callConstraints.mediaConstraints.dataChannelEnabled = this.dataEnabled;
            callConstraints.networkConstraints.answeringPeerId = otherUser;
            var requestingLabel = (callIndex == 0 && (this.receiveAudioEnabled || this.receiveVideoEnabled)) ? "default" : null;
            var self = this;
            if (!self.peerConns[otherUser]) {
                self.buildPeerConnection(otherUser, true, callSuccessCB, callFailureCB);
            }
            function onSuccess(callId) {
                self.peerConns[otherUser].remoteStreamsPerCallId[callId] = [];
            }
            function onFailure(error) {
                callFailureCB(Easyrtc.errCodes.CALL_ERR, error.message);
            }
            this.callControl.startCallWithPeerId(otherUser, callConstraints, offeringStream, requestingLabel).then(onSuccess, onFailure);
        };
        /**
         * Initiates a call to another user. If it succeeds, the streamAcceptor callback will be called.
         * @param {String} otherUser - the easyrtcid of the peer being called.
         * @param {Function} callSuccessCB (otherCaller, mediaType) - is called when the datachannel is established or the MediaStream is established. mediaType will have a value of "audiovideo" or "datachannel"
         * @param {Function} callFailureCB (errorCode, errMessage) - is called if there was a system error interfering with the call.
         * @param {Function} wasAcceptedCB (wasAccepted:boolean,otherUser:string) - is called when a call is accepted or rejected by another party. It can be left null.
         * @param {Array} streamNames - optional array of streamNames.
         * @example
         *    easyrtc.call( otherEasyrtcid,
         *        function(easyrtcid, mediaType){
         *           console.log("Got mediaType " + mediaType + " from " + easyrtc.idToName(easyrtcid));
         *        },
         *        function(errorCode, errMessage){
         *           console.log("call to  " + easyrtc.idToName(otherEasyrtcid) + " failed:" + errMessage);
         *        },
         *        function(wasAccepted, easyrtcid){
         *            if( wasAccepted ){
         *               console.log("call accepted by " + easyrtc.idToName(easyrtcid));
         *            }
         *            else{
         *                console.log("call rejected" + easyrtc.idToName(easyrtcid));
         *            }
         *        });
         */
        Easyrtc.prototype.call = function (otherUser, callSuccessCB, callFailureCB, wasAcceptedCB, streamNames) {
            if (streamNames) {
                if (typeof streamNames === "string") {
                    streamNames = [streamNames];
                }
                else if (typeof streamNames.length === "undefined") {
                    this.showError(this.errCodes.DEVELOPER_ERR, "easyrtc.call passed bad streamNames");
                    return;
                }
            }
            this.debugOut("initiating peer to peer call to " + otherUser +
                " audio=" + this.audioEnabled +
                " video=" + this.videoEnabled +
                " data=" + this.dataEnabled);
            if (!this.supportsPeerConnections()) {
                callFailureCB(this.errCodes.CALL_ERR, this.getConstantString("noWebrtcSupport"));
                return;
            }
            var message;
            //
            // If we are sharing audio/video and we haven't allocated the local media stream yet,
            // we'll do so, recalling our self on success.
            //
            function restartCall(m) {
                this.call(otherUser, callSuccessCB, callFailureCB, wasAcceptedCB);
            }
            if (!streamNames && this.autoInitUserMedia) {
                var stream = this.getLocalStream("default");
                if (!stream && (this.audioEnabled || this.videoEnabled)) {
                    this.initMediaSource(restartCall, callFailureCB, "default");
                    return;
                }
            }
            if (!this.callControl) {
                message = "Attempt to make a call prior to connecting to service";
                this.debugOut(message);
                throw message;
            }
            if (!streamNames && (this.audioEnabled || this.videoEnabled)) {
                streamNames = ["default"];
            }
            if (!streamNames || streamNames.length === 0) {
                this.callBody(otherUser, callSuccessCB, callFailureCB, wasAcceptedCB, "", 0);
            }
            else {
                for (var i = 0; i < streamNames.length; i++) {
                    this.callBody(otherUser, callSuccessCB, callFailureCB, wasAcceptedCB, streamNames[i], i);
                }
            }
        };
        ;
        /**
         * Hang up on a particular user or all users.
         *  @param {String} otherUser - the easyrtcid of the person to hang up on.
         *  @example
         *     easyrtc.hangup(someEasyrtcid);
         */
        Easyrtc.prototype.hangup = function (otherUser) {
            for (var callId in this.peerConns[otherUser].remoteStreamsPerCallId) {
                this.callControl.endCall(callId);
            }
        };
        ;
        /**
         * Checks to see if data channels work between two peers.
         * @param {String} otherUser - the other peer.
         * @returns {Boolean} true if data channels work and are ready to be used
         *   between the two peers.
         */
        Easyrtc.prototype.doesDataChannelWork = function (otherUser) {
            if (!this.peerConns[otherUser]) {
                return false;
            }
            return !!this.peerConns[otherUser].dataChannelReady;
        };
        /**
         * Return the media stream shared by a particular peer. This is needed when you
         * add a stream in the middle of a call.
         * @param {String} easyrtcid the peer.
         * @param {String} remoteStreamName an optional argument supplying the streamName.
         * @returns {Object} A mediaStream.
         */
        Easyrtc.prototype.getRemoteStream = function (easyrtcid, remoteStreamName) {
            if (!this.peerConns[easyrtcid]) {
                this.showError(this.errCodes.DEVELOPER_ERR, "attempt to get stream of uncalled party");
                throw "Developer err: no such stream";
            }
            else {
                return this.peerConns[easyrtcid].getRemoteStreamByName(remoteStreamName);
            }
        };
        Easyrtc.prototype.registerLocalMediaStreamByName = function (remoteStream, localStreamName) {
            this.localMediaStreams[localStreamName] = remoteStream;
        };
        /**
         * Assign a local streamName to a remote stream so that it can be forwarded to other callers.
         * @param {String} easyrtcid the peer supplying the remote stream
         * @param {String} remoteStreamName the streamName supplied by the peer.
         * @param {String} localStreamName streamName used when passing the stream to other peers.
         * @example
         *    easyrtc.makeLocalStreamFromRemoteStream(sourcePeer, "default", "forwardedStream");
         *    easyrtc.call(nextPeer, callSuccessCB, callFailureCB, wasAcceptedCB, ["forwardedStream"]);
         */
        Easyrtc.prototype.makeLocalStreamFromRemoteStream = function (easyrtcid, remoteStreamName, localStreamName) {
            var remoteStream = this.getRemoteStream(easyrtcid, remoteStreamName);
            if (remoteStream) {
                this.registerLocalMediaStreamByName(remoteStream, localStreamName);
            }
            else {
                throw "Developer err: no such stream";
            }
        };
        /**
         * Add a named local stream to a call.
         * @param {String} easyrtcId The id of client receiving the stream.
         * @param {String} streamName The name of the stream.
         * @param {Function} receiptHandler is a function that gets called when the other side sends a message
         *   that the stream has been received. The receiptHandler gets called with an easyrtcid and a stream name. This
         *   argument is optional.
         */
        Easyrtc.prototype.addStreamToCall = function (easyrtcId, streamName, receiptHandler) {
            // if( !streamName) {
            //     streamName = "default";
            // }
            // var stream = this.getLocalMediaStreamByName(streamName);
            // if (!stream) {
            //     this.debugOut("attempt to add nonexistent stream " + streamName);
            // }
            // else if (!peerConns[easyrtcId] || !peerConns[easyrtcId].pc) {
            //     this.debugOut("Can't add stream before a call has started.");
            // }
            // else {
            //     this.callCancelled.AddLocalStreamToCall(callId, streamName);
            // }
        };
        ;
        /** @private */
        Easyrtc.prototype.onRemoteHangup = function (callId) {
            this.debugOut("Saw onRemote hangup event");
            var easyrtcid = this.callIdToEasyrtcId(callId);
            if (!easyrtcid || !this.peerConns[easyrtcid]) {
                return;
            }
            //
            // close any remote streams.
            //
            var remoteStreams = this.peerConns[easyrtcid].liveRemoteStreams;
            if (remoteStreams) {
                for (var streamName in remoteStreams) {
                    var remoteStream = remoteStreams[streamName];
                    this.emitOnStreamClosed(easyrtcid, remoteStream);
                    try {
                        MR.StopStream(remoteStream);
                    }
                    catch (err) {
                    }
                }
            }
            this.peerConns[easyrtcid].removeCallId(callId);
            if (this.peerConns[easyrtcid].numberOfActiveCalls() == 0) {
                delete this.peerConns[easyrtcid];
            }
        };
        /** @private */
        //
        // checks to see if a particular peer is in any room at all.
        //
        Easyrtc.prototype.isPeerInAnyRoom = function (easyrtcid) {
            // var roomName;
            // for (roomName in lastLoggedInList) {
            //     if (!lastLoggedInList.hasOwnProperty(roomName)) {
            //         continue;
            //     }
            //     if (lastLoggedInList[roomName][easyrtcid]) {
            //         return true;
            //     }
            // }
            return false;
        };
        /**
         * This function sets a timeout for a function to be called with the feature that if another
         * invocation comes along within a particular interval (with the same key), the second invocation
         * replaces the first. To prevent a continuous stream of events from preventing a callback from ever
         * firing, we'll collapse no more than 20 events.
         * @param {String} key A key used to identify callbacks that should be aggregated.
         * @param {Function} callback The callback to invoke.
         * @param {Number} period The aggregating period in milliseconds.
         * @private
         */
        Easyrtc.prototype.addAggregatingTimer = function (key, callback, period) {
            if (!period) {
                period = 100; // 0.1 second
            }
            var counter = 0;
            if (this.aggregatingTimers[key]) {
                clearTimeout(this.aggregatingTimers[key].timer);
                counter = this.aggregatingTimers[key].counter;
            }
            if (counter > 20) {
                delete this.aggregatingTimers[key];
                callback();
            }
            else {
                this.aggregatingTimers[key] = { counter: counter + 1, timer: null };
                this.aggregatingTimers[key].timer = setTimeout(function () {
                    delete this.aggregatingTimers[key];
                    callback();
                }, period);
            }
        };
        /** @private */
        //
        // this function gets called for each room when there is a room update.
        //
        Easyrtc.prototype.processOccupantList = function (roomName, occupantList) {
            var myInfo = null;
            var reducedList = {}; // the reduce list is everybody except ourself.
            var id;
            for (id in occupantList) {
                if (occupantList.hasOwnProperty(id)) {
                    if (id === this.myEasyrtcid) {
                        myInfo = occupantList[id];
                    }
                    else {
                        reducedList[id] = occupantList[id];
                    }
                }
            }
            //
            //
            //
            this.addAggregatingTimer("roomOccupants&" + roomName, function () {
                if (this.roomOccupantListener) {
                    this.roomOccupantListener(roomName, reducedList, myInfo);
                }
                this.emitEvent("roomOccupants", { roomName: roomName, occupants: reducedList });
            }, 100);
        };
        /** @private */
        Easyrtc.prototype.onChannelMsg = function (msg, ackAcceptorFunc) {
            // var targeting = {};
            // if (ackAcceptorFunc) {
            //     ackAcceptorFunc(this.ackMessage);
            // }
            // if (msg.targetEasyrtcid) {
            //     targeting.targetEasyrtcid = msg.targetEasyrtcid;
            // }
            // if (msg.targetRoom) {
            //     targeting.targetRoom = msg.targetRoom;
            // }
            // if (msg.targetGroup) {
            //     targeting.targetGroup = msg.targetGroup;
            // }
            // if (msg.senderEasyrtcid) {
            //     this.receivePeerDistribute(msg.senderEasyrtcid, msg, targeting);
            // }
            // else {
            //     if (receiveServerCB) {
            //         receiveServerCB(msg.msgType, msg.msgData, targeting);
            //     }
            //     else {
            //         debugOut("Unhandled server message " + JSON.stringify(msg));
            //     }
            // }
        };
        /** @private */
        Easyrtc.prototype.processSessionData = function (sessionData) {
            if (sessionData) {
                if (sessionData.easyrtcsid) {
                    this.easyrtcsid = sessionData.easyrtcsid;
                }
                if (sessionData.field) {
                    this.sessionFields = sessionData.field;
                }
            }
        };
        /** @private */
        Easyrtc.prototype.processRoomData = function (roomName, roomData) {
            this.roomData[roomName] = roomData;
            this.emitEvent("roomOccupant", roomData);
        };
        /** @private */
        // private onChannelCmd(msg:PeerMessage, ackAcceptorFn:BasicMessage):void {
        //
        //     var caller = msg.senderEasyrtcid;
        //     var msgType = msg.msgType;
        //     var msgData = msg.msgData;
        //     var pc;
        //
        //     debugOut('received message of type ' + msgType);
        //
        //
        //     if (typeof queuedMessages[caller] === "undefined") {
        //         clearQueuedMessages(caller);
        //     }
        //
        //     switch (msgType) {
        //         case "sessionData":
        //             processSessionData(msgData.sessionData);
        //             break;
        //         case "roomData":
        //             processRoomData(msgData.roomData);
        //             break;
        //         case "hangup":
        //             onRemoteHangup(caller);
        //             clearQueuedMessages(caller);
        //             break;
        //         case "error":
        //             this.showError(msgData.errorCode, msgData.errorText);
        //             break;
        //         default:
        //             this.showError(this.errCodes.DEVELOPER_ERR, "received unknown message type from server, msgType is " + msgType);
        //             return;
        //     }
        //
        //     if (ackAcceptorFn) {
        //         ackAcceptorFn(this.ackMessage);
        //     }
        // }
        /**
         * Sets the presence state on the server.
         * @param {String} state - one of 'away','chat','dnd','xa'
         * @param {String} statusText - User configurable status string. May be length limited.
         * @example   easyrtc.updatePresence('dnd', 'sleeping');
         */
        Easyrtc.prototype.updatePresence = function (state, statusText) {
            this.roomControl.setPresence(state, statusText).then(function (result) { return void {}; }, function (error) { return void {}; });
        };
        ;
        /**
         * Fetch the collection of session fields as a map. The map has the structure:
         *  {key1: {"fieldName": key1, "fieldValue": value1}, ...,
         *   key2: {"fieldName": key2, "fieldValue": value2}
         *  }
         * @returns {Object}
         */
        // public getSessionFields():any {
        //     return sessionFields;
        // };
        /**
         * Fetch the value of a session field by name.
         * @param {String} name - name of the session field to be fetched.
         * @returns the field value (which can be anything). Returns undefined if the field does not exist.
         */
        // public getSessionField(name:string):any {
        //     if (sessionFields[name]) {
        //         return sessionFields[name].fieldValue;
        //     }
        //     else {
        //         return undefined;
        //     }
        // };
        /**
         * Returns an array of easyrtcid's of peers in a particular room.
         * @param roomName
         * @returns {Array} of easyrtcids or null if the client is not in the room.
         * @example
         *     var occupants = easyrtc.getRoomOccupants("default");
         *     var i;
         *     for( i = 0; i < occupants.length; i++ ) {
         *         console.log( occupants[i] + " is in the room");
         *     }
         */
        // public getRoomOccupantsAsArray(roomName:string):string[] {
        //     if (!lastLoggedInList[roomName]) {
        //         return null;
        //     }
        //     else {
        //         return Object.keys(lastLoggedInList[roomName]);
        //     }
        // };
        /**
         * Returns a map of easyrtcid's of peers in a particular room. You should only test elements in the map to see if they are
         * null; their actual values are not guaranteed to be the same in different releases.
         * @param roomName
         * @returns {Object} of easyrtcids or null if the client is not in the room.
         * @example
         *      if( easyrtc.getRoomOccupantsAsMap("default")[some_easyrtcid]) {
         *          console.log("yep, " + some_easyrtcid + " is in the room");
         *      }
         */
        // public getRoomOccupantsAsMap(roomName:string):any {
        //     return lastLoggedInList[roomName];
        // };
        /**
         * Returns true if the ipAddress parameter was the address of a turn server. This is done by checking against information
         * collected during peer to peer calls. Don't expect it to work before the first call, or to identify turn servers that aren't
         * in the ice config.
         * @param ipAddress
         * @returns {boolean} true if ip address is known to be that of a turn server, false otherwise.
         */
        // public isTurnServer(ipAddress:string):boolean {
        //     return !!this._turnServers[ipAddress];
        // };
        /**
         * Returns true if the ipAddress parameter was the address of a stun server. This is done by checking against information
         * collected during peer to peer calls. Don't expect it to work before the first call, or to identify turn servers that aren't
         * in the ice config.
         * @param ipAddress
         * @returns {boolean} true if ip address is known to be that of a stun server, false otherwise.
         */
        // public isStunServer(ipAddress:string):boolean {
        //     return !!this._stunServers[ipAddress];
        // };
        /**
         * Request fresh ice config information from the server.
         * This should be done periodically by long running applications.
         * @param {Function} callback is called with a value of true on success, false on failure.
         */
        Easyrtc.prototype.getFreshIceConfig = function (callback) {
            console.log("Not supported by enterprise version");
        };
        /**
         * This method allows you to join a single room. It may be called multiple times to be in
         * multiple rooms simultaneously. It may be called before or after connecting to the server.
         * Note: the successCB and failureDB will only be called if you are already connected to the server.
         * @param {String} roomName the room to be joined.
         * @param {Object} roomParameters application specific parameters, can be null.
         * @param {Function} successCB called once, with a roomName as it's argument, once the room is joined.
         * @param {Function} failureCB called if the room can not be joined. The arguments of failureCB are errorCode, errorText, roomName.
         */
        Easyrtc.prototype.joinRoom = function (roomName, roomParameters, successCB, failureCB) {
            if (this.roomJoin[roomName]) {
                this.showError(this.errCodes.DEVELOPER_ERR, "Attempt to join room " + roomName + " which you are already in.");
                return;
            }
            if (roomParameters && Object.keys(roomParameters).length > 0) {
                this.showError(this.errCodes.DEVELOPER_ERR, "room parameters for joinRoom not currently supported on enterprize");
            }
            var developerError = this.errCodes.DEVELOPER_ERR;
            function errFunc(error) {
                var errText = error.message;
                failureCB(developerError, errText, roomName);
            }
            if (this.roomControl) {
                this.roomControl.JoinRoom(roomName).then(function (rmname) {
                    successCB(roomName);
                }, errFunc);
            }
            else {
                this.roomsToJoinOnConnect.push(roomName);
            }
        };
        ;
        /**
         * This function allows you to leave a single room. Note: the successCB and failureDB
         *  arguments are optional and will only be called if you are already connected to the server.
         * @param {String} roomName
         * @param {Function} successCallback - A function which expects a roomName.
         * @param {Function} failureCallback - A function which expects the following arguments: errorCode, errorText, roomName.
         * @example
         *    easyrtc.leaveRoom("freds_room");
         *    easyrtc.leaveRoom("freds_room", function(roomName){ console.log("left the room")},
         *                       function(errorCode, errorText, roomName){ console.log("left the room")});
         */
        Easyrtc.prototype.leaveRoom = function (roomName, successCallback, failureCallback) {
            var _this = this;
            if (this.roomJoin[roomName]) {
                if (!this.callControl) {
                    delete this.roomsToJoinOnConnect[roomName];
                }
                else {
                    this.roomControl.LeaveRoom(roomName).then(function (result) {
                        if (successCallback) {
                            successCallback(roomName);
                        }
                    }, function (error) {
                        if (failureCallback) {
                            failureCallback(_this.errCodes.DEVELOPER_ERR, error.message, roomName);
                        }
                    });
                }
            }
        };
        ;
        /** Get a list of the rooms you are in. You must be connected to call this function.
         * @returns {Object} A map whose keys are the room names
         */
        Easyrtc.prototype.getRoomsJoined = function () {
            var roomsIn = {};
            for (var roomName in this.roomJoin) {
                if (this.roomJoin.hasOwnProperty(roomName)) {
                    roomsIn[roomName] = true;
                }
            }
            return roomsIn;
        };
        Easyrtc.prototype.onDataChannelOpenHelper = function (callId, isOpen) {
            var easyrtcId = this.callIdToEasyrtcId(callId);
            if (!easyrtcId) {
                return;
            }
            if (isOpen) {
                if (!this.peerConns[easyrtcId].dataChannelReady) {
                    this.peerConns[easyrtcId].dataChannelReady = isOpen;
                    if (this.peerConns[easyrtcId].callSuccessCB) {
                        this.peerConns[easyrtcId].callSuccessCB(callId, "datachannel");
                    }
                    if (this.onDataChannelOpen) {
                        this.onDataChannelOpen(easyrtcId);
                    }
                }
            }
            else {
                if (this.peerConns[easyrtcId].dataChannelReady) {
                    this.peerConns[easyrtcId].dataChannelReady = isOpen;
                    if (this.onDataChannelClose) {
                        this.onDataChannelClose(easyrtcId);
                    }
                }
            }
        };
        /**
         * This is the data channel text helper.
         * @param callId
         * @param message
         */
        Easyrtc.prototype.distributeTextMessageByCallId = function (callId, message) {
            var easyrtcId = this.callIdToEasyrtcId(callId);
            if (!easyrtcId) {
                this.debugOut("Warning: peer message received from callId with no easyrtcid ", callId, message);
                return; // this shouldn't be possible
            }
            try {
                var jsonmessage = JSON.parse(message);
                try {
                    this.receivePeerDistribute(easyrtcId, jsonmessage);
                }
                catch (applicationError) {
                    this.showError(this.errCodes.DEVELOPER_ERR, "application callback failed with incoming message " + JSON.stringify(jsonmessage));
                    this.debugOut("application error:", applicationError);
                }
            }
            catch (badjsonerror) {
                this.showError(this.errCodes.DEVELOPER_ERR, "Received peer message that wasn't json format: " + message);
            }
        };
        /** Get server defined fields associated with a particular room. Only valid
         * after a connection has been made.
         * @param {String} roomName - the name of the room you want the fields for.
         * @returns {Object} A dictionary containing entries of the form {key:{'fieldName':key, 'fieldValue':value1}} or undefined
         * if you are not connected to the room.
         */
        Easyrtc.prototype.getRoomFields = function (roomName) {
            this.roomControl.getRoomFields(roomName);
        };
        /** Get server defined fields associated with the current application. Only valid
         * after a connection has been made.
         * @returns {Object} A dictionary containing entries of the form {key:{'fieldName':key, 'fieldValue':value1}}
         */
        Easyrtc.prototype.getApplicationFields = function () {
            throw "getapplicationFields not supported yet";
        };
        /** Get server defined fields associated with the connection. Only valid
         * after a connection has been made.
         * @returns {Object} A dictionary containing entries of the form {key:{'fieldName':key, 'fieldValue':value1}}
         */
        Easyrtc.prototype.getConnectionFields = function () {
            throw "getConnectionFields not supported yet";
        };
        /**
         * Supply a socket.io connection that will be used instead of allocating a new socket.
         * The expected usage is that you allocate a websocket, assign options to it, call
         * easyrtc.useThisSocketConnection, followed by easyrtc.connect or easyrtc.easyApp. Easyrtc will not attempt to
         * close sockets that were supplied with easyrtc.useThisSocketConnection.
         * @param {Object} alreadyAllocatedSocketIo A value allocated with the connect method of socket.io.
         */
        Easyrtc.prototype.useThisSocketConnection = function (alreadyAllocatedSocketIo) {
            throw "useThisSocketConnection not currently supported in Enterprise";
        };
        Easyrtc.prototype.roomControlHandlerBuilder = function () {
            var self = this;
            /**
             * Called when the local client is removed from a room.
             * @param roomName
             */
            function selfRemovedFromRoom(roomName) {
                delete self.roomData[roomName];
                if (self.roomEntryListener) {
                    self.roomEntryListener(false, roomName);
                }
            }
            /**
             * Called when the local client is added to a room.
             * @param roomName
             */
            function selfAddedToRoom(roomName) {
                self.roomData[roomName] = self.roomData[roomName] || {};
                if (self.roomEntryListener) {
                    self.roomEntryListener(true, roomName);
                }
            }
            /**
             * Called when we first join a room, and somebody else joins/leaves a room/
             * @param roomName
             * @param peers a list of peers.
             */
            function peersInRoomUpdated(roomName, peers) {
                self.roomData[roomName] = peers;
                var peerData = {};
                for (var peerIn in peers) {
                    if (peerIn !== self.myEasyrtcid) {
                        peerData[peerIn] = {};
                    }
                }
                self.lastLoggedInList[roomName] = peerData;
                if (self.roomOccupantListener) {
                    self.roomOccupantListener(roomName, peerData, false);
                }
            }
            /**
             * Called when we receive a message from a peer.
             * @param message
             * @param fromPeer
             * @param inRoom
             */
            function sawPeerMessage(message, fromPeer, inRoom) {
            }
            var observer = {
                selfRemovedFromRoom: selfRemovedFromRoom,
                selfAddedToRoom: selfAddedToRoom,
                peersInRoomUpdated: peersInRoomUpdated,
                sawPeerMessage: sawPeerMessage
            };
            return observer;
        };
        ;
        Easyrtc.prototype.callControlEventHandlerBuilder = function () {
            var self = this;
            var result = {
                onMediaRequest: function (callId, streamLabel) {
                    return new Promise(function (resolve, reject) {
                        if (self.getLocalMediaStreamByName(streamLabel)) {
                            resolve(self.getLocalMediaStreamByName(streamLabel));
                        }
                        else if (streamLabel == "default") {
                            self.initMediaSource(function (mediaStream) {
                                resolve(mediaStream);
                            }, function (errorCode, errorText) {
                                reject(new Error(errorText));
                            }, streamLabel);
                        }
                        else {
                            reject(new Error("Request for unknown stream" + streamLabel));
                        }
                    });
                },
                onCCSisAlive: function () {
                    self.debugOut("CCS is alive");
                },
                onDataChannelOpen: function (callId) {
                    self.onDataChannelOpenHelper(callId, true);
                    // self.updateConfigurationInfo();
                },
                onDataChannelClose: function (callId) {
                    self.onDataChannelOpenHelper(callId, false);
                },
                dataChannelError: function (callId, message) {
                },
                onDataChannelTextMessage: function (callId, message) {
                    self.distributeTextMessageByCallId(callId, message);
                },
                onDataChannelBinaryMessage: function (callId, message) {
                },
                onCallError: function (callId, errorText) {
                },
                onIceChange: function (callId, event, iceState) {
                    self.IceConnectionStateHandler(callId, event, iceState);
                },
                onStreamAdded: function (callId, stream) {
                    self.onAddStreamHelper(callId, stream);
                },
                onStreamRemoved: function (callId, stream) {
                    self.debugOut("saw remove on remote media stream");
                    self.onRemoveStreamHelper(callId, stream);
                },
                onCallStart: function (callId, peerId, callConstraints) {
                    self.handleCallIdStart(callId, peerId, callConstraints);
                },
                onCallFailed: function (callId) {
                    self.handleCallIdFailed(callId);
                },
                onCallEnd: function (callId) {
                    self.handleCallIdEnd(callId);
                },
                sawCodecs: function (audioCodecs, videoCodecs) {
                    // do nothing yet
                }
            };
            return result;
        };
        ;
        /**
         * Connects to the EasyRTC signaling server. You must connect before trying to
         * call other users.
         * @param {String} applicationName is a string that identifies the application so that different applications can have different
         *        lists of users. Note that the server configuration specifies a regular expression that is used to check application names
         *        for validity. The default pattern is that of an identifier, spaces are not allowed.
         * @param {Function} successCallback (easyrtcId, roomOwner) - is called on successful connect. easyrtcId is the
         *   unique name that the client is known to the server by. A client usually only needs it's own easyrtcId for debugging purposes.
         *       roomOwner is true if the user is the owner of a room. It's value is random if the user is in multiple rooms.
         * @param {Function} errorCallback (errorCode, errorText) - is called on unsuccessful connect. if null, an alert is called instead.
         *  The errorCode takes it's value from easyrtc.errCodes.
         * @example
         *   easyrtc.connect("my_chat_app",
         *                   function(easyrtcid, roomOwner){
         *                       if( roomOwner){ console.log("I'm the room owner"); }
         *                       console.log("my id is " + easyrtcid);
         *                   },
         *                   function(errorText){
         *                       console.log("failed to connect ", erFrText);
         *                   });
         */
        Easyrtc.prototype.connect = function (applicationName, successCallback, errorCallback) {
            var _this = this;
            if (this.transportBuilder) {
                if (this.callControl) {
                    this.showError(this.errCodes.DEVELOPER_ERR, "Attempt to connect when already connected to socket server");
                    return;
                }
            }
            this.debugOut("attempt to connect to WebRTC signalling server with application name=" + applicationName);
            if (errorCallback === null) {
                errorCallback = function (errorCode, errorText) {
                    this.showError(errorCode, errorText);
                };
            }
            var transportBuilderListener = {
                onConnectionSuccess: function () {
                    _this.debugOut("Connected to mqtt server");
                    _this.myEasyrtcid = _this.transportBuilder.getUserId();
                    _this.debugOut("My id is ", _this.myEasyrtcid);
                    _this.callControl = new CCC.CallControlClient(_this.transportBuilder.build("ccs"), _this.callControlEventHandlerBuilder());
                    _this.callControl.enableLogging(true);
                    _this.roomControl = new RCC.RoomControlClient(_this.transportBuilder.build("roomControl3"), _this.roomControlHandlerBuilder());
                    if (_this.roomsToJoinOnConnect.length == 0) {
                        _this.roomControl.JoinRoom("default");
                    }
                    else {
                        for (var i = 0; i < _this.roomsToJoinOnConnect.length; i++) {
                            _this.roomControl.JoinRoom(_this.roomsToJoinOnConnect[i]);
                        }
                    }
                    _this.debugOut("attempted to join rooms");
                    successCallback(_this.myEasyrtcid, false);
                },
                onConnectionFailure: function (reason) {
                    errorCallback(_this.errCodes.CONNECT_ERR, reason);
                },
                onConnectionLost: function (errorMessage) {
                    if (_this.disconnectListener) {
                        _this.disconnectListener();
                    }
                },
            };
            this.transportBuilder = new MQTTTransport_1.MQTTBuilder();
            this.transportBuilder.enableLogging(true);
            this.transportBuilder.connect(this.serverHost, this.serverPort, transportBuilderListener);
        };
        ;
        /**
         * Error codes that the EasyRTC will use in the errorCode field of error object passed
         * to error handler set by easyrtc.setOnError. The error codes are short printable strings.
         * @type Object
         */
        Easyrtc.errCodes = {
            BAD_NAME: "BAD_NAME",
            CALL_ERR: "CALL_ERR",
            DEVELOPER_ERR: "DEVELOPER_ERR",
            SYSTEM_ERR: "SYSTEM_ERR",
            CONNECT_ERR: "CONNECT_ERR",
            MEDIA_ERR: "MEDIA_ERR",
            MEDIA_WARNING: "MEDIA_WARNING",
            INTERNAL_ERR: "INTERNAL_ERR",
            PEER_GONE: "PEER_GONE",
            ALREADY_CONNECTED: "ALREADY_CONNECTED",
            BAD_CREDENTIAL: "BAD_CREDENTIAL",
            ICECANDIDATE_ERR: "ICECANDIDATE_ERR",
            NOVIABLEICE: "NOVIABLEICE",
            SIGNAL_ERR: "SIGNAL_ERR"
        };
        Easyrtc.apiVersion = "1.0.18-beta";
        /** Most basic message acknowledgment object */
        Easyrtc.ackMessage = { msgType: "ack" };
        /** Regular expression pattern for user ids. This will need modification to support non US character sets */
        Easyrtc.usernameRegExp = /^(.){1,64}$/;
        /** Default cookieId name */
        Easyrtc.cookieId = "easyrtcsid";
        /** @private */
        Easyrtc.dataChannelName = "dc";
        return Easyrtc;
    }());
    exports.Easyrtc = Easyrtc;
    ;
    window["easyrtc"] = new Easyrtc();
});
