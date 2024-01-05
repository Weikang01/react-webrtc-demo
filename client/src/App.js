// import Webcam from "./components/Webcam";
import { createContext, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import socketIO from "socket.io-client";

export const RouterContext = createContext();

function App() {
  const USERNAME = `test_user${Math.round(Math.random() * 100)}`;
  let socket = null;

  const [messages, setMessages] = useState([]);

  const connectButton = useRef();
  const disconnectButton = useRef();
  const sendButton = useRef();
  const messageInputBox = useRef();
  const receiveBox = useRef();

  let localConnection = null;
  let localChannel = null;

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
      console.log(USERNAME, "received offer!", remoteOffer);
      localConnection = new RTCPeerConnection();
      localConnection.ondatachannel = receiveChannelCallback;

      localConnection.setRemoteDescription(remoteOffer);
      localConnection.onicecandidate = (e) => {
        socket.emit("candidate", e.candidate);
        console.log(USERNAME, "sent candidate!");
      };

      localConnection.createAnswer().then((answer) => {
        localConnection.setLocalDescription(answer);
        socket.emit("answer", answer);
        console.log(USERNAME, "sent answer!");
      });
    });

    socket.on("remoteAnswer", (answer) => {
      console.log(USERNAME, "received answer!", answer);

      localConnection.setRemoteDescription(answer);
    });

    socket.on("remoteCandidate", (candidate) => {
      localConnection.addIceCandidate(candidate);
      console.log(USERNAME, "received candidate!");
    });
  };

  const connectPeers = () => {
    localConnection = new RTCPeerConnection();
    localConnection.ondatachannel = receiveChannelCallback;
    localChannel = localConnection.createDataChannel(`localChannel`);
    initializeLocalChannelListeners();
    console.log("connectPeers", localChannel);

    if (!socket) initSocket();

    localConnection.onicecandidate = (e) => {
      socket.emit("candidate", e.candidate);
      console.log(USERNAME, "sent candidate!");
    };

    localConnection.createOffer().then((offer) => {
      localConnection.setLocalDescription(offer);
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
    console.log("handleReceiveMessage > localChannel", localChannel);
    messages.push({
      id: uuidv4(),
      text: event.data,
    });

    setMessages([...messages]);
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
    </>
  );
}

export default App;
