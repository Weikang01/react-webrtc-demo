// import Webcam from "./components/Webcam";
import { createContext, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import socketIO from "socket.io-client";

export const RouterContext = createContext();

let socket = null;
let localConnection = null;
let localChannel = null;
let localOffer = null;

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

  const [messages, setMessages] = useState([]);

  const connectButton = useRef();
  const disconnectButton = useRef();
  const sendButton = useRef();
  const messageInputBox = useRef();
  const receiveBox = useRef();
  const remoteVideo = useRef();

  const initializeLocalChannelListeners = () => {
    localChannel.onopen = handleLocalChannelStatusChange;
    localChannel.onclose = handleLocalChannelStatusChange;
    localChannel.onerror = (error) =>
      console.error("dataChannel error:", error);

    localChannel.onmessage = handleReceiveMessage;
  };

  const receiveChannelCallback = (event) => {
    localChannel = event.channel;
    initializeLocalChannelListeners();
  };

  const initSocket = () => {
    socket = socketIO.connect(
      `http://localhost:3001?username=${USERNAME}&roomname=test_room`
    );

    socket.on("remoteOffer", (remoteOffer) => {
      clearConsole();
      console.log(USERNAME, "received offer!");
      localConnection = new RTCPeerConnection();

      addStream();
      localConnection.onicecandidate = handleIceCandidate;
      localConnection.ondatachannel = receiveChannelCallback;

      localConnection.setRemoteDescription(remoteOffer);
      localConnection.ontrack = handleTrack;

      localConnection.createAnswer().then((answer) => {
        localConnection.setLocalDescription(answer);
        socket.emit("answer", answer);
        console.log(USERNAME, "sent answer!");
      });
    });

    socket.on("remoteAnswer", (answer) => {
      console.log(USERNAME, "received answer!");
      localConnection.setLocalDescription(localOffer);
      localConnection.setRemoteDescription(answer);
    });

    socket.on("remoteCandidate", (candidate) => {
      localConnection.addIceCandidate(candidate);
      console.log(USERNAME, "received candidate!");
    });
  };

  const addStream = () => {
    // add stream
    try {
      navigator.mediaDevices.getUserMedia = getUserMedia();
      if (navigator.mediaDevices.getUserMedia)
        navigator.mediaDevices
          .getUserMedia({ audio: true, video: true })
          .then((stream) =>
            stream
              .getTracks()
              .forEach((track) => localConnection.addTrack(track, stream))
          );
      console.log(`${USERNAME} added media tracks!`);
    } catch (e) {
      console.error(`${USERNAME} do not support media`);
    }
  };

  const connectPeers = () => {
    localConnection = new RTCPeerConnection();
    localConnection.ondatachannel = receiveChannelCallback;

    // add data channel
    localChannel = localConnection.createDataChannel(`localChannel`);

    // add stream
    addStream();
    initializeLocalChannelListeners();
    // console.log("connectPeers", localChannel);

    if (!socket) initSocket();

    localConnection.onicecandidate = handleIceCandidate;
    localConnection.ontrack = handleTrack;

    localConnection.createOffer().then((offer) => {
      localOffer = offer;
      socket.emit("offer", offer);
      console.log(USERNAME, "sent offer!");
    });
  };

  const disconnectPeers = () => {
    console.log("disconnecting...");
    localChannel.close();
    localConnection.close();

    localChannel = null;
    localConnection = null;

    messageInputBox.current.setAttribute("disabled", true);
    sendButton.current.setAttribute("disabled", true);
    connectButton.current.removeAttribute("disabled");
    messageInputBox.current.value = "";
    disconnectButton.current.setAttribute("disabled", true);
  };

  const handleLocalChannelStatusChange = (event) => {
    if (localChannel) {
      var state = localChannel.readyState;
      console.log("local channel status:", localChannel.readyState);

      if (state === "open") {
        messageInputBox.current.removeAttribute("disabled");
        messageInputBox.current.focus();
        sendButton.current.removeAttribute("disabled");
        disconnectButton.current.removeAttribute("disabled");
        connectButton.current.setAttribute("disabled", true);
      } else {
        messageInputBox.current.setAttribute("disabled", true);
        sendButton.current.setAttribute("disabled", true);
        connectButton.current.removeAttribute("disabled");
        disconnectButton.current.setAttribute("disabled", true);
      }
    } else {
      console.log("handleLocalChannelStatusChange localChannel == null", event);
    }
  };

  const handleReceiveMessage = (event) => {
    console.log("handleReceiveMessage > localChannel");
    messages.push({
      id: uuidv4(),
      text: event.data,
    });

    setMessages([...messages]);
  };

  const handleTrack = async (event) => {
    const [remoteStream] = event.streams;
    remoteVideo.current.srcObject = remoteStream;
  };

  const handleIceCandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", event.candidate);
      console.log(USERNAME, "sent candidate!");
    } else {
      console.warn(USERNAME, "has no candidate!");
    }
  };

  const sendMessage = () => {
    console.log("sendMessage > localChannel ", localChannel);
    if (!localChannel) {
      return;
    }

    localChannel.send(messageInputBox.current.value);

    messageInputBox.current.value = "";
    messageInputBox.current.focus();
    console.log("message sent!");
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
          // disabled
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
        <button
          id="send"
          ref={sendButton}
          onClick={sendMessage}
          // disabled
        >
          Send
        </button>
      </div>
      <div id="receivebox" ref={receiveBox}>
        <p>Messages received:</p>
        {messages.map((msg) => {
          return (
            <div key={msg.id}>
              <p>{msg.text}</p>
            </div>
          );
        })}
      </div>
      <video autoPlay controls muted ref={remoteVideo}></video>
    </>
  );
}

export default App;
