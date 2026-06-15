import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXTAUTH_URL ?? `http://${hostname}:${port}`,
    methods: ["GET", "POST"],
  },
});

globalThis.__devboardIo = io;

async function handleRealtimeEmit(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const expectedSecret = process.env.REALTIME_SECRET ?? process.env.NEXTAUTH_SECRET;
  const receivedSecret = request.headers["x-devboard-realtime-secret"];

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!body.projectId || !body.event) {
    response.writeHead(422, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "projectId and event are required" }));
    return;
  }

  io.to(`project:${body.projectId}`).emit(body.event, body.payload ?? {});
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true }));
}

io.on("connection", (socket) => {
  socket.on("project:join", (projectId) => {
    if (typeof projectId === "string" && projectId.length > 0) {
      socket.join(`project:${projectId}`);
    }
  });

  socket.on("project:leave", (projectId) => {
    if (typeof projectId === "string" && projectId.length > 0) {
      socket.leave(`project:${projectId}`);
    }
  });
});

httpServer.on("request", (request, response) => {
  if (request.url?.startsWith("/socket.io")) {
    return;
  }

  if (request.url?.startsWith("/api/realtime/emit")) {
    void handleRealtimeEmit(request, response).catch((error) => {
      console.error(error);
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Internal server error" }));
    });
    return;
  }

  handle(request, response);
});

httpServer.listen(port, () => {
  console.log(`DevBoard ready on http://${hostname}:${port}`);
});
