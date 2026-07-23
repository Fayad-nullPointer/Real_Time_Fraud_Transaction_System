import { useEffect, useRef, useState, useCallback } from "react";
import { getAdminToken, getToken } from "@/lib/api";

export type WsEvent = {
  event: "TRANSACTION" | "OTP_RESULT";
  transaction_id: string;
  customer_id: number;
  terminal_id: number;
  amount: number;
  fraud_probability: number;
  is_fraud: boolean;
  scenario_name: string | null;
  status: string;
  reason?: string;
  timestamp: string;
};

function getWsBase(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL as string;
  if (typeof window === "undefined") return "ws://backend:8000";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8005`;
}

export function useAdminWs(onEvent?: (ev: WsEvent) => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);

  // Keep ref in sync without re-triggering connect
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    const token = getAdminToken() ?? getToken();
    if (!token) return;

    const ws = new WebSocket(`${getWsBase()}/api/dashboard/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (e) => {
      try {
        const ev: WsEvent = JSON.parse(e.data);
        onEventRef.current?.(ev);
      } catch {
        // Silently ignore malformed messages
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  return connected;
}
