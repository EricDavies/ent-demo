/**
 * Created by eric on 20/09/16.
 */
define(["require", "exports"], function (require, exports) {
    "use strict";
    /// <reference path="./Promise.d.ts" />
    /// <reference path="../DefinitelyTyped/webrtc/MediaStream.d.ts" />
    /// <reference path="../DefinitelyTyped/webrtc/RTCPeerConnection.d.ts" />
    function SupportsWebrtc() {
        return !!window.RTCPeerConnection;
    }
    exports.SupportsWebrtc = SupportsWebrtc;
    /** @returns  one of the following: webkit, moz or "" */
    function GetWebrtcPrefix() {
        if (window.webkitRTCPeerConnection) {
            return "webkit";
        }
        else if (window.mozRTCPeerConnection) {
            return "moz";
        }
        else {
            return "";
        }
    }
    exports.GetWebrtcPrefix = GetWebrtcPrefix;
    /** @returns true if data channels are supported */
    function supportsDataChannel() {
        if (!SupportsWebrtc()) {
            return false;
        }
        var config = {
            iceServers: []
        };
        var peerConnection = new RTCPeerConnection(config);
        return !!peerConnection.createDataChannel;
    }
    exports.supportsDataChannel = supportsDataChannel;
});
