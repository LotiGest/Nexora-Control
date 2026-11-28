#!/usr/bin/env python3
"""Build an isolated, empty SQLite prototype from the central LotiGest D1 schema.
No network, production credentials, real company data or default administrator.
"""
import argparse
import json
import sqlite3
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--lotigest-source', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
source = args.lotigest_source.resolve()
schema = source / 'backend/schema.sql'
migrations = sorted((source / 'deploy/cloudflare/migrations').glob('*.sql'))
if not schema.is_file() or not migrations:
    parser.error('Se requiere un checkout completo de LotiGest Pro con esquema y migraciones.')
out = args.output.resolve()
if out.exists() or out.is_symlink():
    parser.error('La base destino ya existe; no se reemplazan instalaciones.')
if out.suffix != '.sqlite' or 'qa-' not in out.name:
    parser.error('El archivo nuevo debe ser .sqlite e incluir qa- en el nombre.')
out.parent.mkdir(parents=True, exist_ok=True)
try:
    with sqlite3.connect(out) as db:
        db.executescript(schema.read_text())
        for migration in migrations:
            db.executescript(migration.read_text())
        db.execute('PRAGMA foreign_keys=ON')
        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {'users', 'app_sessions', 'app_records'}.issubset(tables):
            raise ValueError('Faltan tablas requeridas en la instalación.')
        if db.execute('SELECT COUNT(*) FROM users').fetchone()[0] != 0:
            raise ValueError('El esquema contiene usuarios inesperados.')
    print(json.dumps({'database':str(out),'environment':'qa','fictitious':True,'tables':len(tables),'migrations':len(migrations),'admin':'pending_secure_invitation','cloudflare_d1':'not_created'},ensure_ascii=False))
except Exception:
    out.unlink(missing_ok=True)
    raise
