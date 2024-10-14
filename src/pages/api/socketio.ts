import { NextApiRequest } from "next";
import { NextApiResponseServerIO } from "../../types/next";
import { Server as ServerIO } from "socket.io";
import { Server as NetServer } from "http";
import { Message } from "../../types/message";

export const config = {
  api: {
    bodyParser: false,  // Desativa o bodyParser para WebSockets
  },
};

const socketio = async (req: NextApiRequest, res: NextApiResponseServerIO) => {
  // Garante que o servidor Socket.IO só seja inicializado uma vez
  if (!res.socket.server.io) {
    console.log("Novo servidor Socket.IO iniciado...");
    const httpServer: NetServer = res.socket.server as any;

    // Configuração do servidor Socket.IO
    const io = new ServerIO(httpServer, {
      path: "/api/socketio",  // Caminho do WebSocket
      transports: ["websocket"],  // Define apenas WebSocket como transporte
    });

    io.on("connection", (socket) => {
      const { room } = socket.handshake.query;  // Captura o room da query
      console.log(`Cliente conectado: ${socket.id} à sala: ${room}`);
      
      socket.join(room as string);  // Cliente se junta à sala especificada

      // Enviar e receber mensagens de clientes
      socket.on("sendMessage", (message: Message) => {
        io.to(room as string).emit("message", message);  // Enviar para todos na sala
      });

      socket.on("clientMessage", (message) => {
        io.to(room as string).emit("clientMessage", message);
      });

      // Eventos de controle
      socket.on("toggleDecoding", (enabled: boolean) => {
        console.log("Recebido toggleDecoding:", enabled);
        io.to(room as string).emit("toggleDecoding", enabled);
      });

      socket.on("toggleDistortion", (enabled: boolean) => {
        io.to(room as string).emit("toggleDistortion", enabled);
      });

      socket.on("adjustVolume", (volume: number) => {
        io.to(room as string).emit("adjustVolume", volume);
      });

      socket.on("toggleSlowTyping", (enabled: boolean) => {
        io.to(room as string).emit("toggleSlowTyping", enabled);
      });

      socket.on("updateFontStyle", (style) => {
        io.to(room as string).emit("updateFontStyle", style);
      });

      // Quando o cliente se desconecta
      socket.on("disconnect", () => {
        socket.leave(room as string);
        console.log(`Cliente desconectado: ${socket.id} da sala: ${room}`);
      });
    });

    // Armazenar o servidor io para evitar múltiplas inicializações
    res.socket.server.io = io;
  }
  res.end();
};

export default socketio;
