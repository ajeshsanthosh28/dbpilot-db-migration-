"""
Collects DB-level metrics (active connections, slow queries, DB size)
and system-level metrics (CPU, memory) for the monitoring dashboard.
"""
import psutil
from typing import Dict, Any


def get_system_metrics() -> Dict[str, Any]:
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "cpu_percent": round(cpu, 1),
        "memory_total_gb": round(mem.total / 1e9, 2),
        "memory_used_gb": round(mem.used / 1e9, 2),
        "memory_percent": round(mem.percent, 1),
        "disk_total_gb": round(disk.total / 1e9, 2),
        "disk_used_gb": round(disk.used / 1e9, 2),
        "disk_percent": round(disk.percent, 1),
    }


async def get_pg_metrics(host: str, port: int, database: str, username: str, password: str) -> Dict:
    import asyncpg
    try:
        conn = await asyncpg.connect(host=host, port=port, database=database,
                                     user=username, password=password, timeout=5)
        active = await conn.fetchval(
            "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'"
        )
        idle = await conn.fetchval(
            "SELECT count(*) FROM pg_stat_activity WHERE state = 'idle'"
        )
        db_size = await conn.fetchval(
            "SELECT pg_size_pretty(pg_database_size($1))", database
        )
        slow_queries = await conn.fetch("""
            SELECT query, calls, mean_exec_time::numeric(10,2) as avg_ms
            FROM pg_stat_statements
            ORDER BY mean_exec_time DESC LIMIT 5
        """) if await conn.fetchval(
            "SELECT count(*) FROM pg_extension WHERE extname='pg_stat_statements'"
        ) else []
        await conn.close()
        return {
            "active_connections": active,
            "idle_connections": idle,
            "db_size": db_size,
            "slow_queries": [dict(r) for r in slow_queries],
            "error": None,
        }
    except Exception as e:
        return {"error": str(e)}


async def get_mysql_metrics(host: str, port: int, database: str, username: str, password: str) -> Dict:
    import aiomysql
    try:
        conn = await aiomysql.connect(host=host, port=port, db=database,
                                      user=username, password=password)
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("SHOW STATUS LIKE 'Threads_connected'")
            threads = await cur.fetchone()
            await cur.execute(
                "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb "
                "FROM information_schema.tables WHERE table_schema = %s", (database,)
            )
            size = await cur.fetchone()
            await cur.execute("SHOW PROCESSLIST")
            processes = await cur.fetchall()
        conn.close()
        return {
            "active_connections": int(threads["Value"]) if threads else 0,
            "db_size": f"{size['size_mb']} MB" if size else "N/A",
            "processes": processes[:10],
            "error": None,
        }
    except Exception as e:
        return {"error": str(e)}


async def get_clickhouse_metrics(host: str, port: int, database: str, username: str, password: str) -> Dict:
    try:
        from clickhouse_driver import Client
        client = Client(host=host, port=port, database=database, user=username, password=password)
        queries = client.execute(
            "SELECT query, elapsed, read_rows FROM system.processes LIMIT 10"
        )
        size = client.execute(
            f"SELECT formatReadableSize(sum(bytes)) FROM system.parts WHERE database='{database}'"
        )
        return {
            "active_queries": len(queries),
            "db_size": size[0][0] if size else "N/A",
            "running_queries": [{"query": q[0][:100], "elapsed": q[1], "rows": q[2]} for q in queries],
            "error": None,
        }
    except Exception as e:
        return {"error": str(e)}
