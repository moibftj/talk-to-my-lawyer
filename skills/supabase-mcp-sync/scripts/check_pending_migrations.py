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


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 check_pending_migrations.py <migrations_dir> <applied_migrations_json>")
        sys.exit(1)

    migrations_dir = sys.argv[1]
    applied_json_path = sys.argv[2]

    # Read applied migrations
    with open(applied_json_path, 'r') as f:
        applied = json.load(f)

    applied_versions = set(m['version'] for m in applied)

    # Read migration files
    if not os.path.exists(migrations_dir):
        print(f"Error: Migrations directory not found: {migrations_dir}", file=sys.stderr)
        sys.exit(1)

    migration_files = sorted(os.listdir(migrations_dir))

    pending = []
    for file in migration_files:
        if file.endswith('.sql'):
            # Extract version from filename (first part before underscore)
            version = file.split('_')[0]
            if version not in applied_versions:
                pending.append(file)

    if pending:
        print("Pending migrations:")
        for p in pending:
            print(f"  - {p}")
        print(f"\nTotal: {len(pending)} pending migrations")
    else:
        print("No pending migrations. Database is up to date.")


if __name__ == "__main__":
    main()
