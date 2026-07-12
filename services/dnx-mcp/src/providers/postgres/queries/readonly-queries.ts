/** Queries de solo lectura — solo SELECT / funciones de catálogo. */

export const SQL_PING = "SELECT 1 AS ok";

export const SQL_VERSION = "SELECT version() AS version";

export const SQL_DATABASE_SIZE =
  "SELECT pg_database_size(current_database())::bigint AS size_bytes";

export const SQL_CONNECTION_COUNT = `
  SELECT count(*)::int AS count
  FROM pg_stat_activity
  WHERE datname = current_database()
`;

export const SQL_ACTIVE_QUERIES = `
  SELECT
    pid,
    usename,
    application_name AS application_name,
    state,
    left(query, 500) AS query,
    query_start::text AS query_start,
    wait_event_type
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND pid <> pg_backend_pid()
    AND state IS NOT NULL
  ORDER BY query_start NULLS LAST
`;

export const SQL_LONG_RUNNING_QUERIES = `
  SELECT
    pid,
    usename,
    application_name AS application_name,
    state,
    left(query, 500) AS query,
    query_start::text AS query_start,
    wait_event_type,
    (EXTRACT(EPOCH FROM (now() - query_start)) * 1000)::bigint AS duration_ms
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND pid <> pg_backend_pid()
    AND state = 'active'
    AND query_start IS NOT NULL
    AND EXTRACT(EPOCH FROM (now() - query_start)) * 1000 > $1
  ORDER BY duration_ms DESC
`;

export const SQL_LOCKS = `
  SELECT
    l.pid,
    l.locktype AS lock_type,
    l.mode,
    l.granted,
    COALESCE(c.relname, '') AS relation,
    left(a.query, 300) AS query
  FROM pg_locks l
  LEFT JOIN pg_class c ON c.oid = l.relation
  LEFT JOIN pg_stat_activity a ON a.pid = l.pid
  WHERE a.datname = current_database() OR a.datname IS NULL
  ORDER BY l.granted ASC, l.pid
`;

export const SQL_TABLE_STATS = `
  SELECT
    schemaname AS schema,
    relname AS table,
    n_live_tup::bigint AS live_tuples,
    n_dead_tup::bigint AS dead_tuples,
    last_vacuum::text AS last_vacuum,
    last_autovacuum::text AS last_autovacuum,
    last_analyze::text AS last_analyze
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC
  LIMIT 50
`;

export const SQL_MIGRATION_TABLE_EXISTS = `
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = '_prisma_migrations'
  ) AS exists
`;

export const SQL_MIGRATION_TABLE_STATUS = `
  SELECT
    count(*)::int AS applied_count,
    max(migration_name) AS latest_migration
  FROM _prisma_migrations
`;

const FORBIDDEN_SQL_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|CALL|DO|VACUUM|ANALYZE|REINDEX|CLUSTER|REFRESH)\b/i;

export function assertReadOnlyQuery(sql: string, label: string): void {
  const normalized = sql.trim();

  if (!normalized.toUpperCase().startsWith("SELECT")) {
    throw new Error(`Query "${label}" debe ser SELECT`);
  }

  if (FORBIDDEN_SQL_PATTERN.test(normalized)) {
    throw new Error(`Query "${label}" contiene operación no permitida`);
  }
}
