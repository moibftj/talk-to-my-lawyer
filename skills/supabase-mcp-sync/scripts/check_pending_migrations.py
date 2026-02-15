#!/usr/bin/env python3
"""
Compare local Supabase migration files against applied migrations output.

Usage:
  python3 check_pending_migrations.py <migrations_dir> <applied_json_path>
  python3 check_pending_migrations.py <migrations_dir> <applied_json_path> --pending-out /tmp/pending.txt
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable


KEY_CANDIDATES = ("name", "migration_name", "version", "id")
TOKEN_SPLIT_RE = re.compile(r"[\s,;:\"'{}\[\]\(\)\t\r\n]+")
MIGRATION_FILE_RE = re.compile(r"^[0-9].*\.sql$")


def normalize_name(value: str) -> str:
    token = value.strip().split("/")[-1]
    if token.endswith(".sql"):
        token = token[:-4]
    return token


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text())
    except Exception as exc:
        raise RuntimeError(f"Failed to read JSON from {path}: {exc}") from exc


def iter_local_files(migrations_dir: Path) -> list[str]:
    if not migrations_dir.exists():
        raise RuntimeError(f"Migrations directory does not exist: {migrations_dir}")
    if not migrations_dir.is_dir():
        raise RuntimeError(f"Path is not a directory: {migrations_dir}")

    files = sorted(
        p.name
        for p in migrations_dir.iterdir()
        if p.is_file() and MIGRATION_FILE_RE.match(p.name)
    )
    if not files:
        raise RuntimeError(f"No migration .sql files found in {migrations_dir}")
    return files


def token_candidates(text: str) -> Iterable[str]:
    for token in TOKEN_SPLIT_RE.split(text):
        if token:
            yield token


def collect_applied_stems(payload: Any, local_stems: set[str]) -> set[str]:
    applied: set[str] = set()
    stack = [payload]

    while stack:
        node = stack.pop()

        if isinstance(node, dict):
            for key, value in node.items():
                if key in KEY_CANDIDATES and isinstance(value, str):
                    normalized = normalize_name(value)
                    if normalized in local_stems:
                        applied.add(normalized)
                stack.append(value)
            continue

        if isinstance(node, list):
            stack.extend(node)
            continue

        if isinstance(node, str):
            stripped = node.strip()

            # Some wrappers return JSON as a string payload.
            if stripped.startswith("{") or stripped.startswith("["):
                try:
                    stack.append(json.loads(stripped))
                    continue
                except Exception:
                    pass

            # Match explicit tokenized values.
            for token in token_candidates(stripped):
                normalized = normalize_name(token)
                if normalized in local_stems:
                    applied.add(normalized)

            # Catch embedded values from free-form message text.
            for stem in local_stems:
                pattern = r"(?<![A-Za-z0-9_-])" + re.escape(stem) + r"(?:\.sql)?(?![A-Za-z0-9_-])"
                if re.search(pattern, stripped):
                    applied.add(stem)

    return applied


def write_pending_output(path: Path, pending: list[str]) -> None:
    text = "\n".join(pending)
    if text:
        text += "\n"
    path.write_text(text)


def main() -> int:
    parser = argparse.ArgumentParser(description="Find pending Supabase migrations.")
    parser.add_argument("migrations_dir", help="Path to supabase/migrations directory")
    parser.add_argument("applied_json_path", help="Path to JSON output from list_migrations")
    parser.add_argument(
        "--pending-out",
        help="Optional path to write pending migration filenames (one per line)",
    )
    args = parser.parse_args()

    try:
        migrations_dir = Path(args.migrations_dir).resolve()
        applied_json_path = Path(args.applied_json_path).resolve()

        local_files = iter_local_files(migrations_dir)
        local_stems = {normalize_name(name) for name in local_files}

        payload = load_json(applied_json_path)
        applied_stems = collect_applied_stems(payload, local_stems)

        pending = [name for name in local_files if normalize_name(name) not in applied_stems]

        print(f"Local migration files: {len(local_files)}")
        print(f"Detected applied migrations: {len(applied_stems)}")
        print(f"Pending migrations: {len(pending)}")

        if pending:
            print("\nPending migration filenames:")
            for name in pending:
                print(name)

        if args.pending_out:
            output_path = Path(args.pending_out).resolve()
            write_pending_output(output_path, pending)
            print(f"\nWrote pending list to: {output_path}")

        return 0
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
