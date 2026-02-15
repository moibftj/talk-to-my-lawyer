"""
Logging utility module for Python scripts.

Provides structured logging with configurable levels and formats.
"""

import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


class ColoredFormatter(logging.Formatter):
    """Custom formatter with color support for console output."""

    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
        'RESET': '\033[0m',       # Reset
    }

    def format(self, record: logging.LogRecord) -> str:
        levelname = record.levelname
        if levelname in self.COLORS:
            record.levelname = f"{self.COLORS[levelname]}{levelname}{self.COLORS['RESET']}"
        return super().format(record)


def setup_logger(
    name: str = __name__,
    level: int = logging.INFO,
    log_to_file: bool = False,
    log_file: Optional[str | Path] = None,
    log_dir: Optional[str | Path] = None,
    colored: bool = True,
) -> logging.Logger:
    """
    Set up and configure a logger instance.

    Args:
        name: Logger name (default: module name)
        level: Logging level (default: INFO)
        log_to_file: Whether to log to a file (default: False)
        log_file: Specific log file path
        log_dir: Directory for log files (used if log_file not specified)
        colored: Use colored output for console (default: True)

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Remove existing handlers to avoid duplicates
    logger.handlers.clear()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)

    console_format = '[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s'
    console_date_format = '%Y-%m-%d %H:%M:%S'

    if colored:
        console_formatter = ColoredFormatter(
            console_format,
            datefmt=console_date_format
        )
    else:
        console_formatter = logging.Formatter(
            console_format,
            datefmt=console_date_format
        )

    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    # File handler (optional)
    if log_to_file:
        if log_file:
            log_path = Path(log_file)
        elif log_dir:
            log_dir = Path(log_dir)
            log_dir.mkdir(parents=True, exist_ok=True)
            log_path = log_dir / f"{name.replace('.', '_')}.log"
        else:
            log_path = Path(f"logs/{name.replace('.', '_')}.log")

        log_path.parent.mkdir(parents=True, exist_ok=True)

        file_handler = logging.FileHandler(log_path)
        file_handler.setLevel(level)

        file_format = '[%(asctime)s] [%(levelname)s] [%(name)s] [%(filename)s:%(lineno)d] %(message)s'
        file_formatter = logging.Formatter(
            file_format,
            datefmt='%Y-%m-%d %H:%M:%S'
        )

        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)

    return logger


def get_logger(name: str = __name__) -> logging.Logger:
    """
    Get an existing logger or create a basic one.

    Args:
        name: Logger name

    Returns:
        Logger instance
    """
    logger = logging.getLogger(name)
    if not logger.handlers:
        return setup_logger(name)
    return logger


class LogContext:
    """Context manager for temporary logging level changes."""

    def __init__(self, logger: logging.Logger, level: int):
        self.logger = logger
        self.new_level = level
        self.old_level = None

    def __enter__(self):
        self.old_level = self.logger.level
        self.logger.setLevel(self.new_level)
        return self.logger

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.old_level is not None:
            self.logger.setLevel(self.old_level)
        return False


# Pre-configured loggers for common use cases
def get_verbose_logger() -> logging.Logger:
    """Get a logger with DEBUG level enabled."""
    return setup_logger(level=logging.DEBUG)


def get_quiet_logger() -> logging.Logger:
    """Get a logger that only shows WARNING and above."""
    return setup_logger(level=logging.WARNING)


# Default logger instance
default_logger = setup_logger('ttml')
