#!/usr/bin/env python3
"""
Test Runner for Talk-To-My-Lawyer Application
==============================================

This script runs the complete test suite with various options.

Usage:
    python run_tests.py                    # Run all tests
    python run_tests.py --quick            # Run quick tests only (skip slow/integration)
    python run_tests.py --database         # Run database tests only
    python run_tests.py --api              # Run API endpoint tests only
    python run_tests.py --coverage         # Run with coverage report
    python run_tests.py --html             # Generate HTML report
"""

import subprocess
import sys
import argparse
import os


def main():
    parser = argparse.ArgumentParser(description='Run Talk-To-My-Lawyer test suite')
    parser.add_argument('--quick', action='store_true', help='Skip slow and integration tests')
    parser.add_argument('--database', action='store_true', help='Run database tests only')
    parser.add_argument('--api', action='store_true', help='Run API endpoint tests only')
    parser.add_argument('--coverage', action='store_true', help='Generate coverage report')
    parser.add_argument('--html', action='store_true', help='Generate HTML test report')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--failfast', '-x', action='store_true', help='Stop on first failure')
    parser.add_argument('--pattern', '-k', type=str, help='Run tests matching pattern')
    
    args = parser.parse_args()
    
    # Change to tests directory
    tests_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(tests_dir)
    
    # Build pytest command
    cmd = ['python', '-m', 'pytest']
    
    # Add markers based on options
    if args.quick:
        cmd.extend(['-m', 'not slow and not integration'])
    elif args.database:
        cmd.extend(['-m', 'database'])
    elif args.api:
        cmd.extend(['test_01_health.py', 'test_02_auth.py', 'test_03_subscriber.py',
                    'test_04_employee.py', 'test_05_attorney_admin.py', 
                    'test_06_super_admin.py', '-m', 'not database'])
    
    # Add coverage
    if args.coverage:
        cmd.extend(['--cov=..', '--cov-report=term-missing', '--cov-report=html'])
    
    # Add HTML report
    if args.html:
        cmd.extend(['--html=test_report.html', '--self-contained-html'])
    
    # Add verbose
    if args.verbose:
        cmd.append('-v')
    
    # Add failfast
    if args.failfast:
        cmd.append('-x')
    
    # Add pattern filter
    if args.pattern:
        cmd.extend(['-k', args.pattern])
    
    # Print command being run
    print(f"\n{'='*60}")
    print("Running: " + ' '.join(cmd))
    print(f"{'='*60}\n")
    
    # Run tests
    result = subprocess.run(cmd, cwd=tests_dir)
    
    # Print summary
    print(f"\n{'='*60}")
    if result.returncode == 0:
        print("✅ All tests passed!")
    else:
        print(f"❌ Tests failed with exit code: {result.returncode}")
    print(f"{'='*60}\n")
    
    return result.returncode


if __name__ == '__main__':
    sys.exit(main())
