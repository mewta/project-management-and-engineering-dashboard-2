import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocketClient() {
  if (!socket) {
    socket = io({
      autoConnect: true,
    });
  }

  return socket;
}
