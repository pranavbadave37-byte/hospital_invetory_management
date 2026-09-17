import oracledb
from contextlib import contextmanager
try:
    from . import config
except ImportError:
    import config

_pool = None


def init_pool():
    global _pool
    if _pool is None:
        if not config.ORACLE_USER or not config.ORACLE_PASSWORD:
            raise RuntimeError('ORACLE_USER and ORACLE_PASSWORD are not configured in .env')
        _pool = oracledb.create_pool(
            user=config.ORACLE_USER,
            password=config.ORACLE_PASSWORD,
            dsn=config.ORACLE_DSN,
            min=1,
            max=5,
            increment=1,
        )
    return _pool


@contextmanager
def connection():
    pool = init_pool()
    conn = pool.acquire()
    try:
        yield conn
    finally:
        pool.release(conn)


def rows_from_cursor(cursor):
    columns = [d[0].lower() for d in cursor.description] if cursor.description else []
    return [dict(zip(columns, row)) for row in cursor.fetchall()] if cursor.description else []


def query(sql, params=None):
    with connection() as conn:
        cur = conn.cursor()
        try:
            cur.execute(sql, params or {})
            return rows_from_cursor(cur)
        finally:
            cur.close()


def one(sql, params=None):
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql, params=None, commit=True):
    with connection() as conn:
        cur = conn.cursor()
        try:
            cur.execute(sql, params or {})
            if commit:
                conn.commit()
            return cur.rowcount
        except Exception:
            if commit:
                conn.rollback()
            raise
        finally:
            cur.close()


@contextmanager
def transaction():
    with connection() as conn:
        cur = conn.cursor()
        try:
            yield conn, cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
