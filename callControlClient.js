/**
 * Created by eric on 01/09/16.
 */
define(["require", "exports"], function (require, exports) {
    "use strict";
    function getTimeString() {
        return (new Date()).toLocaleTimeString();
    }
    /**
     * This class defines the structure of data returned by getStatistics.It is a heavily massaged version of the statistics
     * provided by the native webrtc functions. Not all fields will be populated in the first release.
     */
    var CallStats = (function () {
        function CallStats() {
            this.audioBytesSent = 0;
            this.audioBytesReceived = 0;
            this.videoBytesSent = 0;
            this.videoBytesReceived = 0;
            this.audioPacketsSent = 0;
            this.audioPacketsReceived = 0;
            this.videoPacketsSent = 0;
            this.videoPacketsReceived = 0;
            this.videoPacketsLost = 0;
            this.audioPacketsLost = 0;
            this.frameRateSent = 0;
            this.frameRateReceived = 0;
            this.intervalInMS = 0;
            this.remotePortUsed = 0;
            this.remoteIpAddress = "";
            this.localPortUsed = 0;
            this.localIpAddress = "";
            this.reflexiveAddresses = [];
        }
        return CallStats;
    }());
    exports.CallStats = CallStats;
    ;
    var NetworkConstraints = (function () {
        function NetworkConstraints() {
        }
        NetworkConstraints.newInstance = function () {
            var result = {
                allowDirect: true,
                allowStun: true,
                allowTurn: true,
                allowUdp: true,
                allowTcp: true,
                restrictToPort: null,
                offeringPeerId: "",
                answeringPeerId: "" // where should this go
            };
            return result;
        };
        return NetworkConstraints;
    }());
    exports.NetworkConstraints = NetworkConstraints;
    var MediaConstraints = (function () {
        function MediaConstraints() {
        }
        MediaConstraints.newInstance = function () {
            var result = {
                width: 640,
                height: 480,
                offeringStreamLabel: "default",
                requestingStreamLabel: "default",
                audioReceiveEnabled: true,
                videoReceiveEnabled: true,
                mediaEnabled: true,
                dataChannelEnabled: true
            };
            return result;
        };
        return MediaConstraints;
    }());
    exports.MediaConstraints = MediaConstraints;
    var CallConstraints = (function () {
        function CallConstraints() {
        }
        CallConstraints.newInstance = function () {
            var result = {
                networkConstraints: NetworkConstraints.newInstance(),
                mediaConstraints: MediaConstraints.newInstance()
            };
            return result;
        };
        return CallConstraints;
    }());
    exports.CallConstraints = CallConstraints;
    ;
    /**
     * This class stores per call information for the call control client. It doesn't get exposed to applications.
     */
    var SessionInfo = (function () {
        function SessionInfo() {
            this.readyForCandidates = false; // controls whether candidates are applied/sent or queued.
            this.dataChannelIsOpen = false;
            this.waitingOutgoingCandidates = [];
            this.waitingIncomingCandidates = [];
            this.sentEndCall = false; // for a onceonly pattern.
            this.reflexiveAddresses = [];
        }
        return SessionInfo;
    }());
    ;
    var CallControlClient = (function () {
        function CallControlClient(sender, applicationEventHandler) {
            this.activeSessions = {};
            this.pingSeq = 1;
            this.loggingEnabled = false;
            this.sdpRemoteFilter = null;
            this.sdpLocalFilter = null;
            this.customIceFilter = null;
            this.sender = sender; // redundant statement, but won't hurt.
            this.applicationEventHandler = applicationEventHandler;
            sender.setListener(this);
        }
        CallControlClient.prototype.SetCustomIceFilter = function (filter) {
            this.customIceFilter = filter;
        };
        //
        // Provide a filter for outgoing SDP offers. Does not affect incoming offers.
        //
        CallControlClient.prototype.SetSdpLocalFilter = function (filter) {
            this.sdpLocalFilter = filter;
        };
        //
        // Provide a filter for outgoing SDP answers. Does not affect incoming answers.
        //
        CallControlClient.prototype.SetSdpRemoteFilter = function (filter) {
            this.sdpRemoteFilter = filter;
        };
        /** Called when a successful connection is lost, ie, after onConnectionSuccess succeeds
         * @param errorMessage A humanly readable message explaining why the connection was lost.
         * */
        CallControlClient.prototype.onConnectionLost = function (errorMessage) { };
        /** Called when a message fails to send properly. In a properly running system, you wouldn't see this.
         * @param errorMessage A humanly readable message explaining why the send failed.
         * */
        CallControlClient.prototype.onSendFailure = function (errorMessage) { };
        /**
         * Part of the TransportListener interface implementation.
         * @param message - A JSON RPC message.
         */
        CallControlClient.prototype.onMessage = function (message) {
            var id = message["id"];
            if (message["method"]) {
                var method = message["method"];
                var messagePayload = message["params"];
                switch (method) {
                    case "call":
                        this.requestCall(id, messagePayload);
                        break;
                    case "callAnswerSdp":
                        this.requestCallAnswerSdp(id, messagePayload);
                        break;
                    case "callEnd":
                        this.requestCallEnd(id, messagePayload);
                        break;
                    case "callIceCandidate":
                        this.requestCallIceCandidate(id, messagePayload);
                        break;
                    case "callOfferSdp":
                        this.requestCallOfferSdp(id, messagePayload);
                        break;
                    case "callPcUpdate":
                        this.requestCallPcUpdate(id, messagePayload);
                        break;
                    case "callPing":
                        this.requestCallPing(id, messagePayload);
                        break;
                    case "callReconnect":
                        this.requestCallReconnect(id, messagePayload);
                        break;
                    case "requestCallPcStats":
                        this.requestCallPcStats(id, messagePayload);
                        break;
                    case "getPeerStatus":
                        this.requestGetPeerStatus(id, messagePayload);
                        break;
                    case "requestCapabilities":
                        this.requestCapabilities(id, messagePayload);
                        break;
                    default:
                        console.log(getTimeString(), " Saw unrecognized method ", method);
                        break;
                }
            }
            else if (message["result"]) {
                this.applyResult(id, message["result"]);
            }
            else if (message["error"]) {
                this.applyError(id, message["error"]);
            }
            else {
                console.log(getTimeString(), " Saw message with unrecognized structure ", message);
            }
        };
        /**
         * enable logging.
         * @param value
         */
        CallControlClient.prototype.enableLogging = function (value) {
            this.loggingEnabled = value;
        };
        //
        // returns true if the candidate string is allowed by the
        // networkAllow* flags in the Session info class.
        //
        CallControlClient.prototype.checkCandidate = function (candidateSdp, constraints) {
            if (typeof candidateSdp != "string") {
                console.log("this shouldn't happen!");
                return false;
            }
            if (candidateSdp.indexOf(" typ host ") > 0) {
                return constraints.networkConstraints.allowDirect;
            }
            else if (candidateSdp.indexOf(" typ srflx ") > 0) {
                return constraints.networkConstraints.allowStun;
            }
            else if (candidateSdp.indexOf(" typ relay ") > 0) {
                return constraints.networkConstraints.allowTurn;
            }
            else {
                console.log("strange candidate string, missing host,srflx and relay type field");
                return false;
            }
        };
        //
        // returns true if the ice server entry is allowed by the network constraints.
        //
        CallControlClient.prototype.checkIceServer = function (iceEntry, constraints) {
            var sampleUrl;
            if (typeof iceEntry.urls == "string") {
                sampleUrl = (iceEntry.urls);
            }
            else if (iceEntry.urls.length > 0) {
                sampleUrl = iceEntry.urls[0];
            }
            else {
                return false;
            }
            if (sampleUrl.substr(0, 5) === "stun:") {
                if (!constraints.networkConstraints.allowStun) {
                    return false;
                }
            }
            else if (sampleUrl.substr(0, 5) === "turn:") {
                if (!constraints.networkConstraints.allowTurn) {
                    return false;
                }
            }
            if (sampleUrl.indexOf("?transport=tcp") > 0) {
                if (!constraints.networkConstraints.allowTcp) {
                    return false;
                }
            }
            else if (sampleUrl.indexOf("?transport=udp") > 0) {
                if (!constraints.networkConstraints.allowUdp) {
                    return false;
                }
            }
            if (constraints.networkConstraints.restrictToPort > 0) {
                //
                // to see if a specific port was supplied, we construct the string ":port" and look for it.
                // we check the character immediately after it to see if it is a digit so we don't accept :4431 when we actually
                // were restricted to :443.
                //
                var targetString = ":" + constraints.networkConstraints.restrictToPort;
                var position = sampleUrl.indexOf(targetString);
                if (position < 0) {
                    return false;
                }
                var nextChar = sampleUrl.substr(position + targetString.length, 1);
                if (nextChar >= "0" && nextChar <= '9') {
                    return false;
                }
            }
            return true;
        };
        CallControlClient.prototype.collectCodecList = function (sdp) {
            var lines = sdp.split("\r\n");
            function findCodecs(lines, codecType) {
                var codecs = [];
                var inCodecSection = false;
                for (var ind = 0; ind < lines.length; ind++) {
                    var curLine = lines[ind];
                    if (curLine.indexOf("a=mid:") >= 0) {
                        inCodecSection = curLine.indexOf(codecType) > 0;
                    }
                    else if (inCodecSection && curLine.indexOf("a=rtpmap:") >= 0) {
                        var codecParts = curLine.split(" ");
                        var codec = codecParts[1];
                        codecs.push(codec);
                    }
                }
                return codecs;
            }
            ;
            var audioCodecs = findCodecs(lines, "audio");
            var videoCodecs = findCodecs(lines, "video");
            this.applicationEventHandler.sawCodecs(audioCodecs, videoCodecs);
        };
        //
        // helper method to initate sending an offer to the server.
        //
        CallControlClient.prototype.InitiateSendOffer = function (messageId, currentSession, pcUpdateId) {
            var _this = this;
            var receiveConstraints = {
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            };
            var setLocalAndSendMessage0 = function (sessionDescription) {
                if (!_this.activeSessions[currentSession.callId]) {
                    return;
                }
                console.log("offer was ", sessionDescription.sdp);
                _this.collectCodecList(sessionDescription.sdp);
                if (_this.sdpLocalFilter) {
                    sessionDescription.sdp = _this.sdpLocalFilter(sessionDescription.sdp, true);
                }
                var sendOffer = function () {
                    _this.sender.sendAck(messageId);
                    var offerBody = {
                        "callId": currentSession.callId,
                        "pcId": currentSession.pcId,
                        "offerSdp": sessionDescription.sdp
                    };
                    if (pcUpdateId) {
                        offerBody.pcUpdateId = pcUpdateId;
                    }
                    _this.sender.sendRequest("callOfferSdp", offerBody);
                };
                currentSession.call.setLocalDescription(sessionDescription, sendOffer, function (errorText) {
                    this.sender.sendError(messageId, -1, errorText);
                });
            };
            currentSession.call.createOffer(setLocalAndSendMessage0, function (errorObj) {
                currentSession.iceState = "failed";
                this.applicationEventHandler.onIceChange(currentSession.callId, currentSession.iceState);
                this.applicationEventHandler.onCallFailed(currentSession.callId);
            }, receiveConstraints);
        };
        //
        // helper method to initate sending an answer to the server
        //
        CallControlClient.prototype.InitiateSendAnswer = function (messageId, currentSession, pcUpdateId) {
            var _this = this;
            var self = this;
            var receiveConstraints = {};
            if (currentSession.outgoingStream) {
                currentSession.call.addStream(currentSession.outgoingStream);
            }
            var setLocalAndSendMessage0 = function (sessionDescription) {
                console.log("entered setLocalAndSendMessage0 with description", sessionDescription);
                if (!_this.activeSessions[currentSession.callId]) {
                    return;
                }
                if (_this.sdpLocalFilter) {
                    sessionDescription.sdp = _this.sdpLocalFilter(sessionDescription.sdp, false);
                    console.log("changing to  ", sessionDescription.sdp);
                }
                var sendAnswer = function () {
                    console.log("entered sendAnswer");
                    _this.sender.sendAck(messageId);
                    var answerBody = {
                        "callId": currentSession.callId,
                        "pcId": currentSession.pcId,
                        "answerSdp": sessionDescription.sdp
                    };
                    if (pcUpdateId) {
                        answerBody.pcUpdateId = pcUpdateId;
                    }
                    _this.sender.sendRequest("callAnswerSdp", answerBody);
                    if (pcUpdateId) {
                        _this.sender.sendRequest("callPcUpdated", {
                            callId: currentSession.callId,
                            pcId: currentSession.pcId,
                            pcDefinition: {},
                            pcUpdateId: pcUpdateId
                        });
                    }
                    _this.flushCandidates(currentSession);
                };
                var a;
                console.log("about to call setLocalDescription");
                currentSession.call.setLocalDescription(sessionDescription, sendAnswer, function (error) {
                    if (self.loggingEnabled) {
                        console.log("failed to setLocalDescription ", error.toString());
                    }
                    self.sender.sendError(messageId, -1, error.toString(), {});
                });
            };
            console.log("about to call create answer");
            currentSession.call.createAnswer(receiveConstraints).then(setLocalAndSendMessage0, function (error) {
                console.log("create answer failed with ", error, error.message);
                currentSession.iceState = "failed";
                self.applicationEventHandler.onIceChange(currentSession.callId, currentSession.iceState);
                self.applicationEventHandler.onCallFailed(currentSession.callId);
            });
        };
        //
        // this method causes any queued remote candidates to applied and locally generated
        // candidates to be sent out, for a particular session. It should be called once an
        // answer has been successfully applied (at either end of a peer connection.
        //
        CallControlClient.prototype.flushCandidates = function (currentSession) {
            currentSession.readyForCandidates = true;
            for (var _i = 0, _a = currentSession.waitingOutgoingCandidates; _i < _a.length; _i++) {
                var outgoingCandidate = _a[_i];
                this.sender.sendRequest("callIceCandidate", {
                    "callId": currentSession.callId,
                    "pcId": currentSession.pcId,
                    "iceCandidate": outgoingCandidate
                });
            }
            for (var _b = 0, _c = currentSession.waitingIncomingCandidates; _b < _c.length; _b++) {
                var incomingCandidate = _c[_b];
                currentSession.call.addIceCandidate(incomingCandidate);
            }
            currentSession.waitingIncomingCandidates = [];
            currentSession.waitingOutgoingCandidates = [];
        };
        //
        // this method validates that the supplied params contains fields listed by fieldNames.
        // it does not check the types of those fields.
        //
        CallControlClient.prototype.verifyJsonFields = function (params, fieldNames) {
            for (var _i = 0, fieldNames_1 = fieldNames; _i < fieldNames_1.length; _i++) {
                var fieldName = fieldNames_1[_i];
                if (typeof params[fieldName] == "undefined") {
                    return false;
                }
            }
            return true;
        };
        CallControlClient.prototype.getTimeStamp = function () {
            // this isn't quite the right format, but it may suffice now. It's only used in pong messages.
            return Date();
        };
        /**
         * This method ensures that the iceServer entries passed to us by the server have the right shape.
         * @param srcIce
         * @returns {RTCIceServer[]}
         */
        CallControlClient.prototype.repackIceServers = function (srcIce) {
            var result = [];
            if (!(srcIce instanceof Array)) {
                console.log("Bad ice server list passed down", srcIce);
                throw "bad ice";
            }
            for (var _i = 0, srcIce_1 = srcIce; _i < srcIce_1.length; _i++) {
                var iceEntry = srcIce_1[_i];
                if (typeof iceEntry.urls === "undefined") {
                    continue;
                }
                var entry = { urls: iceEntry.urls };
                if (typeof iceEntry.username != "undefined") {
                    entry.username = iceEntry.username;
                }
                if (typeof iceEntry.credential != "undefined") {
                    entry.credential = iceEntry.credential;
                }
                result.push(entry);
            }
            return result;
        };
        CallControlClient.prototype.PrepDataChannel = function (sessionInfo) {
            var _this = this;
            sessionInfo.dataChannel.onopen = function (event) {
                sessionInfo.dataChannelIsOpen = true;
                _this.applicationEventHandler.onDataChannelOpen(sessionInfo.callId);
            };
            sessionInfo.dataChannel.onerror = function (event) {
                _this.applicationEventHandler.dataChannelError(sessionInfo.callId, event.toString());
            };
            sessionInfo.dataChannel.onclose = function (event) {
                sessionInfo.dataChannelIsOpen = false;
                _this.applicationEventHandler.onDataChannelClose(sessionInfo.callId);
            };
            sessionInfo.dataChannel.onmessage = function (event) {
                if (typeof event.data == "string") {
                    _this.applicationEventHandler.onDataChannelTextMessage(sessionInfo.callId, event.data);
                }
                else {
                    _this.applicationEventHandler.onDataChannelBinaryMessage(sessionInfo.callId, event.data);
                }
            };
        };
        CallControlClient.prototype.requestCall = function (id, params) {
            var _this = this;
            var callId = params.callId;
            var callConstraints = params.callConstraints;
            var currentSession = this.activeSessions[callId];
            var getVideo = null;
            var postVideo = function (stream) {
                _this.requestCallBody(id, params, stream);
            };
            if (params["callRole"] == "caller") {
                if (callConstraints.offeringStream) {
                    getVideo = this.applicationEventHandler.onMediaRequest(callId, callConstraints.offeringStream);
                }
            }
            else {
                if (callConstraints.requestingStream) {
                    getVideo = this.applicationEventHandler.onMediaRequest(callId, callConstraints.requestingStream);
                }
            }
            if (getVideo) {
                getVideo.then(function (stream) {
                    postVideo(stream);
                }, function (error) {
                    _this.sender.sendError(id, -1, error.message, {});
                });
            }
            else {
                postVideo(undefined);
            }
        };
        CallControlClient.prototype.addHandlersToPeer = function (newSession, callId) {
            var _this = this;
            var self = this;
            newSession.call.onicecandidate = function (event) {
                var iceCandidate = event.candidate;
                //
                // the browser will give us a null to tell us that we've seen all the candidates.
                //
                if (!iceCandidate || !iceCandidate.candidate) {
                    return;
                }
                if (_this.activeSessions[callId]) {
                    var activeSession = _this.activeSessions[callId];
                    if (self.customIceFilter) {
                        iceCandidate = _this.customIceFilter(iceCandidate, false);
                        if (!iceCandidate) {
                            return;
                        }
                    }
                    if (!self.checkCandidate(iceCandidate.candidate, activeSession.constraints)) {
                        if (_this.loggingEnabled) {
                            console.log(getTimeString(), " discarded candidate " + iceCandidate.candidate);
                        }
                        return;
                    }
                    if (activeSession.readyForCandidates) {
                        _this.sender.sendRequest("callIceCandidate", {
                            "callId": activeSession.callId,
                            "pcId": activeSession.pcId,
                            "iceCandidate": iceCandidate
                        });
                    }
                    else {
                        activeSession.waitingOutgoingCandidates.push(iceCandidate);
                    }
                    //
                    // record the self reflexive address if this is a stun candidate
                    //
                    var iceparts = iceCandidate.candidate.split(" ");
                    var srflx = "";
                    for (var i = 5; i < iceparts.length; i++) {
                        if (iceparts[i - 1] === "typ" && iceparts[i] === "srflx") {
                            srflx = iceparts[i - 3];
                            break;
                        }
                    }
                    if (srflx !== "") {
                        var alreadyPresent = false;
                        for (var _i = 0, _a = activeSession.reflexiveAddresses; _i < _a.length; _i++) {
                            var anAddress = _a[_i];
                            if (srflx === anAddress) {
                                alreadyPresent = true;
                            }
                        }
                        if (!alreadyPresent) {
                            activeSession.reflexiveAddresses.push(srflx);
                        }
                    }
                }
            };
            newSession.call.oniceconnectionstatechange = function (event) {
                if (self.loggingEnabled) {
                    console.log(getTimeString(), " saw iceconnectionstatechange");
                }
                if (!self.activeSessions[callId]) {
                    return;
                }
                var activeSession = _this.activeSessions[callId];
                activeSession.iceState = event.currentTarget ? event.currentTarget["iceConnectionState"] : 'unknown';
                if (self.loggingEnabled) {
                    console.log(getTimeString(), " new state is " + activeSession.iceState);
                }
                _this.applicationEventHandler.onIceChange(activeSession.callId, activeSession.iceState);
                if (activeSession.iceState === "failed") {
                    self.applicationEventHandler.onCallFailed(activeSession.callId);
                }
            };
            newSession.call.onaddstream = function (event) {
                if (self.activeSessions[callId]) {
                    self.activeSessions[callId].incomingStream = event.stream;
                    self.applicationEventHandler.onStreamAdded(callId, event.stream);
                }
            };
            newSession.call.ondatachannel = function (event) {
                if (self.activeSessions[callId]) {
                    self.activeSessions[callId].dataChannel = event.channel;
                    self.PrepDataChannel(_this.activeSessions[callId]);
                }
            };
            newSession.call.onconnecting = function (event) {
                if (self.loggingEnabled) {
                    console.log(getTimeString(), " saw onconnecting event", event);
                }
            };
            newSession.call.onremovestream = function (event) {
                if (self.activeSessions[callId]) {
                    self.activeSessions[callId].incomingStream = null;
                    self.applicationEventHandler.onStreamRemoved(callId, event.stream);
                }
                if (self.loggingEnabled) {
                    console.log(getTimeString(), " saw onremovestream event");
                }
            };
            newSession.call.onstatechange = function (event) {
                if (self.loggingEnabled) {
                    console.log(getTimeString(), " saw onstatechange event", event);
                }
            };
            newSession.call.onsignalingstatechange = function (event) {
                if (self.loggingEnabled) {
                    console.log(getTimeString(), " saw onsignalstatechange", event);
                }
            };
            newSession.call.onnegotiationneeded = function (event) {
                console.log("unexpected call to onnegotionneeded, ignoring");
                /*
                 newSession.call.createOffer(function(sdp) {
                 if (self.sdpLocalFilter) {
                 sdp.sdp = self.sdpLocalFilter(sdp.sdp, true);
                 }
                 newSession.call.setLocalDescription(sdp, function() {
                 self.sendPeerMessage(newSession.callId, "__addedMediaStream", {
                 sdp: sdp
                 });
    
                 }, function() {
                 });
                 }, function(error) {
                 if( self.loggingEnabled) {
                 console.log("unexpected error in creating offer");
                 }
                 });
                 */
            };
        };
        CallControlClient.prototype.requestCallBody = function (id, params, stream) {
            //
            // expectedItems is declared in a static list because:
            //   1) as a static item, it only gets initialized once per execution of the program.
            //   2) using initializer lists only seems to work with constructors.
            //
            if (!this.verifyJsonFields(params, ["callId", "callRole", "iceServers"])) {
                console.log("call message was missing fields", params);
                this.sender.sendError(id, -1, "missing param fields", null);
                return;
            }
            // note: the ack will be sent by initiateSendOffer called lower down.
            var newSession = new SessionInfo();
            newSession.callId = params.callId;
            newSession.pcId = (typeof params.pcId != "undefined") ? params["pcId"] : "";
            newSession.iAmCaller = params["callRole"] == "caller";
            newSession.iceServers = params["iceServers"];
            if (params.callConstraints) {
                var callConstraints = params["callConstraints"];
                newSession.constraints = JSON.parse(JSON.stringify(params.callConstraints));
            }
            else {
                newSession.constraints = new CallConstraints();
            }
            var configuration = {
                iceServers: this.repackIceServers(newSession.iceServers)
            };
            //
            // There is an optional second argument, constraints, but it doesn't seem to supply any real value.
            var callId = newSession.callId;
            if (newSession.iAmCaller) {
                newSession.call = new RTCPeerConnection(configuration);
                this.addHandlersToPeer(newSession, callId);
                if (stream) {
                    newSession.call.addStream(stream);
                }
            }
            else {
                newSession.peerConfiguration = configuration;
                newSession.outgoingStream = stream;
            }
            this.activeSessions[newSession.callId] = newSession;
            if (newSession.iAmCaller) {
                if (newSession.constraints.mediaConstraints.dataChannelEnabled) {
                    newSession.dataChannel = newSession.call.createDataChannel("dc");
                    this.PrepDataChannel(newSession);
                }
                this.InitiateSendOffer(id, newSession, undefined); // sends an ack on success
            }
            else {
                this.sender.sendAck(id);
            }
            this.applicationEventHandler.onCallStart(newSession.callId, newSession.iAmCaller ? newSession.constraints.networkConstraints.answeringPeerId : newSession.constraints.networkConstraints.offeringPeerId);
        };
        CallControlClient.prototype.requestCallOfferSdp = function (id, params) {
            var _this = this;
            if (!this.verifyJsonFields(params, ["callId", "offerSdp"])) {
                this.sender.sendError(id, -1, "missing fields", {});
                return;
            }
            var callId = params.callId;
            var modifiedSdp = this.sdpRemoteFilter ? this.sdpRemoteFilter(params.offerSdp, true) : params.offerSdp;
            if (this.activeSessions[callId]) {
                var currentSession_1 = this.activeSessions[callId];
                console.log("creating new peerconnection with peerconfig =", currentSession_1.peerConfiguration);
                currentSession_1.call = new RTCPeerConnection(currentSession_1.peerConfiguration);
                this.addHandlersToPeer(currentSession_1, callId);
                if (currentSession_1.outgoingStream) {
                    console.log("adding stream to peer connection ", currentSession_1.outgoingStream);
                    currentSession_1.call.addStream(currentSession_1.outgoingStream);
                }
                var sessionDescription = {
                    type: "offer",
                    sdp: modifiedSdp
                };
                console.log("setting remoteDescription of ", sessionDescription);
                currentSession_1.call.setRemoteDescription(sessionDescription).then(function () {
                    console.log("initiating send answer");
                    _this.InitiateSendAnswer(id, currentSession_1, params.pcUpdateId);
                }, function (reason) {
                    if (_this.loggingEnabled) {
                        console.log(getTimeString(), " attempt to setRemoteDescription of offer failed ", callId, modifiedSdp);
                    }
                    _this.sender.sendError(id, -1, reason, {});
                });
            }
            else {
                this.sender.sendError(id, -1, "no such call", {});
            }
        };
        ;
        CallControlClient.prototype.requestCallAnswerSdp = function (id, params) {
            if (!this.verifyJsonFields(params, ["callId", "answerSdp"])) {
                this.sender.sendError(id, -1, "missing fields", {});
                return;
            }
            var self = this;
            var callId = params.callId;
            var modifiedSdp = this.sdpRemoteFilter ? this.sdpRemoteFilter(params.answerSdp, false) : params.answerSdp;
            if (this.activeSessions[callId]) {
                var currentSession_2 = this.activeSessions[callId];
                var sd = {
                    type: "answer",
                    sdp: modifiedSdp
                };
                console.log("answer to be set is ", sd);
                currentSession_2.call.setRemoteDescription(sd).then(function () {
                    self.sender.sendAck(id);
                    if (params.pcUpdateId) {
                        self.sender.sendRequest("callPcUpdated", {
                            callId: callId,
                            pcId: currentSession_2.pcId,
                            pcDefinition: {},
                            pcUpdateId: params.pcUpdateId
                        });
                    }
                    self.flushCandidates(currentSession_2);
                }, function (error) {
                    if (self.loggingEnabled) {
                        console.log(getTimeString(), " attempt to setRemoteDescription of answer failed ", callId, modifiedSdp);
                        console.log(getTimeString(), " error was ", error);
                    }
                    self.sender.sendError(id, -1, error.message, {});
                });
            }
            else {
                this.sender.sendError(id, -1, "no such call", {});
            }
        };
        ;
        CallControlClient.prototype.requestCallEnd = function (id, params) {
            var callId = params.callId;
            var callConstraints = params.callConstraints;
            var currentSession = this.activeSessions[callId];
            var getVideo = null;
            var postVideo; // :(stream:MediaStream)=>void;
            if (this.activeSessions[callId]) {
                this.sender.sendAck(id);
                var currentSession_3 = this.activeSessions[callId];
                currentSession_3.call.close();
                delete this.activeSessions[callId];
                currentSession_3.sentEndCall = true;
                this.sender.sendRequest("callPcClosed", { "callId": currentSession_3.callId,
                    "pcId": currentSession_3.pcId, });
                this.applicationEventHandler.onCallEnd(callId);
            }
            else {
                this.sender.sendError(id, -1, "no such call", {});
            }
        };
        ;
        CallControlClient.prototype.requestCallIceCandidate = function (id, params) {
            var _this = this;
            if (!this.verifyJsonFields(params, ["callId", "iceCandidate"])) {
                this.sender.sendError(id, -1, "missing fields", {});
                return;
            }
            var callId = params.callId;
            var iceCandidate = params.iceCandidate;
            if (this.activeSessions[callId]) {
                var currentSession = this.activeSessions[callId];
                if (this.customIceFilter) {
                    iceCandidate = this.customIceFilter(iceCandidate, true);
                    if (!iceCandidate) {
                        this.sender.sendAck(id);
                        return;
                    }
                }
                if (!this.checkCandidate(iceCandidate.candidate, currentSession.constraints)) {
                    if (this.loggingEnabled) {
                        console.log(getTimeString(), " discarded remote candidate " + params.iceCandidate.candidate);
                    }
                    this.sender.sendAck(id);
                }
                else if (currentSession.readyForCandidates) {
                    currentSession.call.addIceCandidate(params.iceCandidate).then(function () {
                        _this.sender.sendAck(id);
                    }, function (reason) {
                        _this.sender.sendError(id, -1, reason, {});
                    });
                }
            }
            else {
                this.sender.sendError(id, -1, "no such call", {});
            }
        };
        ;
        CallControlClient.prototype.requestCallPcUpdate = function (id, params) {
            var _this = this;
            var callId = params.callId;
            var callConstraints = params.callConstraints;
            var currentSession = this.activeSessions[callId];
            var getVideo = null;
            var postVideo; // :(stream:MediaStream)=>void;
            if (params["callRole"] == "caller") {
                if (callConstraints.offeringStream) {
                    getVideo = this.applicationEventHandler.onMediaRequest(callId, callConstraints.offeringStream);
                }
                postVideo = function (stream) {
                    if (stream) {
                        currentSession.call.addStream(stream);
                    }
                    _this.InitiateSendOffer(id, currentSession, params.pcUpdateId);
                };
            }
            else {
                if (callConstraints.requestingStream) {
                    getVideo = this.applicationEventHandler.onMediaRequest(callId, callConstraints.requestingStream);
                }
                postVideo = function (stream) {
                    if (stream) {
                        currentSession.call.addStream(stream);
                    }
                    _this.sender.sendAck(id);
                };
            }
            if (getVideo) {
                getVideo.then(function (stream) {
                    postVideo(stream);
                }, function (error) {
                    _this.sender.sendError(id, -1, error.message, {});
                });
            }
            else {
                postVideo(undefined);
            }
        };
        ;
        CallControlClient.prototype.requestCallPing = function (id, params) {
            this.sender.sendResponse(id, {
                "pingSeq": params.pingSeq,
                "pingTs": params.pingTs,
                "pongTs": this.getTimeStamp()
            });
        };
        ;
        CallControlClient.prototype.requestCallReconnect = function (id, params) {
            this.sender.sendError(id, -1, "callReconnect not implemented yet.", {});
        };
        ;
        CallControlClient.prototype.requestGetPeerStatus = function (id, params) {
            var payload = {
                peerType: "regular_client",
                maxConcurrentCalls: 20,
                acceptNewCalls: true
            };
            this.sender.sendResponse(id, payload);
        };
        ;
        CallControlClient.prototype.requestCallPcStats = function (id, params) {
            this.sender.sendError(id, -1, "callPcStats not implemented yet.", {});
        };
        ;
        CallControlClient.prototype.requestCapabilities = function (id, params) {
            this.sender.sendError(id, -1, "Capabilities message not implemented yet", null);
        };
        ;
        CallControlClient.prototype.applyResult = function (id, params) {
            if (params.pingSeq) {
                this.sender.sendAck(id);
                this.applicationEventHandler.onCCSisAlive();
            }
        };
        ;
        CallControlClient.prototype.applyError = function (id, params) {
            if (this.loggingEnabled) {
                console.log(getTimeString(), " Incoming error message ", params);
            }
            //
            // TODO: this isn't the right way to handle errors, but it will do for rtctest.
            //
            if (params.callId) {
                this.applicationEventHandler.onCallFailed(params.callId);
            }
            else {
                console.log(getTimeString(), "unhandled error ", JSON.stringify(params));
            }
        };
        ;
        ;
        CallControlClient.prototype.endCall = function (callId) {
            if (!this.activeSessions[callId]) {
                return;
            }
            if (this.activeSessions[callId].sentEndCall) {
                return; // already been done.
            }
            this.activeSessions[callId].sentEndCall = true;
            this.sender.sendRequest("requestCallEnd", { "callId": callId });
        };
        CallControlClient.prototype.InitiatePeerChange = function (callId, callConstraints) {
            var self = this;
            return new Promise(function (resolve, reject) {
                var callBody = {
                    callId: callId,
                    pcId: self.activeSessions[callId].pcId,
                    callConstraints: callConstraints
                };
                self.sender.sendRequest2("requestCallPcUpdate", callBody).then(function (params) {
                    resolve(params.callId);
                }, function (error) {
                    if (self.loggingEnabled) {
                        console.log(getTimeString(), "InitiatePeerChange failed: ", error.message);
                    }
                    reject(error);
                });
            });
        };
        CallControlClient.prototype.AddLocalStreamToCall = function (callId, outgoingStreamLabel) {
            var callConstraints = {
                offeringStream: outgoingStreamLabel
            };
            return this.InitiatePeerChange(callId, callConstraints);
        };
        CallControlClient.prototype.AddRemoteStreamToCall = function (callId, incomingStreamLabel) {
            var callConstraints = {
                requestingStream: incomingStreamLabel
            };
            return this.InitiatePeerChange(callId, callConstraints);
        };
        CallControlClient.prototype.startCallGeneric = function (callBody, offeringLabel, requestingLabel) {
            var self = this;
            return new Promise(function (resolve, reject) {
                // this is how we find out if the CCS client is running. If it is, we'll get a pong back
                // this is really just for postmortem logs
                self.sender.sendRequest("callPing", { "pingSeq": self.pingSeq });
                self.pingSeq++;
                if (offeringLabel) {
                    callBody.callConstraints.offeringStream = offeringLabel;
                }
                if (requestingLabel) {
                    callBody.callConstraints.requestingStream = requestingLabel;
                }
                // now send the message to start the call.
                self.sender.sendRequest2("requestCall", callBody).then(function (params) {
                    resolve(params.callId);
                }, function (error) {
                    if (self.loggingEnabled) {
                        console.log(getTimeString(), "requestCall failed: ", error.message);
                    }
                    reject(error);
                });
            });
        };
        CallControlClient.prototype.startCallWithPeerId = function (peerId, callConstraints, offeringLabel, requestingLabel) {
            var callBody = {
                capabilities: {},
                callConstraints: callConstraints,
                callRole: "caller",
                targetPeerId: peerId
            };
            return this.startCallGeneric(callBody, offeringLabel, requestingLabel);
        };
        CallControlClient.prototype.startCallWithPeerType = function (peerType, callConstraints, offeringLabel, requestingLabel) {
            var callBody = {
                capabilities: {},
                callConstraints: callConstraints,
                callRole: "caller",
                targetPeerType: peerType
            };
            return this.startCallGeneric(callBody, offeringLabel, requestingLabel);
        };
        CallControlClient.prototype.haveOpenDataChannel = function (callId) {
            if (!this.activeSessions[callId])
                return false;
            return this.activeSessions[callId].dataChannelIsOpen;
        };
        CallControlClient.prototype.sendDataChannelMessage = function (callId, data) {
            if (!this.activeSessions[callId]) {
                return;
            }
            var activeSession = this.activeSessions[callId];
            activeSession.dataChannel.send(data);
        };
        /**
         * This produces raw stats as provided by webrtc, with no filtering.
         * @param callid the callId of the peer connection to be querried.
         */
        CallControlClient.prototype.getRawStatistics = function (callId) {
            //
            // this function doesn't do any actual real work. Instead it returns an object that wraps a function that does
            // the real work. AKA a Promise.
            //
            if (!this.activeSessions[callId]) {
                return new Promise(function (resolve, reject) {
                    reject(Error("no such call"));
                });
            }
            var currentSession = this.activeSessions[callId];
            var self = this;
            return currentSession.call.getStats(null);
        };
        /** This produces a filtered stats report that should be generally useful.
         * @param callid the callId of the peer connection to be querried.
         */
        CallControlClient.prototype.getStatistics = function (callId) {
            //
            // this function doesn't do any actual real work. Instead it returns an object that wraps a function that does
            // the real work. AKA a Promise.
            //
            if (!this.activeSessions[callId]) {
                return new Promise(function (resolve, reject) {
                    reject(Error("no such call"));
                });
            }
            var currentSession = this.activeSessions[callId];
            var self = this;
            return new Promise(function (resolve, reject) {
                currentSession.call.getStats(null).then(function (rawreport) {
                    var filteredStats = self.MassageStatsReport(rawreport);
                    filteredStats.reflexiveAddresses = currentSession.reflexiveAddresses;
                    resolve(filteredStats);
                }, function (reason) {
                    reject(reason);
                });
            });
        };
        CallControlClient.prototype.MassageStatsReport = function (rawReport) {
            var results = new CallStats();
            if (window["webrtcDetectedBrowser"] == "firefox") {
                this.MassageFirefoxStats(rawReport, results);
            }
            else {
                this.MassageChromeStats(rawReport, results);
            }
            return results;
        };
        //
        // this method is grabbed from easyrtc and mutated. Make it better later.
        //
        CallControlClient.prototype.MassageFirefoxStats = function (stats, results) {
            var filter = {
                "outboundrtp_audio.bytesSent": "audioBytesSent",
                "outboundrtp_video.bytesSent": "videoBytesSent",
                "inboundrtp_video.bytesReceived": "videoBytesReceived",
                "inboundrtp_audio.bytesReceived": "audioBytesReceived",
                "outboundrtp_audio.packetsSent": "audioPacketsSent",
                "outboundrtp_video.packetsSent": "videoPacketsSent",
                "inboundrtp_video.packetsReceived": "videoPacketsReceived",
                "inboundrtp_audio.packetsReceived": "audioPacketsReceived",
                "inboundrtp_video.packetsLost": "videoPacketsLost",
                "inboundrtp_audio.packetsLost": "audioPacketsLost",
                "firefoxRemoteAddress": "remoteIpAddress"
            };
            var items = {};
            var candidates = {};
            var activeId = null;
            var srcKey;
            //
            // the stats objects has a group of entries. Each entry is either an rtcp, rtp entry
            // or a candidate entry.
            //
            stats.forEach(function (entry) {
                var majorKey;
                var subKey;
                if (entry.type.match(/boundrtp/)) {
                    if (entry.id.match(/audio/)) {
                        majorKey = entry.type + "_audio";
                    }
                    else if (entry.id.match(/video/)) {
                        majorKey = entry.type + "_video";
                    }
                    else {
                        return;
                    }
                    for (subKey in entry) {
                        if (entry.hasOwnProperty(subKey)) {
                            items[majorKey + "." + subKey] = entry[subKey];
                        }
                    }
                }
                else {
                    if (entry.hasOwnProperty("ipAddress") && entry.id) {
                        candidates[entry.id] = entry.ipAddress + ":" +
                            entry.portNumber;
                    }
                    else if (entry.hasOwnProperty("selected") &&
                        entry.hasOwnProperty("remoteCandidateId") &&
                        entry.selected) {
                        activeId = entry.remoteCandidateId;
                    }
                }
            });
            if (activeId) {
                items["firefoxRemoteAddress"] = candidates[activeId];
            }
            for (srcKey in filter) {
                if (filter.hasOwnProperty(srcKey) && items.hasOwnProperty(srcKey)) {
                    results[filter[srcKey]] = items[srcKey];
                }
            }
        };
        //
        // this method is grabbed from easyrtc for speed of implementation.
        // the statistics structure used by chrome has been greatly simplified from the mess that it was,
        // and this code could be simplified as well.
        //
        CallControlClient.prototype.MassageChromeStats = function (rawReport, results) {
            var audioFilter = {
                "bytesReceived": "audioBytesReceived",
                "bytesSent": "audioBytesSent",
                "packetsSent": "audioPacketsSent",
                "packetsReceived": "audioPacketsReceived",
                "packetsLost": "audioPacketsLost"
            };
            var videoFilter = {
                "bytesReceived": "videoBytesReceived",
                "bytesSent": "videoBytesSent",
                "packetsSent": "videoPacketsSent",
                "packetsReceived": "videoPacketsReceived",
                "packetsLost": "videoPacketsLost",
                "googTransmitBitrate": "transmitBitRate",
                "googActualEncBitrate": "encodeRate",
                "googAvailableSendBandwidth": "availableSendRate",
                "googFrameRateSent": "frameRateSent",
                "googFrameRateReceived": "frameRateReceived"
            };
            function CollectValues(srcData, filter, results) {
                for (var itemName in filter) {
                    if (srcData[itemName]) {
                        var resultType = typeof results[filter[itemName]];
                        if (resultType === "string") {
                            results[filter[itemName]] = srcData[itemName];
                        }
                        else if (resultType === "number") {
                            results[filter[itemName]] += parseInt(srcData[itemName]);
                        }
                    }
                }
            }
            for (var i in rawReport) {
                if (i.indexOf("audio") > 0 || rawReport[i].mediaType === "audio") {
                    CollectValues(rawReport[i], audioFilter, results);
                }
                else if (i.indexOf("video") > 0 || rawReport[i].mediaType === "video") {
                    CollectValues(rawReport[i], videoFilter, results);
                }
            }
            if (this.loggingEnabled) {
                console.log(getTimeString(), " raw report was ", rawReport);
                console.log(getTimeString(), " massaged report was ", results);
            }
        };
        /**
         * Removes a stream from a peer connection. This supports EasyRTC.
         * @param callId
         * @param stream
         * @constructor
         */
        CallControlClient.prototype.RemoveMediaStreamFromCall = function (callId, stream) {
            if (this.activeSessions[callId] && this.activeSessions[callId].call) {
                var localStreams = this.activeSessions[callId].call.getLocalStreams();
                for (var i = 0; i < localStreams.length; i++) {
                    if (localStreams[i] === stream || localStreams[i].id === stream.id) {
                        this.activeSessions[callId].call.removeStream(localStreams[i]);
                        if (localStreams.length == 1) {
                            this.endCall(callId);
                        }
                    }
                }
            }
        };
        return CallControlClient;
    }());
    exports.CallControlClient = CallControlClient;
    ;
});
