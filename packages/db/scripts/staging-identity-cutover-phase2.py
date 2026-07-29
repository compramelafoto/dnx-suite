#!/usr/bin/env python3
"""
PHASE 2 — import dominio Clickatón → DNX Staging Identity.
Requiere PHASE 1 (ClickatonLegacyUserMap) y backups.

No imprime connection strings ni passwords.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import json
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

import psycopg2
import psycopg2.extras
from psycopg2.extras import Json

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.cutover.local"

# Orden FK-safe para tablas con datos conocidos en Staging.
TABLE_ORDER = [
    "ClickatonEdition",
    "ClickatonVenue",
    "ClickatonTicketType",
    "ClickatonEditionSequence",
    "ClickatonRegistration",
    "ClickatonRegistrationAudit",
    "ClickatonRegistrationStatusHistory",
    "ClickatonCapacityHold",
    "ClickatonParticipantCredential",
    "ClickatonQrToken",
]

USER_FK_COLUMNS = {
    "ClickatonRegistration": ["userId"],
    "ClickatonRegistrationAudit": ["actorUserId"],
    "ClickatonRegistrationStatusHistory": ["actorUserId"],
    "ClickatonCheckIn": ["operatorUserId", "reversedByUserId"],
    "ClickatonEditionCapabilityGrant": ["userId"],
    "ClickatonEditionFinanceAudit": ["actorUserId"],
    "ClickatonEditionTimeline": ["activatedByUserId", "createdByUserId"],
    "ClickatonFotoRankSync": ["userId"],
    "ClickatonInventoryMovement": ["createdByUserId"],
    "ClickatonKitDelivery": ["operatorUserId", "reversedByUserId"],
    "ClickatonPrompt": ["createdByUserId", "releasedByUserId"],
    "ClickatonRegistrationItem": ["fulfilledByUserId"],
    "ClickatonTimelineAudit": ["actorUserId"],
    "ClickatonTimelineEvent": ["manuallyReleasedByUserId"],
}


def load_env() -> None:
    if not ENV_FILE.exists():
        raise SystemExit(f"Missing {ENV_FILE}")
    for line in ENV_FILE.read_text().splitlines():
        t = line.strip()
        if not t or t.startswith("#") or "=" not in t:
            continue
        k, v = t.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def host_hint(url: str) -> str:
    from urllib.parse import urlparse

    h = urlparse(url).hostname or ""
    return (h.split(".")[0][:32] + "…") if h else "?"


def main() -> None:
    load_env()
    if os.environ.get("CLICKATON_CUTOVER_CONFIRM") != "STAGING_IDENTITY_CUTOVER":
        raise SystemExit("Require CLICKATON_CUTOVER_CONFIRM=STAGING_IDENTITY_CUTOVER")

    source_url = os.environ["CLICKATON_SOURCE_DATABASE_URL"]
    dest_url = os.environ["DNX_IDENTITY_DATABASE_URL"]
    if source_url == dest_url:
        raise SystemExit("source == dest — abort")

    print("=== cutover PHASE 2 domain import ===")
    print("source", host_hint(source_url))
    print("dest  ", host_hint(dest_url))

    src = psycopg2.connect(source_url)
    dst = psycopg2.connect(dest_url)
    src.autocommit = False
    dst.autocommit = False

    try:
        with src.cursor() as sc, dst.cursor() as dc:
            sc.execute('SELECT count(*) FROM "ClickatonEdition"')
            src_ed = sc.fetchone()[0]
            if src_ed != 6 and os.environ.get("CLICKATON_CUTOVER_ALLOW_EDITION_MISMATCH") != "1":
                raise SystemExit(f"source editions={src_ed}, expected 6")

            dc.execute(
                'SELECT "sourceUserId", "canonicalUserId" FROM "ClickatonLegacyUserMap" '
                'WHERE "canonicalUserId" IS NOT NULL'
            )
            user_map = {int(a): int(b) for a, b in dc.fetchall()}
            if not user_map:
                raise SystemExit("ClickatonLegacyUserMap vacío — correr PHASE 1 primero")
            print(f"user_map_size={len(user_map)}")

            imported: dict[str, int] = {}
            for table in TABLE_ORDER:
                sc.execute(
                    "SELECT count(*) FROM information_schema.tables "
                    "WHERE table_schema='public' AND table_name=%s",
                    (table,),
                )
                if sc.fetchone()[0] == 0:
                    continue
                sc.execute(f'SELECT count(*) FROM "{table}"')
                n = sc.fetchone()[0]
                if n == 0:
                    imported[table] = 0
                    continue

                sc.execute(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position",
                    (table,),
                )
                cols = [r[0] for r in sc.fetchall()]
                col_list = ", ".join(f'"{c}"' for c in cols)
                sc.execute(f'SELECT {col_list} FROM "{table}"')
                rows = sc.fetchall()

                def adapt(value):
                    if isinstance(value, dict):
                        return Json(value)
                    if isinstance(value, list):
                        return Json(value)
                    if isinstance(value, (datetime, date, Decimal, UUID, bytes, memoryview)):
                        return value
                    if isinstance(value, str) and value[:1] in "{[":
                        # leave strings as-is; JSON columns may already be strings
                        return value
                    return value

                remap_cols = set(USER_FK_COLUMNS.get(table, []))
                out_rows = []
                for row in rows:
                    d = dict(zip(cols, row))
                    for c in remap_cols:
                        if d.get(c) is None:
                            continue
                        old = int(d[c])
                        if old not in user_map:
                            raise SystemExit(
                                f"Unmapped user FK {table}.{c}={old}"
                            )
                        d[c] = user_map[old]
                    out_rows.append(tuple(adapt(d[c]) for c in cols))

                placeholders = ", ".join(["%s"] * len(cols))
                sc.execute(
                    """
                    SELECT a.attname
                    FROM pg_index i
                    JOIN pg_class c ON c.oid = i.indrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                    WHERE n.nspname = 'public' AND c.relname = %s AND i.indisprimary
                    ORDER BY a.attnum
                    """,
                    (table,),
                )
                pk_cols = [r[0] for r in sc.fetchall()]
                insert_sql = (
                    f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders})'
                )
                if pk_cols:
                    conflict = ", ".join(f'"{c}"' for c in pk_cols)
                    insert_sql += f" ON CONFLICT ({conflict}) DO NOTHING"

                psycopg2.extras.execute_batch(dc, insert_sql, out_rows, page_size=100)
                imported[table] = len(out_rows)
                print(f"imported {table}={len(out_rows)}")

            dst.commit()
            src.commit()

            # Integrity
            checks = {}
            for table in ("ClickatonEdition", "ClickatonVenue", "ClickatonTicketType", "ClickatonRegistration"):
                sc.execute(f'SELECT count(*) FROM "{table}"')
                dc.execute(f'SELECT count(*) FROM "{table}"')
                so, de = sc.fetchone()[0], dc.fetchone()[0]
                checks[table] = {"source": so, "dest": de, "diff": de - so}
            print("integrity", checks)

            dc.execute('SELECT count(*) FROM "ClickatonEdition"')
            if dc.fetchone()[0] != 6:
                raise SystemExit("DEST editions != 6 after import")

            # orphan user FKs on registration
            dc.execute(
                """
                SELECT count(*) FROM "ClickatonRegistration" r
                LEFT JOIN "User" u ON u.id = r."userId"
                WHERE u.id IS NULL
                """
            )
            orphans = dc.fetchone()[0]
            print(f"registration_user_orphans={orphans}")
            if orphans:
                raise SystemExit("orphan registration.userId")

            print("PHASE 2 OK")
    except Exception:
        src.rollback()
        dst.rollback()
        raise
    finally:
        src.close()
        dst.close()


if __name__ == "__main__":
    main()
