#!/usr/bin/env python3
"""
Check for pending migrations by comparing local migration files with applied migrations.

Usage:
    python3 check_pending_migrations.py <migrations_dir> <applied_migrations_json>

Args:
    migrations_dir: Path to local migrations directory (e.g., /path/to/supabase/migrations)
    applied_migrations_json: Path to JSON file with applied migrations from MCP

Output:
    Prints list of pending migration files to stdout
"""

import json
import os
import sys

from util import setup_logger


logger = setup_logger(
    'check_pending_migrations',
    level=os.environ.get('LOG_LEVEL', 'INFO').upper(),
)


def main():
    if len(sys.argv) != 3:
        logger.error("Usage: python3 check_pending_migrations.py <migrations_dir> <applied_migrations_json>")
        sys.exit(1)

    migrations_dir = sys.argv[1]
    applied_json_path = sys.argv[2]

    logger.info(f"Checking migrations in: {migrations_dir}")
    logger.debug(f"Using applied migrations from: {applied_json_path}")

    # Read applied migrations
    try:
        with open(applied_json_path, 'r') as f:
            applied = json.load(f)
        logger.debug(f"Loaded {len(applied)} applied migrations")
    except FileNotFoundError:
        logger.error(f"Applied migrations file not found: {applied_json_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in applied migrations file: {e}")
        sys.exit(1)

    applied_versions = set(m['version'] for m in applied)
    logger.debug(f"Applied versions: {sorted(applied_versions)}")

    # Read migration files
    if not os.path.exists(migrations_dir):
        logger.error(f"Migrations directory not found: {migrations_dir}")
        sys.exit(1)

    migration_files = sorted(os.listdir(migrations_dir))
    logger.debug(f"Found {len(migration_files)} files in migrations directory")

    pending = []
    for file in migration_files:
        if file.endswith('.sql'):
            # Extract version from filename (first part before underscore)
            version = file.split('_')[0]
            if version not in applied_versions:
                pending.append(file)
                logger.debug(f"Pending: {file} (version {version})")

    if pending:
        logger.warning(f"Found {len(pending)} pending migration(s):")
        for p in pending:
            logger.info(f"  - {p}")
        logger.info(f"Total: {len(pending)} pending migrations")
    else:
        logger.info("No pending migrations. Database is up to date.")


if __name__ == "__main__":
    main()
