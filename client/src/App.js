// import Webcam from "./components/Webcam";
import { createContext, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import socketIO from "socket.io-client";

export const RouterContext = createContext();

const CONNECTION_MODEL = {
  SENDER: "SENDER",
  RECEIVER: "RECEIVER",
};

const clearConsole = () => {
  // tslint:disable-next-line: variable-name
  const _console = console;
  // tslint:disable-next-line: no-string-literal
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
};

function App() {
  const [USERNAME, _] = useState(`test_user${Math.round(Math.random() * 100)}`);
  const [connectionModel, setConnectionModel] = useState(null);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [localConnection, setLocalConnection] = useState(null);
  const [localChannel, setLocalChannel] = useState(null);
  const [localDescription, setLocalDescription] = useState(null);
  const [remoteDescription, setRemoteDescription] = useState(null);

  const connectButton = useRef();
  const disconnectButton = useRef();
  const sendButton = useRef();
  const messageInputBox = useRef();
  const receiveBox = useRef();

  useEffect(() => {
    if (connectionModel) {
      console.log(`create ${connectionModel} peer connection!`);
      setLocalConnection(new RTCPeerConnection());
    }
  }, [connectionModel]);

  useEffect(() => {
    if (remoteDescription) {
      if (connectionModel === CONNECTION_MODEL.RECEIVER) {
        // remote offer
        setLocalConnection(new RTCPeerConnection());
      } else if (connectionModel === CONNECTION_MODEL.SENDER) {
        // remote answer
        localConnection.setLocalDescription(localDescription);
        localConnection.setRemoteDescription(remoteDescription);
        console.log(
          `${connectionModel}'s local/remoteDescription are all set!`
        );
      }
    }
  }, [remoteDescription]);

  useEffect(() => {
    if (localDescription) {
      if (connectionModel === CONNECTION_MODEL.RECEIVER) {
        // answer
        localConnection.setLocalDescription(localDescription);
      } else {
        // offer
      }
    }
  }, [localDescription]);

  useEffect(() => {
    if (socket) {
      localConnection.onicecandidate = (event) =>
        !event.candidate || socket.emit("candidate", event.candidate);

      socket.on("remoteOffer", async (remoteOffer) => {
        clearConsole();
        console.log(`${connectionModel} server got remoteOffer!`, remoteOffer);
        setConnectionModel(CONNECTION_MODEL.RECEIVER);
        setRemoteDescription(remoteOffer);
      });

      socket.on("remoteAnswer", async (remoteAnswer) => {
        console.log(
          `${connectionModel} server got remoteAnswer!`,
          remoteAnswer
        );
        setRemoteDescription(remoteAnswer);
      });

      socket.on("remoteCandidate", (remoteCandidate) => {
        console.log(
          `${connectionModel} got remote candidate! local connection`,
          "\nlocalConnection: ",
          localConnection,
          "\nlocalDescription: ",
          localDescription,
          "\nremoteDescription: ",
          remoteDescription,
          "\nThis line raises an error because the local variable in this function is not identical to the value outside."
        );
        localConnection.addIceCandidate(remoteCandidate);
      });

      if (connectionModel === CONNECTION_MODEL.SENDER) {
        localConnection.createOffer().then((offer) => {
          console.log(`${connectionModel} offer created!`);
          setLocalDescription(offer);
          socket.emit("offer", offer);
        });
      }
    }
  }, [socket]);

  useEffect(() => {
    if (localChannel) {
      localChannel.onmessage = handleLocalMessage;
      localChannel.onopen = handleLocalChannelStatusChange;
      localChannel.onclose = handleLocalChannelStatusChange;
      console.log(`${connectionModel} local channel created!`);

      if (!socket)
        setSocket(
          socketIO.connect(
            `http://localhost:3001?username=${USERNAME}&roomname=test_room`
          )
        );
      else {
        let offer = localConnection.createOffer();
        setLocalDescription(offer);
        socket.emit("offer", offer);
      }
    }
  }, [localChannel]);

  useEffect(() => {
    if (localConnection) {
      console.log(
        `${connectionModel} local connection created!`,
        localConnection
      );

      if (connectionModel === CONNECTION_MODEL.SENDER) {
        setLocalChannel(localConnection.createDataChannel("localChannel"));
      } else if (connectionModel === CONNECTION_MODEL.RECEIVER) {
        localChannel.ondatachannel = (event) => setLocalChannel(event.channel);

        localConnection.setRemoteDescription(remoteDescription).then(() =>
          localConnection.createAnswer().then((answer) => {
            socket.emit("answer", answer);
            localConnection.setLocalDescription(answer);
          })
        );
        console.log(
          `${connectionModel}'s local/remoteDescription are all set!`
        );
      }
    }
  }, [localConnection]);

  const connectPeers = async () => {
    setConnectionModel(CONNECTION_MODEL.SENDER);
  };

  const disconnectPeers = () => {
    console.log("disconnecting...");
    localChannel.close();
    localConnection.close();
    socket.disconnect();

    setLocalChannel(null);
    setLocalConnection(null);
    setSocket(null);
    setConnectionModel(null);

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

  const handleLocalMessage = (event) => {
    console.log(`${connectionModel} handle local message!`, event);
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
