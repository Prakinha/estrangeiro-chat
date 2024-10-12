import { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import SocketIOClient from "socket.io-client";
import { Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";

import styles from "../styles/Room.module.scss";
import { Message } from "../types/message";

interface CompartmentMessage extends Message {
  id: string;
  content: string;
  sender: string;
  distortion?: boolean;
}

const RoomPage: NextPage = () => {
  const router = useRouter();
  const { room, stranger } = router.query;
  const isStranger = !!stranger;

  const [socket, setSocket] = useState<Socket | undefined>();
  const [messages, setMessages] = useState<CompartmentMessage[]>([]);
  const [clientMessage, setClientMessage] = useState<string>("");
  const [strangerMessage, setStrangerMessage] = useState<string>("");

  // Estados para decodificação, distorção e volume
  const [isDecodingEnabled, setIsDecodingEnabled] = useState<boolean>(true);
  const [isDistortionEnabled, setIsDistortionEnabled] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState<boolean>(true);

  // Referência para o elemento de áudio
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!room || !router) return;

    const io = SocketIOClient(process.env.API_BASE_URL as string, {
      path: "/api/socketio",
      query: {
        room: room as string,
      },
    });

    io.on("connect", () => {
      setSocket(io);
    });

    io.on("message", (message: CompartmentMessage) => {
      if (message.sender === "stranger" && isDecodingEnabled) {
        setMessages((oldMessages) => [...oldMessages, message]);
        decodeMessage(message.id, message.content);
      } else {
        setMessages((oldMessages) => [...oldMessages, message]);
      }
    });

    io.on("clientMessage", (message: string) => {
      if (!isStranger) return;
      setClientMessage(message);
    });

    // Listeners para eventos de controle
    io.on("toggleDecoding", (enabled: boolean) => {
      setIsDecodingEnabled(enabled);
    });

    io.on("toggleDistortion", (enabled: boolean) => {
      setIsDistortionEnabled(enabled);
    });

    io.on("adjustVolume", (newVolume: number) => {
      setVolume(newVolume);
    });

    setSocket(io);

    return () => {
      io.disconnect();
    };
  }, [room, router, isStranger]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Função para ajustar o volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    socket?.emit("adjustVolume", newVolume);
  };

  // Função para simular o efeito de pseudo-decodificação
  const decodeMessage = (messageId: string, finalMessage: string) => {
    const maxIterations = 150;
    let currentMessage = new Array(finalMessage.length).fill(" ").join("");
    let iterations = 0;
    const randomChars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";

    const intervalId = setInterval(() => {
      iterations++;
      let decoded = "";
      for (let i = 0; i < finalMessage.length; i++) {
        if (currentMessage[i] !== finalMessage[i]) {
          if (iterations < maxIterations / 3) {
            decoded += randomChars.charAt(
              Math.floor(Math.random() * randomChars.length)
            );
          } else if (iterations < (2 * maxIterations) / 3) {
            decoded +=
              Math.random() > 0.1
                ? randomChars.charAt(Math.floor(Math.random() * 36))
                : finalMessage[i];
          } else {
            decoded +=
              Math.random() > 0.2
                ? finalMessage[i]
                : randomChars.charAt(
                    Math.floor(Math.random() * randomChars.length)
                  );
          }
        } else {
          decoded += finalMessage[i];
        }
      }

      currentMessage = decoded;

      setMessages((oldMessages) =>
        oldMessages.map((msg) =>
          msg.id === messageId ? { ...msg, content: decoded } : msg
        )
      );

      if (decoded === finalMessage) {
        clearInterval(intervalId);
      }
    }, 150);
  };

  const checkIfUserIsAtBottom = () => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;

    setIsUserAtBottom(scrollTop + clientHeight >= scrollHeight - 10);
  };

  useEffect(() => {
    if (isUserAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [messages, isUserAtBottom]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.addEventListener(
        "scroll",
        checkIfUserIsAtBottom
      );
    }
    return () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.removeEventListener(
          "scroll",
          checkIfUserIsAtBottom
        );
      }
    };
  }, []);

  const sendMessage = async () => {
    if (isStranger ? !strangerMessage : !clientMessage) return;

    const messageId = uuidv4();
    const newMessage: CompartmentMessage = {
      id: messageId,
      message: isStranger ? strangerMessage : clientMessage,
      content: isStranger ? strangerMessage : clientMessage,
      room: room as string,
      stranger: isStranger,
      sender: isStranger ? "stranger" : "client",
      distortion: isDistortionEnabled,
    };

    socket?.emit("sendMessage", newMessage);

    setUserMessage("");
  };

  const setUserMessage = (newMessage: string) => {
    if (isStranger) {
      setStrangerMessage("");
    } else {
      socket?.emit("clientMessage", newMessage);
      setClientMessage(newMessage);
    }
  };

  // Estado para o menu expansível
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  return (
    <>
      <Head>
        <title>Sala</title>
      </Head>

      {/* Elemento de áudio invisível */}
      <audio autoPlay loop ref={audioRef} style={{ display: "none" }}>
        <source src="/audio/urnace.mp3" type="audio/mp3" />
      </audio>

      {!socket ? (
        <div className={styles.connecting}>
          <p className="text-glow">Conectando</p>
        </div>
      ) : (
        <section className={styles.program}>
          {isStranger && (
            <>
              {/* Botão para abrir/fechar o menu */}
              <button
                style={{
                  position: "fixed",
                  top: "10px",
                  right: "10px",
                  background: "gray",
                  color: "white",
                  padding: "10px",
                  borderRadius: "5px",
                  cursor: "pointer",
                  zIndex: 1000,
                }}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? "Fechar Menu" : "Abrir Menu"}
              </button>

              {/* Menu Expansível */}
              {isMenuOpen && (
                <div
                  style={{
                    position: "fixed",
                    top: "60px",
                    right: "10px",
                    background: "rgba(0, 0, 0, 0.8)",
                    padding: "15px",
                    borderRadius: "5px",
                    color: "white",
                    zIndex: 1000,
                    width: "200px",
                  }}
                >
                  {/* Controle de Decodificação */}
                  <button
                    style={{
                      background: isDecodingEnabled ? "green" : "red",
                      color: "white",
                      padding: "10px",
                      borderRadius: "5px",
                      cursor: "pointer",
                      marginBottom: "10px",
                      width: "100%",
                    }}
                    onClick={() => {
                      const newIsDecodingEnabled = !isDecodingEnabled;
                      setIsDecodingEnabled(newIsDecodingEnabled);
                      socket?.emit("toggleDecoding", newIsDecodingEnabled);
                    }}
                  >
                    {isDecodingEnabled ? "Decodificação ON" : "Decodificação OFF"}
                  </button>

                  {/* Controle de Distorção */}
                  <button
                    style={{
                      background: isDistortionEnabled ? "green" : "red",
                      color: "white",
                      padding: "10px",
                      borderRadius: "5px",
                      cursor: "pointer",
                      marginBottom: "10px",
                      width: "100%",
                    }}
                    onClick={() => {
                      const newIsDistortionEnabled = !isDistortionEnabled;
                      setIsDistortionEnabled(newIsDistortionEnabled);
                      socket?.emit("toggleDistortion", newIsDistortionEnabled);
                    }}
                  >
                    {isDistortionEnabled ? "Distorção ON" : "Distorção OFF"}
                  </button>

                  {/* Slider de Volume */}
                  <div style={{ marginBottom: "10px" }}>
                    <label>Volume:</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={handleVolumeChange}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Área de mensagens */}
          <div
            className={styles.messages}
            ref={messagesContainerRef}
            style={{
              overflowY: "auto",
              overflowX: "hidden",
              maxHeight: "400px",
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${
                  message.stranger ? styles.stranger : styles.client
                } ${message.distortion ? styles.distortion : ""} ${
                  message.stranger ? styles.textShift : ""
                }`}
              >
                <p className="text-glow">{!message.stranger && ">"}</p>
                <p className="text-glow">{message.content}</p>
              </div>
            ))}
            {/* Elemento para forçar o scroll até o final */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input do cliente */}
          <div className={styles.clientInput}>
            <p className="text-glow">{">"}</p>
            <input
              type="text"
              value={clientMessage}
              disabled={isStranger}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              onSubmit={sendMessage}
              className="text-glow"
            />
          </div>

          {/* Input do estrangeiro */}
          {isStranger && (
            <div className={styles.strangerInput}>
              <hr className="glow" />
              <input
                className="glow"
                type="text"
                value={strangerMessage}
                onChange={(e) => setStrangerMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
              />
            </div>
          )}
        </section>
      )}
    </>
  );
};

export default RoomPage;
