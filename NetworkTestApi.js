define(["require", "exports", "./MQTTTransport", "./callControlClient", "./MediaResources"], function (require, exports, MQTTTransport_1, callControlClient_1, MediaResources_1) {
    "use strict";
    function getTimeString() {
        return (new Date()).toLocaleTimeString();
    }
    /**
     * Structure of the test result.
     */
    var NetworkTestResult = (function () {
        function NetworkTestResult() {
            this.elapsedTimeInMS = 0;
            this.frameRateSent = 0;
            this.frameRateReceived = 0;
            this.kilobytesOut = 0;
            this.kilobytesIn = 0;
            this.dataChannelMessagesSent = 0;
            this.dataChannelMessagesReceived = 0;
            this.wasSuccessful = false;
            this.wasAllocatedPeer = false;
            this.establishedPeerConnection = false;
            this.audioPacketsLost = 0;
            this.videoPacketsLost = 0;
            this.failedToGetMediaStream = false;
            this.audioCodecs = [];
            this.videoCodecs = [];
            this.sawLocalFrame = false;
            this.sawRemoteFrame = false;
            this.dataChannelPingTimeInMS = undefined;
        }
        return NetworkTestResult;
    }());
    exports.NetworkTestResult = NetworkTestResult;
    var NetworkTestApi = (function () {
        function NetworkTestApi() {
            this.lastConstraintsAsJSON = "";
            this.maxElapsedTime = 10000; // 10 seconds in millis.
            this.maxDataReceivedInKB = 1e3; // data size in kilobytes.
            this.maxDataSentInKB = 1e3;
            this.currentlyInTest = false;
            this.loggingEnabled = false;
            this.haveInitiatedCall = {};
            this.numberMessagesToSend = 100;
            this.cameraDeviceId = null;
            this.microphoneDeviceId = null;
            this.dataChannelPingSendTimes = [];
            this.dataChannelPingReceiveTimes = [];
            this.ResetTestParameters();
            this.localVideoObj = document.createElement("video");
            this.localVideoObj.muted = true;
            this.remoteVideoObj = document.createElement("video");
            this.localVideoObj.muted = true;
            this.renderCanvas = document.createElement("canvas");
            this.renderCanvas.width = 20;
            this.renderCanvas.height = 20;
        }
        /**
         * This call enables certain log messages. The messages get printed via console.log. You should call it, if you are
         * going to at all, right after creating the NetworkTestApi objectg so that the logging flag gets passed to the
         * helper objects.
         * @param value
         */
        NetworkTestApi.prototype.enableLogging = function (value) {
            this.loggingEnabled = value;
        };
        /** Sets the camera used for a local media stream when you call initialize
         * @param deviceId: a deviceId from a DeviceInfo element returned by GetCameraList
         */
        NetworkTestApi.prototype.SetCameraDevice = function (deviceId) {
            this.cameraDeviceId = deviceId;
        };
        /** Sets the microphone used for a local media stream when you call initialize
         * @param deviceId: a deviceId from a DeviceInfo element returned by GetMicrophoneList
         *
         */
        NetworkTestApi.prototype.SetMicrophoneDevice = function (deviceId) {
            this.microphoneDeviceId = deviceId;
        };
        NetworkTestApi.prototype.stopCurrentCall = function (callId) {
            var _this = this;
            if (!this.haveInitiatedCall[callId]) {
                if (this.enableLogging) {
                    console.log(getTimeString(), "stopCurrentCall ignored for callid ", callId, "presumed done already");
                }
                return;
            }
            else {
                if (this.enableLogging) {
                    console.log(getTimeString(), "stopCurrentCall in progress for ", callId);
                }
            }
            if (this.dataChannelPingSendTimes && this.dataChannelPingReceiveTimes.length > 0) {
                var sum = 0;
                var n = Math.min(this.dataChannelPingSendTimes.length, this.dataChannelPingReceiveTimes.length);
                for (var i = 0; i < n; i++) {
                    sum += this.dataChannelPingReceiveTimes[i] - this.dataChannelPingSendTimes[i];
                }
                this.testResult.dataChannelPingTimeInMS = sum / n;
            }
            delete this.haveInitiatedCall[callId];
            if (this.statisticsTimer) {
                clearTimeout(this.statisticsTimer);
                this.statisticsTimer = 0;
            }
            if (this.connectTimer) {
                clearTimeout(this.connectTimer);
                this.connectTimer = 0;
            }
            if (this.loggingEnabled) {
                console.log(getTimeString(), " stopping current call for some reason");
            }
            this.callControl.endCall(callId);
            if (this.callConstraints.mediaConstraints.mediaEnabled &&
                (!this.testResult.sawLocalFrame || !this.testResult.sawRemoteFrame)) {
                this.testResult.wasSuccessful = false;
            }
            var theResult = this.testResult;
            //
            // return the results to the caller after we've had time to finish any remaining messaging.
            // this prevents a new test from starting before the old messaging ends.
            //
            setTimeout(function () {
                _this.resultListener.testDone(theResult);
            }, 200);
        };
        NetworkTestApi.prototype.renderAndCheckFrame = function (videoObj) {
            var ctx = this.renderCanvas.getContext("2d");
            ctx.fillStyle = "rgb(0,0,0)";
            ctx.fillRect(0, 0, this.renderCanvas.width, this.renderCanvas.height);
            ctx.drawImage(videoObj, 0, 0);
            var imgData = ctx.getImageData(0, 0, this.renderCanvas.width, this.renderCanvas.height);
            var data = imgData.data;
            //
            // look for variation in the pixel data. The pixel data is in the order rgba.
            for (var i = 4; i < data.length; i += 4) {
                if (data[i] != data[0] || data[i + 1] != data[1] || data[i + 2] != data[2]) {
                    return true;
                }
            }
            return false;
        };
        NetworkTestApi.prototype.startStatisticsCollecting = function () {
            var _this = this;
            var statsStartTimeInMS = Date.now();
            var callIdInProgress = this.currentCallId;
            var statsCollector = function () {
                _this.callControl.getStatistics(_this.currentCallId).then(function (stats) {
                    _this.testResult.kilobytesIn = (stats.audioBytesReceived + stats.videoBytesReceived) / 1024;
                    _this.testResult.kilobytesOut = (stats.audioBytesSent + stats.videoBytesSent) / 1024;
                    _this.testResult.frameRateReceived = stats.frameRateReceived;
                    _this.testResult.frameRateSent = stats.frameRateSent;
                    _this.testResult.audioPacketsLost = stats.audioPacketsLost;
                    _this.testResult.videoPacketsLost = stats.videoPacketsLost;
                    _this.testResult.reflexiveAddresses = stats.reflexiveAddresses;
                    if (_this.testConstraints.mediaConstraints.mediaEnabled) {
                        if (stats.videoBytesReceived > 0 && !_this.testResult.sawRemoteFrame) {
                            _this.testResult.sawRemoteFrame = _this.renderAndCheckFrame(_this.remoteVideoObj);
                        }
                        if (!_this.testResult.sawLocalFrame) {
                            _this.testResult.sawLocalFrame = _this.renderAndCheckFrame(_this.localVideoObj);
                        }
                    }
                    _this.testResult.elapsedTimeInMS = Date.now() - statsStartTimeInMS;
                    _this.testResult.wasSuccessful =
                        _this.testResult.wasAllocatedPeer &&
                            _this.testResult.establishedPeerConnection &&
                            (!_this.testConstraints.mediaConstraints.dataChannelEnabled ||
                                (_this.testResult.dataChannelMessagesReceived === _this.numberMessagesToSend &&
                                    _this.testResult.dataChannelMessagesSent == _this.numberMessagesToSend)) &&
                            (!_this.testConstraints.mediaConstraints.mediaEnabled ||
                                (_this.testResult.kilobytesIn >= _this.maxDataReceivedInKB &&
                                    _this.testResult.kilobytesOut >= _this.maxDataSentInKB));
                    if (_this.testResult.elapsedTimeInMS >= _this.maxElapsedTime) {
                        console.log(getTimeString(), " Stopping test due to time expiry");
                        _this.stopCurrentCall(callIdInProgress);
                    }
                    else if (_this.testResult.wasSuccessful) {
                        console.log(getTimeString(), " Stopping test due to success");
                        _this.stopCurrentCall(callIdInProgress);
                    }
                    else if (callIdInProgress === _this.currentCallId) {
                        _this.statisticsTimer = setTimeout(statsCollector, 1000);
                    }
                }, function (error) {
                    console.log(getTimeString(), " Unable to get statistics", error);
                });
            };
            statsCollector(); // start the first iteration, the ith iteration starts the (i+1)th iteration.
        };
        /**
         * Connect to the signalling server. You shouldn't run any tests until the listeners onConnectionSuccess method fires.
         * @param url
         * @param port
         * @param listener
         */
        NetworkTestApi.prototype.initialize = function (url, port, listener) {
            var _this = this;
            console.log(getTimeString(), "Entered initialize method");
            this.ResetTestParameters();
            console.log(getTimeString(), "got about to connect");
            this.transportBuilder = new MQTTTransport_1.MQTTBuilder();
            this.transportBuilder.enableLogging(this.loggingEnabled);
            console.log(getTimeString(), "got media, about to connect");
            var transportBuilderListener = {
                onConnectionSuccess: function () {
                    _this.callControl = new callControlClient_1.CallControlClient(_this.transportBuilder.build("CCS"), _this.callControlHandler);
                    _this.callControl.enableLogging(_this.loggingEnabled);
                    listener.onConnectionSuccess();
                },
                onConnectionFailure: function (reason) {
                    listener.onConnectionFailure(reason);
                },
                onConnectionLost: function (errorMessage) {
                    listener.onConnectionLost(errorMessage);
                },
            };
            this.transportBuilder = new MQTTTransport_1.MQTTBuilder();
            this.transportBuilder.connect(url, port, transportBuilderListener);
            this.callControlHandler = {
                onMediaRequest: function (callId, streamLabel) {
                    return new Promise(function (resolve, reject) {
                        resolve(this.localMediaStream);
                    });
                },
                sawCodecs: function (audioCodecs, videoCodecs) {
                    _this.testResult.audioCodecs = audioCodecs;
                    _this.testResult.videoCodecs = videoCodecs;
                },
                onCallFailed: function (callId) {
                    if (_this.haveInitiatedCall[callId]) {
                        _this.testResult.wasSuccessful = false;
                        _this.stopCurrentCall(callId);
                    }
                },
                onCCSisAlive: function () {
                    _this.testResult.ccsIsAlive = true;
                },
                onDataChannelOpen: function (callId) {
                    for (var i = 0; i < _this.numberMessagesToSend; i++) {
                        // we may need to add some scope field and make this json to work with the headless client.
                        _this.dataChannelPingSendTimes.push(window.performance.now());
                        _this.callControl.sendDataChannelMessage(callId, "This is a test message ");
                        _this.testResult.dataChannelMessagesSent++;
                    }
                },
                onDataChannelClose: function (callId) {
                },
                dataChannelError: function (callId, message) {
                    console.log(getTimeString(), " oops data channel error", message);
                },
                onDataChannelTextMessage: function (callId, message) {
                    _this.testResult.dataChannelMessagesReceived++;
                    _this.dataChannelPingReceiveTimes.push(window.performance.now());
                },
                onDataChannelBinaryMessage: function (callId, message) {
                },
                onCallError: function (callId, errorText) {
                    if (_this.loggingEnabled) {
                        console.log(getTimeString(), " saw call error", errorText);
                    }
                },
                onIceChange: function (callId, iceState) {
                    if (_this.loggingEnabled) {
                        console.log(getTimeString(), " for callId" + callId + " saw ice change to " + iceState);
                    }
                    if (callId != _this.currentCallId) {
                        return;
                    }
                    switch (iceState) {
                        case "new":
                            break; // nothing interesting
                        case "checking":
                            break;
                        case "connected":
                            _this.startStatisticsCollecting();
                            _this.testResult.establishedPeerConnection = true;
                            clearTimeout(_this.connectTimer);
                            break;
                        case "completed":
                            break;
                        case "failed":
                            _this.testResult.wasSuccessful = false;
                            _this.testResult.establishedPeerConnection = false;
                            _this.stopCurrentCall(_this.currentCallId);
                            break;
                        case "disconnected":
                            _this.stopCurrentCall(_this.currentCallId);
                            break;
                        case "closed": {
                            _this.stopCurrentCall(_this.currentCallId);
                            break;
                        }
                    }
                    if (_this.loggingEnabled) {
                        console.log(getTimeString(), " current ice state is ", iceState);
                    }
                },
                onStreamAdded: function (callId, stream) {
                    if (_this.loggingEnabled) {
                        console.log(getTimeString(), " received media stream");
                    }
                    MediaResources_1.SetVideoObjectSrc(_this.remoteVideoObj, stream);
                    if (_this.resultListener.sawRemoteMediaStream) {
                        _this.resultListener.sawRemoteMediaStream(stream);
                    }
                },
                onStreamRemoved: function (callId, stream) {
                    if (_this.loggingEnabled) {
                        console.log(getTimeString(), " media stream removed");
                    }
                },
                onCallStart: function (callId) {
                    if (_this.loggingEnabled) {
                        console.log(getTimeString(), " call started.");
                    }
                    _this.haveInitiatedCall[callId] = true;
                    _this.currentCallId = callId;
                    _this.testResult.wasAllocatedPeer = true;
                },
                onCallEnd: function (callId) {
                    _this.stopCurrentCall(callId);
                }
            };
        };
        ;
        /**
         * Enable or disable the use of direct (host) connections .
         * @param value
         * @returns {NetworkTestApi}
         * @constructor
         */
        NetworkTestApi.prototype.EnableDirect = function (value) {
            this.callConstraints.networkConstraints.allowDirect = value;
            return this;
        };
        /**
         * Enable or disable the use of stun servers.
         * @param value
         * @returns {NetworkTestApi}
         * @constructor
         */
        NetworkTestApi.prototype.EnableStun = function (value) {
            this.callConstraints.networkConstraints.allowStun = value;
            return this;
        };
        /**
         * Enable or disable the use of turn servers
         * @param value
         * @returns {NetworkTestApi}
         * @constructor
         */
        NetworkTestApi.prototype.EnableTurn = function (value) {
            this.callConstraints.networkConstraints.allowTurn = value;
            return this;
        };
        /**
         * Enable or disable the use of UDP transport with turn servers.
         * @param value
         * @returns {NetworkTestApi}
         * @constructor
         */
        NetworkTestApi.prototype.EnableUdp = function (value) {
            this.callConstraints.networkConstraints.allowUdp = value;
            return this;
        };
        /**
         * Enable or disable the use of TCP with turn servers.
         * @param value
         * @returns {NetworkTestApi}
         * @constructor
         */
        NetworkTestApi.prototype.EnableTcp = function (value) {
            this.callConstraints.networkConstraints.allowTcp = value;
            return this;
        };
        /** Restrict stun and turn servers to using just a particular port.
         * @param port use a port <= 0 to clear this field.
         */
        NetworkTestApi.prototype.UseOnlyPort = function (port) {
            this.callConstraints.networkConstraints.restrictToPort = port;
            return this;
        };
        /** Enable or disable data channel testing.
         *
         * @param value
         * @returns {NetworkTestApi}
         * @constructor
         */
        NetworkTestApi.prototype.EnableDataChannels = function (value) {
            this.callConstraints.mediaConstraints.dataChannelEnabled = value;
            return this;
        };
        /** Enable or disable media stream testing.
         *
         * @param value
         * @returns {NetworkTestApi}
         * @constructor
         */
        NetworkTestApi.prototype.EnableMediaStream = function (value) {
            this.callConstraints.mediaConstraints.mediaEnabled = value;
            return this;
        };
        NetworkTestApi.prototype.SetVideoResolution = function (width, height) {
            this.callConstraints.mediaConstraints.width = width;
            this.callConstraints.mediaConstraints.height = height;
            return this;
        };
        /**
         * Resets all parameters back to their original 'factory' values.
         * The original factory values are: allow all networks, test both media streams and data channels.
         * @returns {NetworkTestApi}
         */
        NetworkTestApi.prototype.ResetTestParameters = function () {
            var nc;
            this.callConstraints = nc;
            return this;
        };
        /**
         * The test should not last longer than this time.
         * @param durationInMS
         */
        NetworkTestApi.prototype.SetTestDuration = function (durationInMS) {
            this.maxElapsedTime = durationInMS;
            return this;
        };
        /**
         * The test should end after sending and receiving this much data in a media stream.
         * @param kBytesSent
         * @param kbytesReceived
         */
        NetworkTestApi.prototype.SetDataLimit = function (kBytesSent, kbytesReceived) {
            this.maxDataSentInKB = kBytesSent;
            this.maxDataReceivedInKB = kbytesReceived;
            return this;
        };
        /**
         * Run a single test. You cannot run two tests concurrently yet, one at a time please.
         * @param listener
         */
        NetworkTestApi.prototype.RunTest = function (listener) {
            var _this = this;
            this.dataChannelPingSendTimes = [];
            this.dataChannelPingReceiveTimes = [];
            if (this.loggingEnabled) {
                console.log(getTimeString(), " RunTest invoked");
            }
            var mediaConstraints = {
                video: true,
                audio: true
            };
            if (!this.callConstraints.mediaConstraints.mediaEnabled) {
                mediaConstraints.video = false;
                mediaConstraints.audio = false;
            }
            else if (this.cameraDeviceId === "none") {
                mediaConstraints.video = false;
            }
            else {
                var t = {};
                if (this.cameraDeviceId) {
                    t.deviceId = this.cameraDeviceId;
                }
                if (this.callConstraints.mediaConstraints.width) {
                    t.width = {
                        exact: this.callConstraints.mediaConstraints.width
                    };
                }
                if (this.callConstraints.mediaConstraints.height) {
                    t.height = {
                        exact: this.callConstraints.mediaConstraints.height
                    };
                }
                mediaConstraints.video = t;
            }
            if (this.microphoneDeviceId === "none") {
                mediaConstraints.audio = false;
            }
            else if (this.microphoneDeviceId) {
                mediaConstraints.audio = { deviceId: this.microphoneDeviceId };
            }
            else {
                mediaConstraints.audio = true;
            }
            var newConstraintString = JSON.stringify(mediaConstraints);
            var runTheTest = function () {
                if (_this.localMediaStream && _this.callConstraints.mediaConstraints.mediaEnabled) {
                    MediaResources_1.SetVideoObjectSrc(_this.localVideoObj, _this.localMediaStream);
                    listener.sawLocalMediaStream(_this.localMediaStream);
                }
                _this.testConstraints = JSON.parse(JSON.stringify(_this.callConstraints));
                _this.resultListener = listener;
                _this.testResult = new NetworkTestResult();
                _this.callControl.startCallWithPeerType("rtctest_headless", _this.testConstraints, "default", "default");
                _this.connectTimer = setTimeout(function () {
                    _this.testResult.wasSuccessful = false;
                    if (_this.loggingEnabled) {
                        console.log(getTimeString(), " unable to get ice connection after " + (_this.maxElapsedTime / 1000) + "seconds.");
                    }
                    _this.stopCurrentCall(_this.currentCallId);
                }, _this.maxElapsedTime);
            };
            console.log("media constraints = ", newConstraintString);
            if (newConstraintString == this.lastConstraintsAsJSON) {
                runTheTest();
            }
            else {
                this.closeLocalMediaStream();
                if (this.callConstraints.mediaConstraints.mediaEnabled) {
                    navigator.getUserMedia(mediaConstraints, function (stream) {
                        _this.localMediaStream = stream;
                        _this.lastConstraintsAsJSON = newConstraintString;
                        runTheTest();
                    }, function (error) {
                        console.log(error.message);
                        _this.testResult.failedToGetMediaStream = true;
                        _this.testResult.wasSuccessful = false;
                        _this.lastConstraintsAsJSON = "";
                        listener.testDone(_this.testResult);
                    });
                }
                else {
                    runTheTest();
                }
            }
        };
        //
        // close the current local media stream so we can open a new one with
        // different characteristics.
        //
        NetworkTestApi.prototype.closeLocalMediaStream = function () {
            if (this.localMediaStream) {
                for (var _i = 0, _a = this.localMediaStream.getVideoTracks(); _i < _a.length; _i++) {
                    var videoTrack = _a[_i];
                    videoTrack.stop();
                }
                for (var _b = 0, _c = this.localMediaStream.getAudioTracks(); _b < _c.length; _b++) {
                    var audioTrack = _c[_b];
                    audioTrack.stop();
                }
                this.localMediaStream = null;
            }
        };
        /**
         * Close connection to the signalling server.
         */
        NetworkTestApi.prototype.close = function () {
            console.log("closing the transport");
            if (this.transportBuilder) {
                this.transportBuilder.close();
            }
            this.closeLocalMediaStream();
        };
        return NetworkTestApi;
    }());
    exports.NetworkTestApi = NetworkTestApi;
});
