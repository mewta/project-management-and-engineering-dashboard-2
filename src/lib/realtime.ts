import type { Server } from "socket.io";

type DevBoardGlobal = typeof globalThis & {
  __devboardIo?: Server;
};

export type ProjectRealtimeEvent =
  | "issue:created"
  | "issue:updated"
  | "issue:commented";

export async function emitProjectEvent(
  projectId: string,
  event: ProjectRealtimeEvent,
  payload: Record<string, unknown>,
) {
  const io = (globalThis as DevBoardGlobal).__devboardIo;

  if (io) {
    io.to(`project:${projectId}`).emit(event, payload);
    return;
  }

  const secret = process.env.REALTIME_SECRET ?? process.env.NEXTAUTH_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  if (!secret) {
    return;
  }

  await fetch(`${baseUrl}/api/realtime/emit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-devboard-realtime-secret": secret,
    },
    body: JSON.stringify({
      projectId,
      event,
      payload,
    }),
  }).catch(() => undefined);
}
