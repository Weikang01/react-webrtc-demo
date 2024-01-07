// import Webcam from "./components/Webcam";
import { createContext, useRef } from "react";
import socketIO from "socket.io-client";

export const RouterContext = createContext();

let socket = null;
let localConnection = null;
let localDescription = null;

function getUserMedia() {
  //check if the browser supports the WebRTC
  return (
    navigator.mediaDevices.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia
  );
}

function clearConsole() {
  const _console = console;
  let consoleAPI = console["API"];
  if (typeof _console._commandLineAPI !== "undefined") {
    // Chrome
    consoleAPI = _console._commandLineAPI;
  } else if (typeof _console._inspectorCommandLineAPI !== "undefined") {
    // Safari
    consoleAPI = _console._inspectorCommandLineAPI;
  } else if (typeof _console.clear !== "undefined") {
    // rest
    consoleAPI = _console;
  }
  consoleAPI.clear();
}

function App() {
  const USERNAME = `test_user${Math.round(Math.random() * 100)}`;

  const connectButton = useRef();
  const disconnectButton = useRef();
  const sendButton = useRef();
  const messageInputBox = useRef();
  const remoteVideo = useRef();

  const handleIceCandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", event.candidate);
      console.log(USERNAME, "sent candidate!");
    } else {
      console.warn(USERNAME, "has no candidate!");
    }
  };

  const handleIceStateChange = (event) => {
    if (localConnection) {
      console.log(
        USERNAME,
        "ICE state:",
        localConnection.iceConnectionState,
        "event: ",
        event
      );
    } else {
      console.log(USERNAME, event);
    }
  };

  const initSocket = () => {
    socket = socketIO.connect(
      `http://localhost:3001?username=${USERNAME}&roomname=test_room`
    );

    socket.on("remoteOffer", (remoteOffer) => {
      clearConsole();
      console.log(USERNAME, "received offer! reinitiate local connection!");
      localConnection = new RTCPeerConnection();

      localConnection.ontrack = handleTrack;
      localConnection.onicecandidate = handleIceCandidate;
      localConnection.oniceconnectionstatechange = handleIceStateChange;

      // add stream
      navigator.mediaDevices.getUserMedia = getUserMedia();

      if (navigator.mediaDevices.getUserMedia)
        navigator.mediaDevices
          .getUserMedia({ audio: false, video: true })
          .then((stream) => {
            stream
              .getTracks()
              .forEach((track) => localConnection.addTrack(track, stream));
            console.log(`${USERNAME} added media tracks!`);
          })
          .then(() => {
            console.log(`${USERNAME} added remote offer!`);
            localConnection.setRemoteDescription(remoteOffer).then(() =>
              localConnection.createAnswer().then((answer) => {
                localConnection.setLocalDescription(answer);
                socket.emit("answer", answer);
                console.log(USERNAME, "sent answer!");
              })
            );
          })
          .catch(
            (e) =>
              `${USERNAME}  error during media track addition and answer sending!`
          );
    });

    socket.on("remoteAnswer", (answer) => {
      console.log(USERNAME, "received answer!");
      localConnection
        .setLocalDescription(localDescription)
        .then(() => localConnection.setRemoteDescription(answer));
    });

    socket.on("remoteCandidate", (candidate) => {
      localConnection
        .addIceCandidate(candidate)
        .then(() => console.log(USERNAME, "received candidate!"));
    });
  };

  const connectPeers = () => {
    localConnection = new RTCPeerConnection();

    if (!socket) initSocket();

    localConnection.ontrack = handleTrack;
    localConnection.onicecandidate = handleIceCandidate;
    localConnection.oniceconnectionstatechange = handleIceStateChange;

    // add stream
    navigator.mediaDevices.getUserMedia = getUserMedia();

    if (navigator.mediaDevices.getUserMedia)
      navigator.mediaDevices
        .getUserMedia({ audio: false, video: true })
        .then((stream) => {
          stream
            .getTracks()
            .forEach((track) => localConnection.addTrack(track, stream));
          console.log(`${USERNAME} added media tracks!`);
        })
        .then(() =>
          localConnection.createOffer().then((offer) => {
            localDescription = offer;
            socket.emit("offer", offer);
            console.log(USERNAME, "sent offer!");

            messageInputBox.current.removeAttribute("disabled");
            sendButton.current.removeAttribute("disabled");
            connectButton.current.setAttribute("disabled", true);
            disconnectButton.current.removeAttribute("disabled");
          })
        )
        .catch((e) =>
          console.log(
            `${USERNAME} error during media track addition and offer sending!`
          )
        );
  };

  const disconnectPeers = () => {
    console.log("disconnecting...");
    socket.disconnect();
    console.log("disconnecting...");
    localConnection.close();

    socket = null;
    localConnection = null;

    messageInputBox.current.setAttribute("disabled", true);
    sendButton.current.setAttribute("disabled", true);
    connectButton.current.removeAttribute("disabled");
    messageInputBox.current.value = "";
    disconnectButton.current.setAttribute("disabled", true);

    console.log("disconnected!");
  };

  const handleTrack = async (event) => {
    console.log(`${USERNAME} handling track!`);
    const [remoteStream] = event.streams;
    remoteVideo.current.srcObject = remoteStream;
  };

  const sendMessage = () => {
    console.log("sendMessage!");
  };

  return (
    <>
      <div className="control-box">
        <button id="connect" onClick={connectPeers} ref={connectButton}>
          Connect
        </button>
        <button
          id="disconnect"
          onClick={disconnectPeers}
          ref={disconnectButton}
          disabled
        >
          Disconnect
        </button>
      </div>
      <div className="messagebox">
        <label htmlFor="message">
          Enter a message:
          <input
            type="text"
            name="message"
            id="message"
            ref={messageInputBox}
            // disabled
          />
        </label>
        <button id="send" ref={sendButton} onClick={sendMessage} disabled>
          Send
        </button>
      </div>
      <video autoPlay controls muted ref={remoteVideo}></video>
    </>
  );
}

export default App;
