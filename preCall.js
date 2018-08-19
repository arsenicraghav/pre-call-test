'use strict'
var Lib;
if (!Lib) Lib = {};

(function() {

    var Lib = {};

    Lib.mediaConfig = {
        video: true,
        audio: true
    };

    Lib.offerOptions = {
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1
    };

    Lib.iceConfig = {
        "iceServers": [{
            "urls": ["stun:stun.l.google.com:19302"]
        }, {
            "urls": ["turn:taas.callstats.io:80"],
            "username": "1534935777:applicant",
            "credential": "6nMFffiTAVYNaWyBT7mRVqIS1jQ="
        }, {
            "urls": ["turns:taas.callstats.io:443"],
            "username": "1534935777:applicant",
            "credential": "6nMFffiTAVYNaWyBT7mRVqIS1jQ="
        }],
        "iceTransportPolicy": "all",
        "iceCandidatePoolSize": "20"
    };
    const resolutions = [{
        "label": "4K(UHD)",
        "width": 3840,
        "height": 2160,
        "ratio": "16:9"
    }, {
        "label": "1080p(FHD)",
        "width": 1920,
        "height": 1080,
        "ratio": "16:9"
    }, {
        "label": "UXGA",
        "width": 1600,
        "height": 1200,
        "ratio": "4:3"
    }, {
        "label": "720p(HD)",
        "width": 1280,
        "height": 720,
        "ratio": "16:9"
    }, {
        "label": "SVGA",
        "width": 800,
        "height": 600,
        "ratio": "4:3"
    }];

    Lib.standardReport = {};

    let localStream = null;
    let localConnection = null;
    let remoteStream = null;
    let remoteConnection = null;
    var localDataChannel = null;
    var remoteDataChannel = null;
    var camList = [];
    var resolutionIndex = 0;
    var supportedResolutions = [];
    var connectivityCheckStarted = false;
    var browserName = null;
    var browserVersion = null;
    var videoDevice = null;
    var audioDevice = null;
    var ICESuccess = false;
    var dataChannelOpened;
    var MByte = 1024 * 1024;
    var chunkSize = 1024 * 2;
    var chunk = new Uint8Array(chunkSize);
    for (var i = 0; i < chunk.length; i++) {
        chunk[i] = Math.round(Math.random() * 256);
    }
    var recvdChunks = 0;
    var recvdBytes = 0;
    var throughput = 0;
    var maxBuffer = 1000000;
    var throughputComputed = false;
    var lastNetworkSampleComputed = false;
    var sender = {
        "audio": {
            packetsReceived: 0,
            bytesReceived: 0,
            packetsLost: 0,
            packetsSent: 0,
            bytesSent: 0,
            bitrateMean: [],
            bitrateStdDev: [],
            discardedPackets: 0,
            framerateMean: [],
            framerateStdDev: [],
            droppedFrames: 0,
            jitter: []
        },
        "video": {
            packetsReceived: 0,
            bytesReceived: 0,
            packetsLost: 0,
            packetsSent: 0,
            bytesSent: 0,
            bitrateMean: [],
            bitrateStdDev: [],
            discardedPackets: 0,
            framerateMean: [],
            framerateStdDev: [],
            droppedFrames: 0,
            jitter: []
        }
    };

    var receiver = {
        "audio": {
            packetsReceived: 0,
            bytesReceived: 0,
            packetsLost: 0,
            packetsSent: 0,
            bytesSent: 0,
            bitrateMean: [],
            bitrateStdDev: [],
            discardedPackets: 0,
            framerateMean: [],
            framerateStdDev: [],
            droppedFrames: 0,
            jitter: []
        },
        "video": {
            packetsReceived: 0,
            bytesReceived: 0,
            packetsLost: 0,
            packetsSent: 0,
            bytesSent: 0,
            bitrateMean: [],
            bitrateStdDev: [],
            discardedPackets: 0,
            framerateMean: [],
            framerateStdDev: [],
            droppedFrames: 0,
            jitter: []
        }
    };

    function gatherSamples(callback, samplingInterval, numberOfSamples) {
        var sampleCount = 0;
        var interval = window.setInterval(function() {
            if (++sampleCount === numberOfSamples) {
                callback(true);
                window.clearInterval(interval);
            } else {
                callback(false);
            }
        }, samplingInterval);
    }

    function accessLocalMedia() {
        if (adapter) {
            printText("Browser: " + adapter.browserDetails.browser + " Version: " + adapter.browserDetails.version);
            browserName = adapter.browserDetails.browser;
            browserVersion = adapter.browserDetails.version;
        }
        navigator.mediaDevices.enumerateDevices()
            .then(devicesFound)
            .catch(devicesNotFound);
    }

    function devicesFound(deviceInfos) {
        for (var i = 0; i < deviceInfos.length; i++) {
            var deviceInfo = deviceInfos[i];
            if (deviceInfo.kind === 'videoinput') {
                var camera = {};
                camera.id = deviceInfo.deviceId;
                camera.label = deviceInfo.label;
                camList.push(camera);
            }
        }
        resolutionIndex = 0;
        if (camList.length) {
            var camSelected = camList[0];
            while (resolutionIndex < resolutions.length) {
                isResolutionSupported(resolutions[resolutionIndex], camSelected);
                resolutionIndex++;
            }
        }
    }

    function isResolutionSupported(candidate, device) {
        if (localStream) {
            localStream.getTracks().forEach(function(track) {
                track.stop();
            });
        }

        var constraints = {
            audio: true,
            video: {
                deviceId: device.id,
                width: {
                    exact: candidate.width
                },
                height: {
                    exact: candidate.height
                }
            }
        };
        setTimeout(function() {
            navigator.mediaDevices.getUserMedia(constraints)
                .then(resolutionSupported)
                .catch(resolutionNotSupported);
        }, 200);


        function resolutionSupported(mediaStream) {
            printText(candidate.label + ": " + candidate.width + "x" + candidate.height + ' -- Supported');
            supportedResolutions.push({
                "label": candidate.label,
                "width": candidate.width,
                "height": candidate.height
            });
            if (!connectivityCheckStarted) {
                onLocalStream(mediaStream);
            }
        }

        function resolutionNotSupported(error) {
            console.log('getUserMedia error!', error);
        }
    }

    function devicesNotFound(error) {
        console.log('navigator.mediaDevices.enumerateDevices: ', error);
    }

    function getOtherPc(pc) {
        return (pc === localConnection) ? remoteConnection : localConnection;
    }

    function onLocalStream(stream) {
        localStream = stream;
        connectivityCheckStarted = true;
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            const audioTracks = localStream.getAudioTracks();
            if (videoTracks.length > 0) {
                printText('Video device: ' + videoTracks[0].label);
                videoDevice = videoTracks[0].label;
            }
            if (audioTracks.length > 0) {
                printText('Audio device: ' + audioTracks[0].label);
                audioDevice = audioTracks[0].label;
            }
        }
        if (Lib.testAll) {
            createLoopBackConnections();
        }
    }

    function createLoopBackConnections() {
        localConnection = new RTCPeerConnection(Lib.iceConfig);
        localConnection.onicecandidate = e => onIceCandidate(localConnection, e);
        localConnection.oniceconnectionstatechange = e => onIceStateChange(localConnection, e);

        localDataChannel = localConnection.createDataChannel("sendChannel");

        remoteConnection = new RTCPeerConnection(Lib.iceConfig);
        remoteConnection.onicecandidate = e => onIceCandidate(remoteConnection, e);
        remoteConnection.oniceconnectionstatechange = e => onIceStateChange(remoteConnection, e);
        remoteConnection.ontrack = onRemoteStreamAdded;

        remoteConnection.ondatachannel = onDataChannelAdded;

        if (localStream) {
            localStream.getTracks().forEach(track => localConnection.addTrack(track, localStream));
        }

        localConnection.createOffer(Lib.offerOptions).then(onCreateOfferSuccess, onCreateSessionDescriptionError);
    }

    function onCreateSessionDescriptionError(error) {}

    function onCreateOfferSuccess(desc) {
        localConnection.setLocalDescription(desc).then(() => onSetLocalSuccess(localConnection), onSetSessionDescriptionError);
        remoteConnection.setRemoteDescription(desc).then(() => onSetRemoteSuccess(remoteConnection), onSetSessionDescriptionError);
        remoteConnection.createAnswer().then(onCreateAnswerSuccess, onCreateSessionDescriptionError);
    }

    function onSetLocalSuccess(pc) {}

    function onSetRemoteSuccess(pc) {}

    function onSetSessionDescriptionError(error) {}

    function onCreateAnswerSuccess(desc) {
        remoteConnection.setLocalDescription(desc).then(() => onSetLocalSuccess(remoteConnection), onSetSessionDescriptionError);
        localConnection.setRemoteDescription(desc).then(() => onSetRemoteSuccess(localConnection), onSetSessionDescriptionError);
    }

    function onDataChannelAdded(event) {
        remoteDataChannel = event.channel;
        remoteDataChannel.onopen = onDataChannelOpen;
        remoteDataChannel.onmessage = onDataChannelMessage;
    }

    function onDataChannelMessage(evt) {
        recvdChunks++;
        recvdBytes = evt.data.byteLength || evt.data.size;
        if (new Date().getTime() - dataChannelOpened != 0) {
            throughput = Math.round(100 * (recvdChunks * recvdBytes / MByte /
                ((new Date().getTime() - dataChannelOpened) / 1000))) / 100;
        }
    };

    function computeThroughput(channel) {
        gatherSamples(function() {
            while (channel.bufferedAmount < maxBuffer) {
                channel.send(chunk);
            }
            if (channel.bufferedAmount >= maxBuffer) {
                setTimeout(function() {
                    throughputComputed = true;
                    printText("throughput: " + throughput + "(Mbs)");
                }, 5000)
            }
        }, 1000, 1);
    }

    function onDataChannelOpen(event) {
        if (remoteDataChannel) {
            let state = remoteDataChannel.readyState;
            if (state === "open") {
                printText("Data Channel: Open");
                printText("Computing Network Statistics...");
                dataChannelOpened = new Date().getTime();
                computeThroughput(localDataChannel);
            }
        }
    }

    function onIceCandidate(pc, event) {
        if (event.candidate) {
            let candidateType = event.candidate.candidate.split(" ")[7];
            if (candidateType == "relay") {
                getOtherPc(pc).addIceCandidate(event.candidate)
                    .then(() => onAddIceCandidateSuccess(pc), err => onAddIceCandidateError(pc, err));
            } else if (candidateType == "srflx") {
                getOtherPc(pc).addIceCandidate(event.candidate)
                    .then(() => onAddIceCandidateSuccess(pc), err => onAddIceCandidateError(pc, err));

            } else if (candidateType == "host") {

            } else {

            }
        }
    }

    function onAddIceCandidateSuccess(pc) {}

    function onAddIceCandidateError(pc, error) {}

    function onIceStateChange(pc, event) {
        if (pc) {
            if (event.target.iceConnectionState == "completed" || (event.target.iceConnectionState == "connected")) {
                if (!ICESuccess) {
                    ICESuccess = true;
                    printText('ICE was successful');
                    gatherSamples(function(lastSample) {
                        if (lastSample) {
                            lastNetworkSampleComputed = true;
                        }
                        Promise.all([localConnection.getStats(), remoteConnection.getStats()])
                            .then(([localStats, remoteStats]) => {
                                localStats.forEach(stat => {
                                    if (stat.type == "outbound-rtp" && !stat.isRemote) {
                                        let sampleData = processStats(stat);
                                        collectRelevantSamples(false, stat, sampleData);
                                    }
                                });
                                remoteStats.forEach(stat => {
                                    if (stat.type == "inbound-rtp" && !stat.isRemote) {
                                        let sampleData = processStats(stat);
                                        collectRelevantSamples(true, stat, sampleData);
                                    }
                                });
                            })
                    }, 1000, 10);
                }
            }
        }
    }

    function onRemoteStreamAdded(event) {
        remoteStream = event.streams[0];
    }

    Lib.preCallTest = function(mediaDevices, connectivity, messageBoxId, callback) {
        if (messageBoxId) {
            Lib.messageBoxId = messageBoxId;
        }

        if (mediaDevices && !connectivity) {
            Lib.testAll = false;
            accessLocalMedia();
            var keepChecking = setInterval(function() {
                if (hasTestFinished(connectivity, mediaDevices)) {
                    if (callback) {
                        if (adapter) {
                            browserName = adapter.browserDetails.browser;
                            browserVersion = adapter.browserDetails.version;
                        }
                        let finalResult = {
                            'browserName': browserName,
                            'browserVersion': browserVersion,
                            'videoDevice': videoDevice,
                            'supportedResolutions': supportedResolutions,
                            'audioDevice': audioDevice,
                            'connectivity': ICESuccess,
                            'throughput': throughput,
                            'avg-audio-jitter': receiver.audio.jitter[0],
                            'avg-video-jitter': receiver.video.jitter[0],
                            'avg-audio-bitrate': sender.audio.bitrateMean[0],
                            'avg-video-bitrate': sender.video.bitrateMean[0]
                        };
                        callback(finalResult);
                        printText('Test Finished[Result]:');
                        printText(JSON.stringify(finalResult));
                    }
                    clearInterval(keepChecking);
                    finishTest();
                }
            }, 1000);
        }

        if (connectivity && !mediaDevices) {
            Lib.testAll = false;
            createLoopBackConnections();
            var keepChecking = setInterval(function() {
                if (hasTestFinished(connectivity, mediaDevices)) {
                    if (callback) {
                        reduceToAverage();
                        if (adapter) {
                            browserName = adapter.browserDetails.browser;
                            browserVersion = adapter.browserDetails.version;
                        }
                        let finalResult = {
                            'browserName': browserName,
                            'browserVersion': browserVersion,
                            'videoDevice': videoDevice,
                            'supportedResolutions': supportedResolutions,
                            'audioDevice': audioDevice,
                            'connectivity': ICESuccess,
                            'throughput': throughput,
                            'avg-audio-jitter': receiver.audio.jitter[0],
                            'avg-video-jitter': receiver.video.jitter[0],
                            'avg-audio-bitrate': sender.audio.bitrateMean[0],
                            'avg-video-bitrate': sender.video.bitrateMean[0]
                        };
                        callback(finalResult);
                        printText('Test Finished[Result]:');
                        printText(JSON.stringify(finalResult));
                    }
                    clearInterval(keepChecking);
                    finishTest();
                }
            }, 1000);
        }

        if (connectivity && mediaDevices) {
            Lib.testAll = true;
            connectivityCheckStarted = false;
            accessLocalMedia();
            var keepChecking = setInterval(function() {
                if (hasTestFinished(connectivity, mediaDevices)) {
                    if (callback) {
                        reduceToAverage();
                        if (adapter) {
                            browserName = adapter.browserDetails.browser;
                            browserVersion = adapter.browserDetails.version;
                        }
                        let finalResult = {
                            'browserName': browserName,
                            'browserVersion': browserVersion,
                            'videoDevice': videoDevice,
                            'supportedResolutions': supportedResolutions,
                            'audioDevice': audioDevice,
                            'connectivity': ICESuccess,
                            'throughput': throughput,
                            'avg-audio-jitter': receiver.audio.jitter[0],
                            'avg-video-jitter': receiver.video.jitter[0],
                            'avg-audio-bitrate': sender.audio.bitrateMean[0],
                            'avg-video-bitrate': sender.video.bitrateMean[0]
                        };
                        callback(finalResult);
                        printText('Test Finished[Result]:');
                        printText(JSON.stringify(finalResult));
                    }
                    clearInterval(keepChecking);
                    finishTest();
                }
            }, 1000);
        }
    }

    function finishTest() {
        let tracks = localStream.getTracks();
        tracks.forEach(function(track) {
            track.stop();
        });
        localDataChannel.close();
        remoteDataChannel.close();
        localConnection.close();
        remoteConnection.close();
        localDataChannel = null;
        remoteDataChannel = null;
        localConnection = null;
        remoteConnection = null;
    }

    function printText(text) {
        const messageBox = document.getElementById(Lib.messageBoxId);
        console.log(text);
        if (messageBox) {
            messageBox.value += '- ' + text + '\n';
        }
    }

    function hasTestFinished(connectivity, mediaDevices) {
        if (mediaDevices && !connectivity) {
            if (videoDevice != null && audioDevice != null) {
                if (videoDevice != 'access denied' && audioDevice != 'access denied') {
                    if (supportedResolutions.length > 0) {
                        return true;
                    } else {
                        return false;
                    }
                } else {
                    return true;
                }
            }
        }

        if (connectivity && !mediaDevices) {
            if (ICESuccess && throughputComputed && lastNetworkSampleComputed) {
                return true;
            } else {
                return false;
            }
        }

        if (connectivity && mediaDevices) {
            if (ICESuccess && throughputComputed && lastNetworkSampleComputed) {
                return true;
            } else {
                return false;
            }
        }
    }

    function processStats(stat) {

        var sampleData = {};

        if (stat.packetsReceived !== undefined) {
            sampleData.packetsReceived = stat.packetsReceived;
            if (stat.bytesReceived !== undefined) {
                sampleData.bytesReceived = (stat.bytesReceived / 1024000).toFixed(2);
            }
            if (stat.packetsLost !== undefined) {
                sampleData.packetsLost = stat.packetsLost;
            }
        } else if (stat.packetsSent !== undefined) {
            sampleData.packetsSent = stat.packetsSent;
            if (stat.bytesSent !== undefined) {
                sampleData.bytesSent = (stat.bytesSent / 1024000).toFixed(2);
            }
        } else {}


        if (stat.bitrateMean !== undefined) {
            sampleData.bitrateMean = (stat.bitrateMean / 1000000).toFixed(2);
            if (stat.bitrateStdDev !== undefined) {
                sampleData.bitrateStdDev = (stat.bitrateStdDev / 1000000).toFixed(2);
            }
            if (stat.discardedPackets !== undefined) {
                sampleData.discardedPackets = stat.discardedPackets;
            }
        }


        if (stat.framerateMean !== undefined) {
            sampleData.framerateMean = (stat.framerateMean).toFixed(2);
            if (stat.framerateStdDev !== undefined) {
                sampleData.framerateStdDev = (stat.framerateStdDev).toFixed(2);
            }
        }

        if (stat.droppedFrames !== undefined) {
            sampleData.droppedFrames = stat.droppedFrames;
        }

        if (stat.jitter !== undefined) {
            sampleData.jitter = stat.jitter;
        }
        return sampleData;
    }

    function collectRelevantSamples(isReceiver, stat, sampleData) {
        if (!isReceiver) {
            if (stat.mediaType == "audio") {
                if (sampleData.hasOwnProperty("packetsReceived"))
                    sender.audio.packetsReceived = sampleData.packetsReceived;
                if (sampleData.hasOwnProperty("bytesReceived"))
                    sender.audio.bytesReceived = sampleData.bytesReceived;
                if (sampleData.hasOwnProperty("packetsLost"))
                    sender.audio.packetsLost = sampleData.packetsLost;
                if (sampleData.hasOwnProperty("packetsSent"))
                    sender.audio.packetsSent = sampleData.packetsSent;
                if (sampleData.hasOwnProperty("bytesSent"))
                    sender.audio.bytesSent = sampleData.bytesSent;
                if (sampleData.hasOwnProperty("bitrateMean"))
                    sender.audio.bitrateMean.push(sampleData.bitrateMean);
                if (sampleData.hasOwnProperty("bitrateStdDev"))
                    sender.audio.bitrateStdDev.push(sampleData.bitrateStdDev);
                if (sampleData.hasOwnProperty("discardedPackets"))
                    sender.audio.discardedPackets = sampleData.discardedPackets;
                if (sampleData.hasOwnProperty("framerateMean"))
                    sender.audio.framerateMean.push(sampleData.framerateMean);
                if (sampleData.hasOwnProperty("framerateStdDev"))
                    sender.audio.framerateStdDev.push(sampleData.framerateStdDev);
                if (sampleData.hasOwnProperty("droppedFrames"))
                    sender.audio.droppedFrames = sampleData.droppedFrames;
                if (sampleData.hasOwnProperty("jitter"))
                    sender.audio.jitter.push(sampleData.jitter);
            }
            if (stat.mediaType == "video") {
                if (sampleData.hasOwnProperty("packetsReceived"))
                    sender.video.packetsReceived = sampleData.packetsReceived;
                if (sampleData.hasOwnProperty("bytesReceived"))
                    sender.video.bytesReceived = sampleData.bytesReceived;
                if (sampleData.hasOwnProperty("packetsLost"))
                    sender.video.packetsLost = sampleData.packetsLost;
                if (sampleData.hasOwnProperty("packetsSent"))
                    sender.video.packetsSent = sampleData.packetsSent;
                if (sampleData.hasOwnProperty("bytesSent"))
                    sender.video.bytesSent = sampleData.bytesSent;
                if (sampleData.hasOwnProperty("bitrateMean"))
                    sender.video.bitrateMean.push(sampleData.bitrateMean);
                if (sampleData.hasOwnProperty("bitrateStdDev"))
                    sender.video.bitrateStdDev.push(sampleData.bitrateStdDev);
                if (sampleData.hasOwnProperty("discardedPackets"))
                    sender.video.discardedPackets = sampleData.discardedPackets;
                if (sampleData.hasOwnProperty("framerateMean"))
                    sender.video.framerateMean.push(sampleData.framerateMean);
                if (sampleData.hasOwnProperty("framerateStdDev"))
                    sender.video.framerateStdDev.push(sampleData.framerateStdDev);
                if (sampleData.hasOwnProperty("droppedFrames"))
                    sender.video.droppedFrames = sampleData.droppedFrames;
                if (sampleData.hasOwnProperty("jitter"))
                    sender.video.jitter.push(sampleData.jitter);
            }
        } else {
            if (stat.mediaType == "audio") {
                if (sampleData.hasOwnProperty("packetsReceived"))
                    receiver.audio.packetsReceived = sampleData.packetsReceived;
                if (sampleData.hasOwnProperty("bytesReceived"))
                    receiver.audio.bytesReceived = sampleData.bytesReceived;
                if (sampleData.hasOwnProperty("packetsLost"))
                    receiver.audio.packetsLost = sampleData.packetsLost;
                if (sampleData.hasOwnProperty("packetsSent"))
                    receiver.audio.packetsSent = sampleData.packetsSent;
                if (sampleData.hasOwnProperty("bytesSent"))
                    receiver.audio.bytesSent = sampleData.bytesSent;
                if (sampleData.hasOwnProperty("bitrateMean"))
                    receiver.audio.bitrateMean.push(sampleData.bitrateMean);
                if (sampleData.hasOwnProperty("bitrateStdDev"))
                    receiver.audio.bitrateStdDev.push(sampleData.bitrateStdDev);
                if (sampleData.hasOwnProperty("discardedPackets"))
                    receiver.audio.discardedPackets = sampleData.discardedPackets;
                if (sampleData.hasOwnProperty("framerateMean"))
                    receiver.audio.framerateMean.push(sampleData.framerateMean);
                if (sampleData.hasOwnProperty("framerateStdDev"))
                    receiver.audio.framerateStdDev.push(sampleData.framerateStdDev);
                if (sampleData.hasOwnProperty("droppedFrames"))
                    receiver.audio.droppedFrames = sampleData.droppedFrames;
                if (sampleData.hasOwnProperty("jitter"))
                    receiver.audio.jitter.push(sampleData.jitter);
            }
            if (stat.mediaType == "video") {
                if (sampleData.hasOwnProperty("packetsReceived"))
                    receiver.video.packetsReceived = sampleData.packetsReceived;
                if (sampleData.hasOwnProperty("bytesReceived"))
                    receiver.video.bytesReceived = sampleData.bytesReceived;
                if (sampleData.hasOwnProperty("packetsLost"))
                    receiver.video.packetsLost = sampleData.packetsLost;
                if (sampleData.hasOwnProperty("packetsSent"))
                    receiver.video.packetsSent = sampleData.packetsSent;
                if (sampleData.hasOwnProperty("bytesSent"))
                    receiver.video.bytesSent = sampleData.bytesSent;
                if (sampleData.hasOwnProperty("bitrateMean"))
                    receiver.video.bitrateMean.push(sampleData.bitrateMean);
                if (sampleData.hasOwnProperty("bitrateStdDev"))
                    receiver.video.bitrateStdDev.push(sampleData.bitrateStdDev);
                if (sampleData.hasOwnProperty("discardedPackets"))
                    receiver.video.discardedPackets = sampleData.discardedPackets;
                if (sampleData.hasOwnProperty("framerateMean"))
                    receiver.video.framerateMean.push(sampleData.framerateMean);
                if (sampleData.hasOwnProperty("framerateStdDev"))
                    receiver.video.framerateStdDev.push(sampleData.framerateStdDev);
                if (sampleData.hasOwnProperty("droppedFrames"))
                    receiver.video.droppedFrames = sampleData.droppedFrames;
                if (sampleData.hasOwnProperty("jitter"))
                    receiver.video.jitter.push(sampleData.jitter);
            }
        }
    }

    function getSum(total, num) {
        return parseFloat(total) + parseFloat(num);
    }

    function reduceToAverage() {

        if (sender.audio.bitrateMean.length > 0) {
            let avgBitrateMean = sender.audio.bitrateMean.reduce(getSum) / sender.audio.bitrateMean.length;
            sender.audio.bitrateMean = [];
            sender.audio.bitrateMean.push(avgBitrateMean);
        }
        if (sender.video.bitrateMean.length > 0) {
            let avgBitrateMean = sender.video.bitrateMean.reduce(getSum) / sender.video.bitrateMean.length;
            sender.video.bitrateMean = [];
            sender.video.bitrateMean.push(avgBitrateMean);
        }

        if (receiver.audio.jitter.length > 0) {
            let avgJitter = receiver.audio.jitter.reduce(getSum) / receiver.audio.jitter.length;
            receiver.audio.jitter = [];
            receiver.audio.jitter.push(avgJitter);
        }

        if (receiver.video.jitter.length > 0) {
            let avgJitter = receiver.video.jitter.reduce(getSum) / receiver.video.jitter.length;
            receiver.video.jitter = [];
            receiver.video.jitter.push(avgJitter);
        }
    };

    window.Lib = Lib;
}(window));