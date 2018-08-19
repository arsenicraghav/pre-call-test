##How to run:


[ Assuming nodejs and npm are installed ]

1] npm install -g http-server

2] cd <project_folder>

3] npm start

4] http://127.0.0.1:8080/ in Mozilla Firefox


##Documentation(How to use the library):

Lib  -- Library itself [global object] 

Lib.preCallTest(mediaDeviceTest, connectivityTest, displayOutputOnScreen, callback);

[params]:

mediaDeviceTest           [boolean]  --  whether to perform mediaDevices test

connectivityTest          [boolean]  --  whether to perform connectivity test 

displayOutputOnScreen     [string]   --  whether to display the result on the screen[ DOM element Id of the text area ] 

callback                  [function] --  Function to execute when the test is finished.

    

                
                 Example:  
                 
                 Lib.preCallTest(mediaDevices, connectivity, messageBoxId, function (testResult) {
                      console.log(testResult);
                 });
                 
                Sample Output: 
                
                {
                   "browserName":"firefox",
                   "browserVersion":61,
                   "videoDevice":"FaceTime HD Camera (Built-in)",
                   "supportedResolutions":[
                      {
                         "label":"720p(HD)",
                         "width":1280,
                         "height":720
                      }
                   ],
                   "audioDevice":"default: Internal Microphone",
                   "connectivity":true,
                   "throughput":0.28,
                   "avg-audio-jitter":0.0021,
                   "avg-video-jitter":0.0196,
                   "avg-video-bitrate":0.7000000000000001
                }
                
                


Default Settings [can be overridden by passing explicitly]:
-----------------------------------------------------------

Lib.mediaConfig  = { video: true, audio: true }

Lib.offerOptions = { offerToReceiveAudio: 1, offerToReceiveVideo: 1 }

Lib.iceConfig    =

{
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
}
