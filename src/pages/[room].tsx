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
  fontStyle?: {
    fontFamily: string;
    color: string;
    fontSize: string;
  };
}

const RoomPage: NextPage = () => {
  const router = useRouter();
  const { room, stranger } = router.query;
  const isStranger = !!stranger;

  const [socket, setSocket] = useState<Socket | undefined>();
  const [messages, setMessages] = useState<CompartmentMessage[]>([]);
  const [clientMessage, setClientMessage] = useState<string>("");
  const [strangerMessage, setStrangerMessage] = useState<string>("");

  const [isDecodingEnabled, setIsDecodingEnabled] = useState<boolean>(false);
  const [isDistortionEnabled, setIsDistortionEnabled] = useState<boolean>(false);
  const [isSlowTypingEnabled, setIsSlowTypingEnabled] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);

  // Estados para preferências de estilo do estrangeiro
  const defaultFontFamily = "Estrangeiro";
  const defaultFontColor = "var(--primary-color)"; // Verde meio catarrento
  const defaultFontSize = "42px"; // Tamanho padrão maior

  const [fontFamily, setFontFamily] = useState<string>(defaultFontFamily);
  const [fontColor, setFontColor] = useState<string>(defaultFontColor);
  const [fontSize, setFontSize] = useState<string>(defaultFontSize);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState<boolean>(true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const strangerInputRef = useRef<HTMLInputElement>(null);

  const decodingEnabledRef = useRef(isDecodingEnabled);
  useEffect(() => {
    decodingEnabledRef.current = isDecodingEnabled;
  }, [isDecodingEnabled]);

  const distortionEnabledRef = useRef(isDistortionEnabled);
  useEffect(() => {
    distortionEnabledRef.current = isDistortionEnabled;
  }, [isDistortionEnabled]);

  const slowTypingEnabledRef = useRef(isSlowTypingEnabled);
  useEffect(() => {
    slowTypingEnabledRef.current = isSlowTypingEnabled;
  }, [isSlowTypingEnabled]);

  // Referências para estilo do estrangeiro
  const fontFamilyRef = useRef(fontFamily);
  useEffect(() => {
    fontFamilyRef.current = fontFamily;
  }, [fontFamily]);

  const fontColorRef = useRef(fontColor);
  useEffect(() => {
    fontColorRef.current = fontColor;
  }, [fontColor]);

  const fontSizeRef = useRef(fontSize);
  useEffect(() => {
    fontSizeRef.current = fontSize;
  }, [fontSize]);

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

    io.on("connect_error", (err) => {
      console.error("Connection error:", err);
    });

    io.emit("testConnection", "Mensagem de teste do cliente");

    io.on("message", (message: CompartmentMessage) => {
      if (message.sender === "stranger") {
        if (slowTypingEnabledRef.current) {
          // Adiciona a mensagem com conteúdo vazio
          setMessages((oldMessages) => [
            ...oldMessages,
            { ...message, content: "", fontStyle: message.fontStyle },
          ]);
          typeMessage(message.id, message.content);
        } else if (decodingEnabledRef.current) {
          // Adiciona a mensagem com conteúdo vazio
          setMessages((oldMessages) => [
            ...oldMessages,
            { ...message, content: "", fontStyle: message.fontStyle },
          ]);
          decodeMessage(message.id, message.content);
        } else {
          setMessages((oldMessages) => [...oldMessages, message]);
        }
      } else {
        setMessages((oldMessages) => [...oldMessages, message]);
      }
    });

    io.on("clientMessage", (message: string) => {
      if (!isStranger) return;
      setClientMessage(message);
    });

    io.on("toggleDecoding", (enabled: boolean) => {
      setIsDecodingEnabled(enabled);
    });

    io.on("toggleDistortion", (enabled: boolean) => {
      setIsDistortionEnabled(enabled);
    });

    io.on("toggleSlowTyping", (enabled: boolean) => {
      setIsSlowTypingEnabled(enabled);
    });

    // Listeners para atualizar as preferências de estilo
    io.on(
      "updateFontStyle",
      (style: { fontFamily: string; color: string; fontSize: string }) => {
        setFontFamily(style.fontFamily);
        setFontColor(style.color);
        setFontSize(style.fontSize);
      }
    );

    io.on("adjustVolume", (newVolume: number) => {
      setVolume(newVolume);
    });

    return () => {
      io.disconnect();
    };
  }, [room, router, isStranger]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    socket?.emit("adjustVolume", newVolume);
  };

  const decodeMessage = (messageId: string, finalMessage: string) => {
    const maxIterations = 150;
    let currentMessage = " ".repeat(finalMessage.length);
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
    }, 50);
  };

  const typeMessage = (messageId: string, finalMessage: string) => {
    let currentText = "";
    let index = 0;
    let cursorVisible = true;

    const typingInterval = setInterval(() => {
      if (index < finalMessage.length) {
        currentText += finalMessage[index];
        index++;
      } else {
        clearInterval(typingInterval);
        // Remove o cursor quando a digitação termina
        setMessages((oldMessages) =>
          oldMessages.map((msg) =>
            msg.id === messageId
              ? { ...msg, content: currentText, cursorVisible: false }
              : msg
          )
        );
        return;
      }

      // Alterna a visibilidade do cursor
      cursorVisible = !cursorVisible;
      const displayText = currentText + (cursorVisible ? "_" : " ");

      setMessages((oldMessages) =>
        oldMessages.map((msg) =>
          msg.id === messageId ? { ...msg, content: displayText } : msg
        )
      );
    }, 50); // Ajuste a velocidade de digitação conforme desejado
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
      messagesContainerRef.current?.removeEventListener(
        "scroll",
        checkIfUserIsAtBottom
      );
    };
  }, []);

  const sendMessage = () => {
    if (isStranger ? !strangerMessage : !clientMessage) return;

    const messageId = uuidv4();
    const content = isStranger ? strangerMessage : clientMessage;
    const newMessage: CompartmentMessage = {
      id: messageId,
      message: content,
      content: content,
      room: room as string,
      stranger: isStranger,
      sender: isStranger ? "stranger" : "client",
      distortion: isDistortionEnabled,
      fontStyle: isStranger
        ? {
            fontFamily: fontFamilyRef.current,
            color: fontColorRef.current,
            fontSize: fontSizeRef.current,
          }
        : undefined,
    };

    socket?.emit("sendMessage", newMessage);
    setUserMessage("");
  };

  const setUserMessage = (newMessage: string) => {
    if (isStranger) {
      setStrangerMessage(newMessage);
    } else {
      socket?.emit("clientMessage", newMessage);
      setClientMessage(newMessage);
    }
  };

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  // Auto-focar o input quando o componente é montado
  useEffect(() => {
    if (isStranger && strangerInputRef.current) {
      strangerInputRef.current.focus();
    } else if (!isStranger && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isStranger]);

  // Manter o foco no input mesmo após perder o foco
  const handleInputBlur = () => {
    if (isStranger && strangerInputRef.current) {
      strangerInputRef.current.focus();
    } else if (!isStranger && inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Funções para atualizar as preferências de estilo e emitir eventos
  const updateFontFamily = (newFont: string) => {
    setFontFamily(newFont);
    socket?.emit("updateFontStyle", {
      fontFamily: newFont,
      color: fontColor,
      fontSize: fontSize,
    });
  };

  const updateFontColor = (newColor: string) => {
    setFontColor(newColor);
    socket?.emit("updateFontStyle", {
      fontFamily: fontFamily,
      color: newColor,
      fontSize: fontSize,
    });
  };

  const updateFontSize = (newSize: string) => {
    setFontSize(newSize);
    socket?.emit("updateFontStyle", {
      fontFamily: fontFamily,
      color: fontColor,
      fontSize: newSize,
    });
  };

  // Função para resetar as preferências de estilo
  const resetFontStyle = () => {
    setFontFamily(defaultFontFamily);
    setFontColor(defaultFontColor);
    setFontSize(defaultFontSize);
    socket?.emit("updateFontStyle", {
      fontFamily: defaultFontFamily,
      color: defaultFontColor,
      fontSize: defaultFontSize,
    });
  };

  // Opções de fontes disponíveis (adicionando mais fontes do pacote)
  const availableFonts = ["Estrangeiro", "Clacon", "NovaFonte1", "NovaFonte2"]; // Substitua por fontes reais disponíveis

  return (
    <>
      <Head>
        <title>Sala</title>
      </Head>

      <audio autoPlay loop ref={audioRef} style={{ display: "none" }}>
        <source src="/audio/Furnace.mp3" type="audio/mp3" />
      </audio>

      {!socket ? (
        <div className={styles.connecting}>
          <p className="text-glow">Conectando</p>
        </div>
      ) : (
        <section className={styles.program}>
          {isStranger && (
            <>
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
                    width: "250px",
                  }}
                >
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
                    {isDecodingEnabled
                      ? "Decodificação ON"
                      : "Decodificação OFF"}
                  </button>

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
                      socket?.emit(
                        "toggleDistortion",
                        newIsDistortionEnabled
                      );
                    }}
                  >
                    {isDistortionEnabled ? "Distorção ON" : "Distorção OFF"}
                  </button>

                  <button
                    style={{
                      background: isSlowTypingEnabled ? "green" : "red",
                      color: "white",
                      padding: "10px",
                      borderRadius: "5px",
                      cursor: "pointer",
                      marginBottom: "10px",
                      width: "100%",
                    }}
                    onClick={() => {
                      const newIsSlowTypingEnabled = !isSlowTypingEnabled;
                      setIsSlowTypingEnabled(newIsSlowTypingEnabled);
                      socket?.emit(
                        "toggleSlowTyping",
                        newIsSlowTypingEnabled
                      );
                    }}
                  >
                    {isSlowTypingEnabled
                      ? "Digitação Lenta ON"
                      : "Digitação Lenta OFF"}
                  </button>

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

                  {/* Preferências de Estilo */}
                  <div style={{ marginBottom: "10px" }}>
                    <label>Fonte:</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => updateFontFamily(e.target.value)}
                      style={{ width: "100%" }}
                    >
                      {availableFonts.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: "10px" }}>
                    <label>Cor do Texto:</label>
                    <input
                      type="color"
                      value={fontColor}
                      onChange={(e) => updateFontColor(e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div style={{ marginBottom: "10px" }}>
                    <label>Tamanho da Fonte:</label>
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={parseInt(fontSize)}
                      onChange={(e) =>
                        updateFontSize(`${e.target.value}px`)
                      }
                      style={{ width: "100%" }}
                    />
                  </div>

                  <button
                    style={{
                      background: "gray",
                      color: "white",
                      padding: "10px",
                      borderRadius: "5px",
                      cursor: "pointer",
                      marginTop: "10px",
                      width: "100%",
                    }}
                    onClick={resetFontStyle}
                  >
                    Resetar para Padrão
                  </button>
                </div>
              )}
            </>
          )}

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
                style={
                  message.stranger && message.fontStyle
                    ? {
                        fontFamily: message.fontStyle.fontFamily,
                        color: message.fontStyle.color,
                        fontSize: message.fontStyle.fontSize,
                        wordSpacing: "2rem",
                      }
                    : {
                        fontFamily: "Clacon",
                        color: "var(--primary-color)",
                        fontSize: "32px",
                      }
                }
              >
                <p className="text-glow">{!message.stranger && ">"}</p>
                <p className="text-glow">{message.content}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {!isStranger ? (
            <div className={styles.clientInput}>
              <p className="text-glow">{">"}</p>
              <input
                  type="text"
                  spellCheck="false"
                value={clientMessage}
                disabled={isStranger}
                onChange={(e) => setUserMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                className="text-glow"
                autoFocus={!isStranger}
                ref={inputRef}
                onBlur={handleInputBlur}
                style={{
                  fontFamily: "Clacon",
                  fontSize: "32px",
                  color: "var(--primary-color)",
                }}
              />
            </div>
          ) : (
            <div className={styles.strangerInput}>
              <hr className="glow" />
              <input
                className="glow"
                    type="text"
                    spellCheck="false"
                value={strangerMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                autoFocus={isStranger}
                ref={strangerInputRef}
                onBlur={handleInputBlur}
                style={{
                  fontFamily: "Clacon",
                  fontSize: "32px",
                  color: "var(--primary-color)",
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
