/**
 * Created by eric on 07/09/16.
 */
define(["require", "exports", "./MediaResources", "./NetworkTestApi", "./WebRTCCapabilities"], function (require, exports, MediaResources_1, NetworkTestApi_1, WebRTCCapabilities_1) {
    "use strict";
    var networkTestApi = null;
    var cameraDeviceId = null;
    var microphoneDeviceId = null;
    function GetCameraListTest() {
        console.log("GetCameraListTest entered");
        MediaResources_1.GetCameraList().then(function (list) {
            document.getElementById("statediv").innerText =
                " cameras " + JSON.stringify(list);
            cameraDeviceId = list[0].deviceId;
        }, function (reason) {
            document.getElementById("statediv").innerText =
                " cameras failed " + JSON.stringify(reason.message);
        });
    }
    function GetResolutions() {
        MediaResources_1.GetCameraResolutions(cameraDeviceId).then(function (resolutions) {
            document.getElementById("statediv").innerText = JSON.stringify(resolutions);
        }, function (error) {
            document.getElementById("statediv").innerText = error.message;
        });
    }
    document.getElementById("getresolutions").onclick = GetResolutions;
    function GetConnection() {
        console.log("entered GetConnection function");
        networkTestApi = new NetworkTestApi_1.NetworkTestApi();
        networkTestApi.enableLogging(true);
        var signallingListener = {
            onConnectionSuccess: function () {
                document.getElementById("statediv").innerText = "Got connection";
            },
            onConnectionFailure: function (reason) {
                document.getElementById("statediv").innerText = "connection failure " + reason;
            },
            onConnectionLost: function (errorMessage) {
                document.getElementById("statediv").innerText = "connection lost " + errorMessage;
            },
            onSendFailure: function (errorMessage) {
                document.getElementById("statediv").innerText = "send failure" + errorMessage;
            },
        };
        networkTestApi.initialize("96.126.100.209", 9001, signallingListener);
    }
    document.getElementById("getconnection").onclick = GetConnection;
    document.getElementById("getcamera").onclick = GetCameraListTest;
    function StartEasyNetworkTest() {
        console.log("entered StartNetworkTest function");
        var resultListener = {
            testDone: function (result) {
                console.log("test is done");
                document.getElementById("statediv").innerText =
                    " test result was " + JSON.stringify(result);
            },
            sawLocalMediaStream: function (mediaStream) {
                MediaResources_1.SetVideoObjectSrc(document.getElementById("localSmurf"), mediaStream);
            },
            sawRemoteMediaStream: function (mediaStream) {
                MediaResources_1.SetVideoObjectSrc(document.getElementById("remoteSmurf"), mediaStream);
            }
        };
        document.getElementById("statediv").innerText = "starting easy test";
        //  networkTestApi.EnableMediaStream(false);
        networkTestApi.SetVideoResolution(640, 480);
        networkTestApi.enableLogging(true);
        networkTestApi.EnableStun(true);
        networkTestApi.EnableTurn(true);
        networkTestApi.EnableDirect(true);
        networkTestApi.RunTest(resultListener);
    }
    document.getElementById("easynetworktest").onclick = StartEasyNetworkTest;
    function StartHardNetworkTest() {
        console.log("entered StartNetworkTest function");
        var resultListener = {
            testDone: function (result) {
                console.log("test is done");
                document.getElementById("statediv").innerText =
                    " test result was " + JSON.stringify(result);
            },
            sawLocalMediaStream: function (mediaStream) { },
            sawRemoteMediaStream: function (mediaStream) { }
        };
        document.getElementById("statediv").innerText = "starting hard test";
        networkTestApi.EnableStun(false);
        networkTestApi.EnableTurn(false);
        networkTestApi.EnableDirect(false);
        networkTestApi.RunTest(resultListener);
    }
    document.getElementById("hardnetworktest").onclick = StartHardNetworkTest;
    function StartStunNetworkTest() {
        console.log("entered StartNetworkTest function");
        var resultListener = {
            testDone: function (result) {
                console.log("test is done");
                document.getElementById("statediv").innerText =
                    " test result was " + JSON.stringify(result);
            },
            sawLocalMediaStream: function (mediaStream) { },
            sawRemoteMediaStream: function (mediaStream) { }
        };
        document.getElementById("statediv").innerText = "starting stun test";
        networkTestApi.EnableStun(true);
        networkTestApi.EnableTurn(false);
        networkTestApi.EnableDirect(false);
        networkTestApi.RunTest(resultListener);
    }
    document.getElementById("stuntest").onclick = StartStunNetworkTest;
    function StartTurnNetworkTest() {
        console.log("entered StartNetworkTest function");
        var resultListener = {
            testDone: function (result) {
                console.log("test is done");
                document.getElementById("statediv").innerText =
                    " test result was " + JSON.stringify(result);
            },
            sawLocalMediaStream: function (mediaStream) {
                MediaResources_1.SetVideoObjectSrc(document.getElementById("localSmurf"), mediaStream);
            },
            sawRemoteMediaStream: function (mediaStream) {
                MediaResources_1.SetVideoObjectSrc(document.getElementById("remoteSmurf"), mediaStream);
            }
        };
        document.getElementById("statediv").innerText = "starting turn test";
        networkTestApi.EnableStun(false);
        networkTestApi.EnableTurn(true);
        networkTestApi.EnableDirect(false);
        networkTestApi.RunTest(resultListener);
    }
    document.getElementById("turntest").onclick = StartTurnNetworkTest;
    document.getElementById("getmicrophonelist").onclick = function () {
        console.log("GetCameraListTest entered");
        MediaResources_1.GetMicrophoneList().then(function (list) {
            document.getElementById("statediv").innerText =
                " microphones " + JSON.stringify(list);
            microphoneDeviceId = list[0].deviceId;
        }, function (reason) {
            document.getElementById("statediv").innerText =
                " cameras failed " + JSON.stringify(reason.message);
        });
    };
    document.getElementById("getmicrophoneSamples").onclick = function () {
        var sampler = new MediaResources_1.MicrophoneSampler();
        sampler.initialize(microphoneDeviceId, 256).then(function (a) {
            var count = 10;
            for (var i = 0; i < 10; i++) {
                setTimeout(function () {
                    document.getElementById("statediv").innerText += JSON.stringify(sampler.getFreqSamples()) + "\n";
                    document.getElementById("statediv").innerText += "v=" + sampler.getVolume() + "\n\n";
                }, i * 1000);
            }
            setTimeout(function () { sampler.close(); }, 11 * 1000);
        }, function (error) {
            document.getElementById("statediv").innerText =
                " mike failed " + JSON.stringify(error.message);
        });
    };
    function CloseResources() {
        console.log("closing connection");
        if (networkTestApi) {
            networkTestApi.close();
            networkTestApi = null;
        }
        document.getElementById("statediv").innerText = "closed connection";
    }
    document.getElementById("close").onclick = CloseResources;
    function showState() {
        var status = "";
        status += "supports webrtc =" + WebRTCCapabilities_1.SupportsWebrtc();
        status += "\nprefix =" + WebRTCCapabilities_1.GetWebrtcPrefix();
        status += "\nsupportsDataChannel=" + WebRTCCapabilities_1.supportsDataChannel();
        document.getElementById("statediv").innerText = status;
    }
    showState();
});
