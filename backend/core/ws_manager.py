"""
core/ws_manager.py
==================
Shared WebSocket connection manager.
The dashboard router subscribes clients here; the transaction router
broadcasts events here whenever a transaction is processed.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._clients = [c for c in self._clients if c is not ws]

    async def broadcast(self, data: Any) -> None:
        """Broadcast a dict as JSON to all connected WebSocket clients."""
        payload = json.dumps(data)
        dead: list[WebSocket] = []
        for ws in self._clients:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def client_count(self) -> int:
        return len(self._clients)


# Singleton shared across routers
ws_manager = ConnectionManager()
