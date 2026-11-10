"""
Async Neo4j Client wrapper with connection pooling, schema initialization,
and robust fallback in-memory graph repository for development and offline testing.
"""

import logging
from typing import Any, Dict, List, Optional
import networkx as nx

try:
    from neo4j import AsyncGraphDatabase, AsyncDriver
    NEO4J_AVAILABLE = True
except ImportError:
    AsyncGraphDatabase = None
    AsyncDriver = None
    NEO4J_AVAILABLE = False

from app.core.config import settings

logger = logging.getLogger("archaeo.neo4j")


class InMemoryGraphStore:
    """
    High-fidelity in-memory graph store backed by NetworkX and dictionary indexes.
    Enables instant development, offline exploration, and testing without requiring
    an active Neo4j daemon.
    """

    def __init__(self):
        self.graph = nx.MultiDiGraph()
        self.nodes_by_id: Dict[str, Dict[str, Any]] = {}
        self.nodes_by_label: Dict[str, List[Dict[str, Any]]] = {
            "Function": [],
            "Class": [],
            "Module": [],
            "DatabaseTable": [],
            "DatabaseQuery": [],
            "Commit": [],
            "Author": []
        }
        self.edges: List[Dict[str, Any]] = []

    def clear(self):
        self.graph.clear()
        self.nodes_by_id.clear()
        for k in self.nodes_by_label:
            self.nodes_by_label[k] = []
        self.edges.clear()

    def merge_node(self, label: str, node_id: str, properties: Dict[str, Any]) -> Dict[str, Any]:
        props = dict(properties)
        props["id"] = node_id
        props["label"] = label
        self.nodes_by_id[node_id] = props
        self.graph.add_node(node_id, **props)
        if label not in self.nodes_by_label:
            self.nodes_by_label[label] = []
        # Update or append
        existing = [n for n in self.nodes_by_label[label] if n.get("id") == node_id]
        if not existing:
            self.nodes_by_label[label].append(props)
        else:
            existing[0].update(props)
        return props

    def merge_edge(self, source_id: str, target_id: str, rel_type: str, properties: Optional[Dict[str, Any]] = None):
        props = properties or {}
        props["type"] = rel_type
        props["source"] = source_id
        props["target"] = target_id
        self.graph.add_edge(source_id, target_id, key=f"{source_id}->{target_id}:{rel_type}", **props)
        self.edges.append(props)

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        return self.nodes_by_id.get(node_id)

    def get_call_chain(self, seed_id: str, max_depth: int = 4) -> Dict[str, Any]:
        """Traverse downstream calls and database mutations up to max_depth."""
        if seed_id not in self.graph:
            return {"nodes": [], "edges": []}

        visited_nodes = set([seed_id])
        subgraph_edges = []
        current_layer = [seed_id]

        for depth in range(max_depth):
            next_layer = []
            for u in current_layer:
                # Downstream calls and database mutations
                for _, v, edge_data in self.graph.out_edges(u, data=True):
                    subgraph_edges.append(edge_data)
                    if v not in visited_nodes:
                        visited_nodes.add(v)
                        next_layer.append(v)
            current_layer = next_layer
            if not current_layer:
                break

        # Also grab upstream callers (1-2 hops)
        upstream_layer = [seed_id]
        for depth in range(2):
            next_upstream = []
            for v in upstream_layer:
                for u, _, edge_data in self.graph.in_edges(v, data=True):
                    subgraph_edges.append(edge_data)
                    if u not in visited_nodes:
                        visited_nodes.add(u)
                        next_upstream.append(u)
            upstream_layer = next_upstream
            if not upstream_layer:
                break

        nodes_list = [self.nodes_by_id[nid] for nid in visited_nodes if nid in self.nodes_by_id]
        # Remove duplicate edges
        seen_edges = set()
        deduped_edges = []
        for e in subgraph_edges:
            key = (e.get("source"), e.get("target"), e.get("type"))
            if key not in seen_edges:
                seen_edges.add(key)
                deduped_edges.append(e)

        return {"nodes": nodes_list, "edges": deduped_edges}

    def get_stats(self) -> Dict[str, int]:
        return {
            "functions": len(self.nodes_by_label.get("Function", [])),
            "classes": len(self.nodes_by_label.get("Class", [])),
            "modules": len(self.nodes_by_label.get("Module", [])),
            "tables": len(self.nodes_by_label.get("DatabaseTable", [])),
            "queries": len(self.nodes_by_label.get("DatabaseQuery", [])),
            "commits": len(self.nodes_by_label.get("Commit", [])),
            "relationships": len(self.edges)
        }


class Neo4jClient:
    """Async Neo4j Client with connection lifecycle and fallbacks."""

    def __init__(self):
        self.driver: Optional[Any] = None
        self.connected: bool = False
        self.in_memory_store = InMemoryGraphStore()

    async def connect(self):
        """Initialize driver and verify connectivity."""
        if not NEO4J_AVAILABLE:
            logger.warning("neo4j driver library not installed. Defaulting to InMemoryGraphStore.")
            self.connected = False
            return

        try:
            self.driver = AsyncGraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
                max_connection_pool_size=settings.NEO4J_MAX_CONNECTION_POOL_SIZE,
                connection_timeout=settings.NEO4J_CONNECTION_TIMEOUT_SECS
            )
            await self.driver.verify_connectivity()
            self.connected = True
            logger.info(f"Connected to Neo4j instance at {settings.NEO4J_URI}")
            await self.initialize_schema()
        except Exception as exc:
            logger.warning(
                f"Could not connect to Neo4j at {settings.NEO4J_URI} ({exc}). "
                "Operating in high-fidelity In-Memory Graph fallback mode."
            )
            self.connected = False

    async def initialize_schema(self):
        """Create uniqueness constraints and indexes for high-throughput AST ingestion."""
        if not self.connected or not self.driver:
            return

        constraints = [
            "CREATE CONSTRAINT IF NOT EXISTS FOR (f:Function) REQUIRE f.id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (c:Class) REQUIRE c.id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (m:Module) REQUIRE m.id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (t:DatabaseTable) REQUIRE t.name IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (cm:Commit) REQUIRE cm.hash IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (a:Author) REQUIRE a.email IS UNIQUE",
            "CREATE INDEX IF NOT EXISTS FOR (f:Function) ON (f.name)",
            "CREATE INDEX IF NOT EXISTS FOR (f:Function) ON (f.file_path)"
        ]

        async with self.driver.session(database=settings.NEO4J_DATABASE) as session:
            for statement in constraints:
                try:
                    await session.run(statement)
                except Exception as e:
                    logger.debug(f"Schema statement '{statement}' evaluated: {e}")

    async def close(self):
        """Close driver connection pool."""
        if self.driver:
            await self.driver.close()
            self.connected = False
            logger.info("Neo4j driver pool closed.")

    async def execute_query(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Run a parameterized read Cypher query and return dictionaries."""
        if not self.connected or not self.driver:
            return []

        async with self.driver.session(database=settings.NEO4J_DATABASE) as session:
            result = await session.run(query, parameters or {})
            records = await result.data()
            return records

    async def execute_write(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> Any:
        """Run a parameterized write Cypher query."""
        if not self.connected or not self.driver:
            return None

        async with self.driver.session(database=settings.NEO4J_DATABASE) as session:
            result = await session.run(query, parameters or {})
            return await result.consume()


# Global Singleton Client
neo4j_client = Neo4jClient()
