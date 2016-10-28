/**
 * Created by eric on 13/09/16.
 */
// /// <reference path="./Promise.d.ts" />
/// <reference path="../DefinitelyTyped/webrtc/MediaStream.d.ts" />
/// <reference path="../DefinitelyTyped/webaudioapi/waa.d.ts" />
define(["require", "exports"], function (require, exports) {
    "use strict";
    var DeviceInfo = (function () {
        function DeviceInfo() {
        }
        return DeviceInfo;
    }());
    exports.DeviceInfo = DeviceInfo;
    function GetDeviceList(deviceType) {
        return new Promise(function (resolve, reject) {
            navigator.mediaDevices.enumerateDevices().then(function (allDevices) {
                var deviceSet = [];
                for (var _i = 0, allDevices_1 = allDevices; _i < allDevices_1.length; _i++) {
                    var mediaDevice = allDevices_1[_i];
                    if (mediaDevice.kind === deviceType) {
                        deviceSet.push(mediaDevice);
                    }
                }
                resolve(deviceSet);
            }, function (reason) {
                reject(reason);
            });
        });
    }
    function GetCameraList() {
        return GetDeviceList("videoinput");
    }
    exports.GetCameraList = GetCameraList;
    function GetMicrophoneList() {
        return GetDeviceList("audioinput");
    }
    exports.GetMicrophoneList = GetMicrophoneList;
    function GetSpeakerList() {
        return GetDeviceList("audiooutput");
    }
    exports.GetSpeakerList = GetSpeakerList;
    /**
     * This class allows you to get frequency samples (a volume level for each frequency band)
     */
    var MicrophoneSampler = (function () {
        function MicrophoneSampler() {
        }
        /**
         * Initializes the Microphone sampler with
         */
        MicrophoneSampler.prototype.initialize = function (microphoneDeviceId, sampleSize) {
            console.log("this=", this);
            var self = this;
            var deviceConstraint = { deviceId: microphoneDeviceId };
            var streamConstraint = {
                video: false,
                audio: [deviceConstraint]
            };
            return new Promise(function (resolve, reject) {
                navigator.mediaDevices.getUserMedia(streamConstraint).then(function (theStream) {
                    self.audioStream = theStream;
                    self.audioCtx = new AudioContext();
                    self.sourceNode = self.audioCtx.createMediaStreamSource(theStream);
                    self.analyser = self.audioCtx.createAnalyser();
                    self.analyser.fftSize = sampleSize;
                    self.data = new Uint8Array(sampleSize);
                    self.sourceNode.connect(self.analyser);
                    resolve(true);
                }, function (error) {
                    reject(error);
                });
            });
        };
        MicrophoneSampler.prototype.getFreqSamples = function () {
            this.analyser.getByteTimeDomainData(this.data);
            return this.data;
        };
        MicrophoneSampler.prototype.getVolume = function () {
            this.analyser.getByteTimeDomainData(this.data);
            var peak = 0;
            for (var ind = 0; ind < this.data.length; ind++) {
                var amp = Math.abs(this.data[ind] - 128);
                if (amp > peak) {
                    peak = amp;
                }
            }
            return peak;
        };
        MicrophoneSampler.prototype.close = function () {
            for (var _i = 0, _a = this.audioStream.getAudioTracks(); _i < _a.length; _i++) {
                var audioTrack = _a[_i];
                audioTrack.stop();
            }
        };
        return MicrophoneSampler;
    }());
    exports.MicrophoneSampler = MicrophoneSampler;
    function CheckCameraResolution(cameraDeviceId, width, height, frameRate) {
        return new Promise(function (resolve, reject) {
            var videoTrackConstraints = {
                deviceId: cameraDeviceId,
                width: { exact: width },
                height: { exact: height }
            };
            var constraints = {
                audio: false,
                video: videoTrackConstraints
            };
            if (frameRate) {
                constraints.video["frameRate"] = { exact: frameRate };
            }
            function myresolve(stream) {
                var t = stream.getVideoTracks();
                var length = t.length;
                StopStream(stream);
                if (length == 1) {
                    resolve(true);
                }
                else {
                    resolve(false);
                }
            }
            function myfail() {
                resolve(false);
            }
            navigator.getUserMedia(constraints, myresolve, myfail);
        });
    }
    exports.CheckCameraResolution = CheckCameraResolution;
    var CameraResolution = (function () {
        function CameraResolution() {
        }
        return CameraResolution;
    }());
    exports.CameraResolution = CameraResolution;
    function GetCameraResolutions(cameraDeviceId) {
        var sampledResolutions = [
            { width: 160, height: 120 },
            { width: 320, height: 240 },
            { width: 400, height: 300 },
            { width: 640, height: 360 },
            { width: 640, height: 480 },
            { width: 800, height: 600 },
            { width: 1280, height: 720 },
            { width: 1920, height: 1080 }
        ];
        //
        // the below method tries each resolution against the specified camera.
        //
        function TrySingleResolution(samples, results) {
            return new Promise(function (resolve, reject) {
                if (samples.length == 0) {
                    resolve(results);
                }
                else {
                    var curResolution_1 = samples.shift();
                    CheckCameraResolution(cameraDeviceId, curResolution_1.width, curResolution_1.height, 0).then(function (gotRes) {
                        if (gotRes) {
                            results.push(curResolution_1);
                        }
                        TrySingleResolution(samples, results).then(resolve, reject);
                    }, function (error) {
                        reject(error);
                    });
                }
            });
        }
        return new Promise(function (resolve, reject) {
            TrySingleResolution(sampledResolutions, []).then(function (results) {
                resolve(results);
            }, function (error) {
                reject(error);
            });
        });
    }
    exports.GetCameraResolutions = GetCameraResolutions;
    function createObjectURL(mediaStream) {
        var errMessage;
        var windowAlias = window;
        if (windowAlias.URL && window.URL.createObjectURL) {
            return windowAlias.URL.createObjectURL(mediaStream);
        }
        else if (windowAlias.webkitURL && windowAlias.webkitURL.createObjectURL) {
            return windowAlias.webkit.createObjectURL(mediaStream);
        }
        else {
            errMessage = "Your browsers does not support URL.createObjectURL.";
            throw errMessage;
        }
    }
    ;
    function ClearMediaStream(element) {
        var t = element;
        if (typeof t.src !== 'undefined') {
            //noinspection JSUndefinedPropertyAssignment
            element.src = "";
        }
        else if (typeof t.srcObject !== 'undefined') {
            t.srcObject = "";
        }
        else if (typeof t.mozSrcObject !== 'undefined') {
            t.mozSrcObject = null;
        }
    }
    exports.ClearMediaStream = ClearMediaStream;
    function SetVideoObjectSrc(element, stream) {
        if (stream) {
            element.autoplay = true;
            if (typeof element.src !== 'undefined') {
                element.src = createObjectURL(stream);
            }
            else if (typeof element["srcObject"] !== 'undefined') {
                element["srcObject"] = stream;
            }
            else if (typeof element["mozSrcObject"] !== 'undefined') {
                element["mozSrcObject"] = createObjectURL(stream);
            }
            element.play();
        }
        else {
            ClearMediaStream(element);
        }
    }
    exports.SetVideoObjectSrc = SetVideoObjectSrc;
    /**
     * Stop a media stream by stopping its constituent tracks.
     * @param stream
     * @constructor
     */
    function StopStream(stream) {
        var i;
        var tracks;
        tracks = stream.getAudioTracks();
        for (i = 0; i < tracks.length; i++) {
            try {
                tracks[i].stop();
            }
            catch (err) { }
        }
        tracks = stream.getVideoTracks();
        for (i = 0; i < tracks.length; i++) {
            try {
                tracks[i].stop();
            }
            catch (err) { }
        }
        if (typeof stream.stop === 'function') {
            try {
                stream.stop();
            }
            catch (err) { }
        }
    }
    exports.StopStream = StopStream;
    function AllocateMediaStream(constraints) {
        // TODO: add some code to convert media constraints
        return navigator.mediaDevices.getUserMedia(constraints);
    }
    exports.AllocateMediaStream = AllocateMediaStream;
    /**
     * Checks if any of a streams tracks are enabled.
     * @param stream
     * @returns {boolean}
     */
    function isStreamActive(stream) {
        var isActive;
        if (stream.active === true) {
            return true;
        }
        else {
            var tracks = stream.getTracks();
            for (var i = 0; i < tracks.length; i++) {
                if (tracks[i].enabled) {
                    return true;
                }
            }
            return false;
        }
    }
    exports.isStreamActive = isStreamActive;
});
