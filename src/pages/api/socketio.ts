import { NextApiRequest } from "next";
import { NextApiResponseServerIO } from "../../types/next";
import { Server as ServerIO } from "socket.io";
import { Server as NetServer } from "http";
import { Message } from "../../types/message";

export const config = {
  api: {
    bodyParser: false,
  },
};

const socketio = async (req: NextApiRequest, res: NextApiResponseServerIO) => {
  if (!res.socket.server.io) {
    console.log("New Socket.io server...");
    const httpServer: NetServer = res.socket.server as any;
    const io = new ServerIO(httpServer, {
      path: "/api/socketio",
    });

    io.on("connection", (socket) => {
      const { room } = socket.handshake.query;
      console.log("Novo cliente conectado:", socket.id);
      console.log(`Client ${socket.id} connected to room \"${room}\"`);
      socket.join(room as string);

      socket.on("sendMessage", (message: Message) => {
        io.to(room as string).emit("message", message);
      });

      socket.on("clientMessage", (message) => {
        io.to(room as string).emit("clientMessage", message);
      });

      // Eventos de controle
      socket.on("toggleDecoding", (enabled: boolean) => {
         console.log("Recebido toggleDecoding no servidor:", enabled); // Adicione este log
        io.to(room as string).emit("toggleDecoding", enabled);
      });

      socket.on("toggleDistortion", (enabled: boolean) => {
        io.to(room as string).emit("toggleDistortion", enabled);
      });

      socket.on("adjustVolume", (volume: number) => {
        io.to(room as string).emit("adjustVolume", volume);
      });

      socket.on("disconnect", () => {
        socket.leave(room as string);
        console.log(`Client ${socket.id} disconnected from room \"${room}\"`);
      });
    });

    res.socket.server.io = io;
  }
  res.end();
};

export default socketio;
