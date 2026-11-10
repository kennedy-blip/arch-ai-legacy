"""
Configuration settings for the Archaeo-Code backend engine.
Manages connection strings, secrets, and operational toggles.
"""

from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """Application runtime configuration."""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # General App Config
    APP_NAME: str = "Archaeo-Code Legacy Archeology Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ]

    # Neo4j Graph Database Configuration
    NEO4J_URI: str = Field(default="bolt://localhost:7687", alias="NEO4J_URI")
    NEO4J_USER: str = Field(default="neo4j", alias="NEO4J_USER")
    NEO4J_PASSWORD: str = Field(default="archaeocode2024", alias="NEO4J_PASSWORD")
    NEO4J_DATABASE: str = Field(default="neo4j", alias="NEO4J_DATABASE")
    NEO4J_MAX_CONNECTION_POOL_SIZE: int = 50
    NEO4J_CONNECTION_TIMEOUT_SECS: float = 5.0

    # Qdrant Vector Database Configuration
    QDRANT_HOST: str = Field(default="localhost", alias="QDRANT_HOST")
    QDRANT_PORT: int = Field(default=6333, alias="QDRANT_PORT")
    QDRANT_COLLECTION: str = Field(default="archaeo_functions", alias="QDRANT_COLLECTION")
    QDRANT_API_KEY: Optional[str] = Field(default=None, alias="QDRANT_API_KEY")

    # Redis Cache Configuration
    REDIS_URL: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    # LLM Settings (OpenAI, Gemini, or Mock Hybrid)
    LLM_PROVIDER: str = Field(default="openai", alias="LLM_PROVIDER") # "openai", "gemini", or "mock"
    OPENAI_API_KEY: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    OPENAI_MODEL: str = Field(default="gpt-4o", alias="OPENAI_MODEL")
    GEMINI_API_KEY: Optional[str] = Field(default=None, alias="GEMINI_API_KEY")

    # Operational Modes
    ENABLE_IN_MEMORY_FALLBACK: bool = True  # Allows offline/dev operation without active Neo4j docker container
    AST_CACHE_TTL_SECONDS: int = 86400      # 24 hours Redis cache for ASTs


settings = Settings()
