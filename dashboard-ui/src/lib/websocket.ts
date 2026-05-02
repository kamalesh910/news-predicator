import { io, Socket } from "socket.io-client";

/**
 * Connection status for the WebSocket client.
 */
export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

type StatusChangeCallback = (status: ConnectionStatus) => void;

const API_GATEWAY_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:4000";

let socket: Socket | null = null;
let currentStatus: ConnectionStatus = "disconnected";
const statusListeners: Set<StatusChangeCallback> = new Set();

/**
 * Notify all registered listeners of a status change.
 */
function notifyStatusChange(status: ConnectionStatus): void {
  currentStatus = status;
  statusListeners.forEach((callback) => callback(status));
}

/**
 * Returns the singleton Socket.IO client instance, creating it on first call.
 * The socket connects to the API Gateway URL configured via
 * NEXT_PUBLIC_API_GATEWAY_URL (default: http://localhost:4000).
 */
export function getSocket(): Socket {
  if (socket) {
    return socket;
  }

  socket = io(API_GATEWAY_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    autoConnect: true,
  });

  socket.on("connect", () => {
    notifyStatusChange("connected");
  });

  socket.on("disconnect", () => {
    notifyStatusChange("disconnected");
  });

  socket.on("reconnect_attempt", () => {
    notifyStatusChange("reconnecting");
  });

  socket.on("reconnect", () => {
    notifyStatusChange("connected");
  });

  socket.on("reconnect_failed", () => {
    notifyStatusChange("disconnected");
  });

  return socket;
}

/**
 * Returns the current connection status of the WebSocket client.
 */
export function getConnectionStatus(): ConnectionStatus {
  return currentStatus;
}

/**
 * Registers a callback to be invoked whenever the connection status changes.
 * Returns an unsubscribe function that removes the listener when called.
 */
export function onStatusChange(callback: StatusChangeCallback): () => void {
  statusListeners.add(callback);
  return () => {
    statusListeners.delete(callback);
  };
}

/**
 * Disconnects and destroys the singleton socket instance.
 * Primarily useful for testing and cleanup.
 */
export function resetSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentStatus = "disconnected";
  statusListeners.clear();
}
