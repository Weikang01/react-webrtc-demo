// import Webcam from "./components/Webcam";
import { createContext, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import socketIO from "socket.io-client";

export const RouterContext = createContext();

const CONNECTION_MODEL = {
  SENDER: "SENDER",
  RECEIVER: "RECEIVER",
};

function App() {
  const USERNAME = `test_user${Math.round(Math.random() * 100)}`;

  const [connectionModel, setConnectionModel] = useState(null);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [localConnection, setLocalConnection] = useState(null);
  const [localChannel, setLocalChannel] = useState(null);
  const [remoteDescription, setRemoteDescription] = useState(null);
  const [candidates, setCandidates] = useState(null);

  const connectButton = useRef();
  const disconnectButton = useRef();
  const sendButton = useRef();
  const messageInputBox = useRef();
  const receiveBox = useRef();

  const receiveChannelCallback = (event) => {
    setLocalChannel(event.channel);
    console.log(USERNAME, "received channel callback!");
  };

  const handleAddCandidateError = (e) => {
    console.log("Oh noes! addICECandidate failed! ", e);
  };

  useEffect(() => {
    if (socket) {
      socket.on("remoteOffer", (remoteOffer) => {
        console.log(
          USERNAME,
          "received offer!",
          remoteOffer,
          "remote description set!"
        );
        setRemoteDescription(remoteOffer);
        setConnectionModel(CONNECTION_MODEL.RECEIVER);
        setLocalConnection(new RTCPeerConnection());
      });

      socket.on("remoteAnswer", (answer) => {
        console.log(
          USERNAME,
          "received answer!",
          answer,
          "going to set local and remote description!"
        );
        // localConnection.setLocalDescription(localDescription);
        localConnection.setRemoteDescription(answer);
      });

      socket.on("remoteCandidate", (candidate) => {
        console.log(USERNAME, "received candidate!", candidate);
        localConnection.addIceCandidate(candidate);
      });

      localConnection.createOffer().then((offer) => {
        localConnection.setLocalDescription(offer);
        socket.emit("offer", offer);
        console.log(USERNAME, "sent offer! local description set!");
      });
    }
  }, [socket]);

  useEffect(() => {
    if (localChannel) {
      if (connectionModel === CONNECTION_MODEL.SENDER) {
        localConnection.onicecandidate = (e) =>
          !e.candidate || socket.emit("candidate", e.candidate);
        localConnection.onconnectionstatechange = (e) =>
          localChannel.connectionState !== "connected" ||
          console.log("localConnection connected!");
      }

      localChannel.onopen = handleLocalChannelStatusChange;
      localChannel.onclose = handleLocalChannelStatusChange;
      localChannel.onerror = (error) =>
        console.error("dataChannel error:", error);

      localChannel.onmessage = handleReceiveMessage;
    }
  }, [localChannel]);

  useEffect(() => {
    if (localConnection) {
      console.log("local connection", localConnection, connectionModel);
      if (connectionModel === CONNECTION_MODEL.SENDER) {
        localConnection.ondatachannel = receiveChannelCallback;
        setLocalChannel(localConnection.createDataChannel(`localChannel`));

        if (!socket)
          setSocket(
            socketIO.connect(
              `http://localhost:3001?username=${USERNAME}&roomname=test_room`
            )
          );
      } else if (connectionModel === CONNECTION_MODEL.RECEIVER) {
        localConnection.ondatachannel = receiveChannelCallback;
        localConnection.setRemoteDescription(remoteDescription);

        localConnection.createAnswer().then((answer) => {
          localConnection.setLocalDescription(answer);

          socket.emit("answer", answer);
          console.log(USERNAME, "sent answer! local description set!");
        });
      }
    }
  }, [localConnection]);

  const connectPeers = async () => {
    setConnectionModel(CONNECTION_MODEL.SENDER);
    setLocalConnection(new RTCPeerConnection());
  };

  const disconnectPeers = () => {
    console.log("disconnecting...");
    localChannel.close();
    localConnection.close();
    socket.disconnect();

    setLocalChannel(null);
    setLocalConnection(null);
    setSocket(null);

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
    if (!localChannel) return;

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