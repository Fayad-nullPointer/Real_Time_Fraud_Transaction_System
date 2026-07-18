import json
import logging
import queue
import threading
from typing import Dict, List, Optional, Union

from logger import get_logger

logger = get_logger("kafka_simulation")


class MockMessage:
    """
    Mock message mimicking the confluent-kafka Message object interface.
    """
    def __init__(self, topic: str, value: bytes, key: Optional[bytes] = None, error: Optional[Exception] = None):
        self._topic = topic
        self._value = value
        self._key = key
        self._error = error

    def topic(self) -> str:
        return self._topic

    def value(self) -> bytes:
        return self._value

    def key(self) -> Optional[bytes]:
        return self._key

    def error(self) -> Optional[Exception]:
        return self._error


class MockKafkaBroker:
    """
    In-memory thread-safe Mock Kafka Broker singleton.
    Manages queues for multiple topics.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(MockKafkaBroker, cls).__new__(cls)
                cls._instance._topics = {}
                cls._instance._topic_locks = {}
            return cls._instance

    def _get_queue(self, topic: str) -> queue.Queue:
        with self._lock:
            if topic not in self._topics:
                self._topics[topic] = queue.Queue()
                self._topic_locks[topic] = threading.Lock()
            return self._topics[topic]

    def send(self, topic: str, message: MockMessage) -> None:
        q = self._get_queue(topic)
        q.put(message)

    def poll(self, topics: List[str], timeout: float = 1.0) -> Optional[MockMessage]:
        # Simple round-robin poll over subscribed topics
        for topic in topics:
            q = self._get_queue(topic)
            try:
                # Use a small non-blocking wait to prevent locking threads
                return q.get(block=True, timeout=timeout / len(topics))
            except queue.Empty:
                continue
        return None

    def clear(self) -> None:
        """Helper to clear broker topics state between simulation runs."""
        with self._lock:
            self._topics.clear()
            self._topic_locks.clear()


class MockKafkaProducer:
    """
    Mock Kafka Producer that serializes dictionaries into JSON bytes
    and publishes them to the in-memory MockKafkaBroker.
    """
    def __init__(self, configs: Optional[dict] = None):
        self.broker = MockKafkaBroker()
        self.configs = configs or {}
        logger.info("[bold green][OK] Kafka Producer Initialized (In-Memory Fallback Mode)[/bold green]")

    def send(self, topic: str, value: Union[dict, str, bytes], key: Optional[str] = None) -> None:
        """
        Serialize value to bytes and send to topic.
        """
        # Serialize to bytes
        if isinstance(value, dict):
            serialized_val = json.dumps(value).encode("utf-8")
        elif isinstance(value, str):
            serialized_val = value.encode("utf-8")
        elif isinstance(value, bytes):
            serialized_val = value
        else:
            raise TypeError("Value must be dict, str, or bytes")

        serialized_key = key.encode("utf-8") if key else None
        message = MockMessage(topic, serialized_val, key=serialized_key)
        
        self.broker.send(topic, message)

    def flush(self, timeout: float = 0.0) -> None:
        # No-op for in-memory broker since queue operations are immediate
        pass


class MockKafkaConsumer:
    """
    Mock Kafka Consumer that subscribes to topics and pulls raw bytes,
    mimicking confluent-kafka's client API.
    """
    def __init__(self, configs: Optional[dict] = None):
        self.broker = MockKafkaBroker()
        self.configs = configs or {}
        self.subscribed_topics: List[str] = []
        logger.info("[bold green][OK] Kafka Consumer Initialized (In-Memory Fallback Mode)[/bold green]")

    def subscribe(self, topics: List[str]) -> None:
        self.subscribed_topics = list(topics)
        logger.info(f"Consumer subscribed to topics: {self.subscribed_topics}")

    def poll(self, timeout: float = 1.0) -> Optional[MockMessage]:
        if not self.subscribed_topics:
            raise RuntimeError("Consumer is not subscribed to any topics.")
        return self.broker.poll(self.subscribed_topics, timeout)

    def close(self) -> None:
        logger.info("Closing Kafka Consumer...")
        self.subscribed_topics.clear()
