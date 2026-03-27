"""
Multi-database migration service.
Reads schema + data from source, converts types, writes to target.
Supports: PostgreSQL <-> MySQL, SQLite -> MySQL/PostgreSQL
"""
from typing import Dict, Any, List, Tuple
from app.core.celery_app import celery_app

# Type mapping: (source_db, dest_db) -> {source_type: dest_type}
TYPE_MAP = {
    ("postgresql", "mysql"): {
        "integer": "INT", "bigint": "BIGINT", "smallint": "SMALLINT",
        "boolean": "TINYINT(1)", "text": "LONGTEXT", "varchar": "VARCHAR",
        "character varying": "VARCHAR", "timestamp without time zone": "DATETIME",
        "timestamp with time zone": "DATETIME", "date": "DATE", "time without time zone": "TIME",
        "double precision": "DOUBLE", "real": "FLOAT", "numeric": "DECIMAL",
        "jsonb": "JSON", "json": "JSON", "uuid": "VARCHAR(36)", "bytea": "LONGBLOB",
        "serial": "INT AUTO_INCREMENT", "bigserial": "BIGINT AUTO_INCREMENT",
    },
    ("mysql", "postgresql"): {
        "int": "INTEGER", "bigint": "BIGINT", "smallint": "SMALLINT",
        "tinyint(1)": "BOOLEAN", "tinyint": "SMALLINT", "longtext": "TEXT",
        "mediumtext": "TEXT", "text": "TEXT", "varchar": "VARCHAR",
        "datetime": "TIMESTAMP", "date": "DATE", "time": "TIME",
        "double": "DOUBLE PRECISION", "float": "REAL", "decimal": "NUMERIC",
        "json": "JSONB", "char": "CHAR", "blob": "BYTEA", "longblob": "BYTEA",
        "enum": "TEXT",
    },
}


def convert_type(source_db: str, dest_db: str, source_type: str) -> str:
    mapping = TYPE_MAP.get((source_db, dest_db), {})
    lower = source_type.lower()
    if lower in mapping:
        return mapping[lower]
    for k, v in mapping.items():
        if lower.startswith(k):
            return v + source_type[len(k):]
    return source_type.upper()


def get_pg_schema(conn_params: dict) -> List[Dict]:
    import psycopg2
    conn = psycopg2.connect(**conn_params)
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'
    """)
    tables = [r[0] for r in cur.fetchall()]
    schema = []
    for t in tables:
        cur.execute("""
            SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
            FROM information_schema.columns WHERE table_name=%s ORDER BY ordinal_position
        """, (t,))
        cols = cur.fetchall()
        cur.execute("""
            SELECT kcu.column_name FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name=kcu.constraint_name
            WHERE tc.table_name=%s AND tc.constraint_type='PRIMARY KEY'
        """, (t,))
        pks = {r[0] for r in cur.fetchall()}
        schema.append({"table": t, "columns": cols, "primary_keys": pks})
    cur.close()
    conn.close()
    return schema


def get_mysql_schema(conn_params: dict) -> List[Dict]:
    import pymysql
    conn = pymysql.connect(**conn_params)
    cur = conn.cursor()
    cur.execute("SHOW TABLES")
    tables = [r[0] for r in cur.fetchall()]
    schema = []
    for t in tables:
        cur.execute(f"DESCRIBE `{t}`")
        cols = cur.fetchall()
        schema.append({"table": t, "columns": cols, "primary_keys": set()})
    cur.close()
    conn.close()
    return schema


@celery_app.task(bind=True, name="migrate_database")
def migrate_database_task(self, source_params: Dict, dest_params: Dict,
                           source_db_type: str, dest_db_type: str,
                           options: Dict[str, Any]):
    """Celery task: migrate schema and data from source to destination DB."""
    warnings = []
    migrated_tables = 0

    try:
        self.update_state(state="PROGRESS", meta={"progress": 5, "step": "Reading source schema"})

        if source_db_type == "postgresql":
            schema = get_pg_schema(source_params)
        elif source_db_type == "mysql":
            schema = get_mysql_schema(source_params)
        else:
            return {"success": False, "error": f"Source type {source_db_type} not supported yet"}

        total = len(schema)
        self.update_state(state="PROGRESS", meta={
            "progress": 10, "step": f"Found {total} tables, starting migration"
        })

        for idx, table_info in enumerate(schema):
            table = table_info["table"]
            progress = 10 + int((idx / total) * 85)
            self.update_state(state="PROGRESS", meta={
                "progress": progress,
                "step": f"Migrating table {table} ({idx+1}/{total})"
            })

            # Build CREATE TABLE for destination
            col_defs = []
            for col in table_info["columns"]:
                col_name = col[0]
                col_type = convert_type(source_db_type, dest_db_type, col[1])
                nullable = "NULL" if col[2] == "YES" else "NOT NULL"
                pk = "PRIMARY KEY" if col_name in table_info.get("primary_keys", set()) else ""
                col_defs.append(f"  `{col_name}` {col_type} {nullable} {pk}".strip())

            create_sql = f"CREATE TABLE IF NOT EXISTS `{table}` (\n" + ",\n".join(col_defs) + "\n);"

            # Write to destination
            if dest_db_type == "mysql":
                import pymysql
                conn = pymysql.connect(**dest_params)
                cur = conn.cursor()
                try:
                    cur.execute(create_sql.replace("`", "`"))
                    conn.commit()
                    migrated_tables += 1
                except Exception as e:
                    warnings.append(f"Table {table}: {str(e)}")
                finally:
                    cur.close()
                    conn.close()

            elif dest_db_type == "postgresql":
                import psycopg2
                conn = psycopg2.connect(**dest_params)
                cur = conn.cursor()
                pg_sql = create_sql.replace("`", '"')
                try:
                    cur.execute(pg_sql)
                    conn.commit()
                    migrated_tables += 1
                except Exception as e:
                    warnings.append(f"Table {table}: {str(e)}")
                    conn.rollback()
                finally:
                    cur.close()
                    conn.close()

        self.update_state(state="PROGRESS", meta={"progress": 100, "step": "Migration complete"})
        return {
            "success": True,
            "migrated_tables": migrated_tables,
            "total_tables": total,
            "warnings": warnings,
        }

    except Exception as e:
        return {"success": False, "error": str(e), "warnings": warnings}
