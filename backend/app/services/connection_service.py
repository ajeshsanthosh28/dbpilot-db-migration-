"""
Manages live connections to PostgreSQL, MySQL, and ClickHouse.
Encrypts stored passwords with Fernet symmetric encryption.
"""
from typing import Any, Dict, List, Optional
from cryptography.fernet import Fernet
import base64, hashlib

from app.core.config import settings


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)


def encrypt_password(password: str) -> str:
    return _fernet().encrypt(password.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    return _fernet().decrypt(encrypted.encode()).decode()


def build_dsn(db_type: str, host: str, port: int, database: str, username: str, password: str) -> str:
    pw = password.replace("@", "%40")
    if db_type == "postgresql":
        return f"postgresql://{username}:{pw}@{host}:{port}/{database}"
    elif db_type == "mysql":
        return f"mysql+pymysql://{username}:{pw}@{host}:{port}/{database}"
    elif db_type == "clickhouse":
        return f"clickhouse+native://{username}:{pw}@{host}:{port}/{database}"
    raise ValueError(f"Unsupported db_type: {db_type}")


async def test_connection(db_type: str, host: str, port: int, database: str,
                          username: str, password: str) -> Dict[str, Any]:
    """Attempt a connection and return basic server info."""
    try:
        if db_type == "postgresql":
            import asyncpg
            conn = await asyncpg.connect(
                host=host, port=port, database=database, user=username, password=password, timeout=5
            )
            version = await conn.fetchval("SELECT version()")
            await conn.close()
            return {"success": True, "version": version}

        elif db_type == "mysql":
            import aiomysql
            conn = await aiomysql.connect(
                host=host, port=port, db=database, user=username, password=password, connect_timeout=5
            )
            async with conn.cursor() as cur:
                await cur.execute("SELECT VERSION()")
                (version,) = await cur.fetchone()
            conn.close()
            return {"success": True, "version": version}

        elif db_type == "clickhouse":
            from clickhouse_driver import Client
            client = Client(host=host, port=port, database=database, user=username, password=password)
            version = client.execute("SELECT version()")[0][0]
            return {"success": True, "version": version}

    except Exception as e:
        return {"success": False, "error": str(e)}


async def execute_query(db_type: str, host: str, port: int, database: str,
                        username: str, password: str, sql: str,
                        limit: int = 1000) -> Dict[str, Any]:
    """Execute a SQL query and return columns + rows."""
    try:
        if db_type == "postgresql":
            import asyncpg
            conn = await asyncpg.connect(host=host, port=port, database=database,
                                         user=username, password=password, timeout=10)
            records = await conn.fetch(sql)
            await conn.close()
            if not records:
                return {"columns": [], "rows": [], "row_count": 0}
            columns = list(records[0].keys())
            rows = [list(r.values()) for r in records[:limit]]
            return {"columns": columns, "rows": rows, "row_count": len(rows)}

        elif db_type == "mysql":
            import aiomysql
            conn = await aiomysql.connect(host=host, port=port, db=database,
                                          user=username, password=password)
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(sql)
                rows_raw = await cur.fetchmany(limit)
            conn.close()
            if not rows_raw:
                return {"columns": [], "rows": [], "row_count": 0}
            columns = list(rows_raw[0].keys())
            rows = [list(r.values()) for r in rows_raw]
            return {"columns": columns, "rows": rows, "row_count": len(rows)}

        elif db_type == "clickhouse":
            from clickhouse_driver import Client
            client = Client(host=host, port=port, database=database,
                            user=username, password=password)
            result, columns_info = client.execute(sql, with_column_types=True)
            columns = [c[0] for c in columns_info]
            rows = [list(r) for r in result[:limit]]
            return {"columns": columns, "rows": rows, "row_count": len(rows)}

    except Exception as e:
        return {"error": str(e), "columns": [], "rows": [], "row_count": 0}


async def get_schema(db_type: str, host: str, port: int, database: str,
                     username: str, password: str) -> List[Dict]:
    """Return list of tables with column info."""
    try:
        if db_type == "postgresql":
            import asyncpg
            conn = await asyncpg.connect(host=host, port=port, database=database,
                                         user=username, password=password)
            tables = await conn.fetch("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' ORDER BY table_name
            """)
            result = []
            for t in tables:
                cols = await conn.fetch("""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_name = $1 ORDER BY ordinal_position
                """, t["table_name"])
                result.append({
                    "table": t["table_name"],
                    "columns": [dict(c) for c in cols]
                })
            await conn.close()
            return result

        elif db_type == "mysql":
            import aiomysql
            conn = await aiomysql.connect(host=host, port=port, db=database,
                                          user=username, password=password)
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SHOW TABLES")
                tables = [list(r.values())[0] for r in await cur.fetchall()]
                result = []
                for t in tables:
                    await cur.execute(f"DESCRIBE `{t}`")
                    cols = await cur.fetchall()
                    result.append({"table": t, "columns": cols})
            conn.close()
            return result

        elif db_type == "clickhouse":
            from clickhouse_driver import Client
            client = Client(host=host, port=port, database=database,
                            user=username, password=password)
            tables = client.execute("SHOW TABLES")
            result = []
            for (t,) in tables:
                cols = client.execute(f"DESCRIBE TABLE `{t}`")
                result.append({"table": t, "columns": [
                    {"column_name": c[0], "data_type": c[1]} for c in cols
                ]})
            return result

    except Exception as e:
        return [{"error": str(e)}]
