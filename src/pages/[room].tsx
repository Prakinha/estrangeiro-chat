import { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import SocketIOClient from "socket.io-client";
import { Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid"; // Para criar IDs únicos

import styles from "../styles/Room.module.scss";
import { Message } from "../types/message";

interface CompartmentMessage extends Message {
  id: string; // Identificador único para cada mensagem
  content: string; // Conteúdo da mensagem
  sender: string; // Indica quem enviou (cliente ou estrangeiro)
  distortion?: boolean; // Novo campo para indicar se a mensagem tem distorção
}

const RoomPage: NextPage = () => {
  const router = useRouter();

  const { room, stranger } = router.query;
  const isStranger = !!stranger;

  const [socket, setSocket] = useState<Socket | undefined>();
  const [messages, setMessages] = useState<CompartmentMessage[]>([]);
  const [clientMessage, setClientMessage] = useState<string>("");
  const [strangerMessage, setStrangerMessage] = useState<string>("");
  const [isDecodingEnabled, setIsDecodingEnabled] = useState<boolean>(true); // Estado para ligar/desligar a decodificação
  const [isDistortionEnabled, setIsDistortionEnabled] =
    useState<boolean>(false); // Estado para distorção

  // Criar uma ref para o container das mensagens
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState<boolean>(true);

  useEffect((): any => {
    if (!room || !router) return;

    const io = SocketIOClient(process.env.API_BASE_URL as string, {
      path: "/api/socketio",
      extraHeaders: {
        room: room as string,
      },
    });

    io.on("connect", () => {
      setSocket(io);
    });

    io.on("message", (message: CompartmentMessage) => {
      // Se a mensagem for do estrangeiro e a decodificação estiver ativada
      if (message.stranger && isDecodingEnabled) {
        setMessages((oldMessages) => [...oldMessages, message]);
        decodeMessage(message.id, message.content); // Passar o ID da mensagem para ser editada
      } else {
        setMessages((oldMessages) => [...oldMessages, message]);
      }
    });

    io.on("clientMessage", (message: string) => {
      if (!isStranger) return;
      setClientMessage(message);
    });

    if (io) return () => io.disconnect();
  }, [room, router, isStranger, isDecodingEnabled]);

  // Função para simular o efeito de pseudo-decodificação
  const decodeMessage = (messageId: string, finalMessage: string) => {
    const maxIterations = 100; // Quantidade de iterações para completar a decodificação
    let currentMessage = new Array(finalMessage.length).fill(" ").join(""); // Começa com espaços
    let iterations = 0;
    const randomChars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";

    const intervalId = setInterval(() => {
      iterations++;
      let decoded = "";

      for (let i = 0; i < finalMessage.length; i++) {
        if (currentMessage[i] !== finalMessage[i]) {
          if (iterations < maxIterations / 3) {
            // Primeira fase: caracteres completamente aleatórios
            decoded += randomChars.charAt(
              Math.floor(Math.random() * randomChars.length)
            );
          } else if (iterations < (2 * maxIterations) / 3) {
            // Segunda fase: restringir para letras e números
            decoded +=
              Math.random() > 0.5
                ? randomChars.charAt(Math.floor(Math.random() * 36)) // A-Z, a-z, 0-9
                : finalMessage[i]; // Algumas letras corretas
          } else {
            // Terceira fase: afunilamento para a letra correta
            decoded +=
              Math.random() > 0.2
                ? finalMessage[i]
                : randomChars.charAt(
                    Math.floor(Math.random() * randomChars.length)
                  );
          }
        } else {
          decoded += finalMessage[i]; // Letra já decodificada
        }
      }

      currentMessage = decoded;

      // Atualizar a mensagem no estado para decodificar progressivamente
      setMessages((oldMessages) =>
        oldMessages.map((msg) =>
          msg.id === messageId ? { ...msg, content: decoded } : msg
        )
      );

      // Verifica se todas as letras foram decodificadas
      if (decoded === finalMessage) {
        clearInterval(intervalId); // Parar o efeito quando a mensagem estiver completamente decodificada
      }
    }, 100); // Tempo de intervalo entre as iterações
  };

  // Verificar se o usuário está no final do chat
  const checkIfUserIsAtBottom = () => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;

    setIsUserAtBottom(scrollTop + clientHeight >= scrollHeight - 10); // 10px de margem
  };

  // Efeito para rolar automaticamente para a última mensagem
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

  // Função para enviar a mensagem com ou sem distorção
  const sendMessage = async () => {
    if (isStranger ? !strangerMessage : !clientMessage) return;

    const messageId = uuidv4(); // Criar um ID único para a mensagem
    const newMessage: CompartmentMessage = {
      id: messageId,
      message: isStranger ? strangerMessage : clientMessage, // Atribua o mesmo valor de content a message
      content: isStranger ? strangerMessage : clientMessage, // Você pode manter 'content' conforme necessário
      room: room as string,
      stranger: isStranger,
      sender: isStranger ? "stranger" : "client",
      distortion: isDistortionEnabled,
    };

    // Emitir a mensagem para o servidor
    socket?.emit("sendMessage", newMessage);

    // Limpar o campo de mensagem após o envio
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

  return (
    <>
      <Head>
        <title>Sala</title>
      </Head>
      {!socket ? (
        <div className={styles.connecting}>
          <p className="text-glow">Conectando</p>
        </div>
      ) : (
        <section className={styles.program}>
          {/* Botão visível apenas para o estrangeiro para ligar/desligar a decodificação */}
          {isStranger && (
            <>
              <button
                style={{
                  position: "fixed",
                  top: "10px",
                  right: "10px",
                  background: isDecodingEnabled ? "green" : "red",
                  color: "white",
                  padding: "10px",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
                onClick={() => setIsDecodingEnabled(!isDecodingEnabled)}
              >
                {isDecodingEnabled
                  ? "Desligar Decodificação"
                  : "Ligar Decodificação"}
              </button>

              <button
                style={{
                  position: "fixed",
                  top: "60px", // Um pouco abaixo do botão de decodificação
                  right: "10px",
                  background: isDistortionEnabled ? "green" : "red",
                  color: "white",
                  padding: "10px",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
                onClick={() => setIsDistortionEnabled(!isDistortionEnabled)}
              >
                {isDistortionEnabled ? "Desligar Distorção" : "Ligar Distorção"}
              </button>
            </>
          )}

          <div
            className={styles.messages}
            ref={messagesContainerRef} // Referência para o container de mensagens
            style={{
              overflowY: "auto", // Habilita o scroll vertical
              overflowX: "hidden", // Remove o scroll horizontal
              maxHeight: "400px", // Define a altura máxima do contêiner
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${
                  message.stranger ? styles.stranger : styles.client
                } ${message.distortion ? styles.distortion : ""}`}
              >
                <p className="text-glow">{!message.stranger && ">"}</p>
                <p className="text-glow">{message.content}</p>
              </div>
            ))}
            {/* Elemento para forçar o scroll até o final */}
            <div ref={messagesEndRef} />
          </div>
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
