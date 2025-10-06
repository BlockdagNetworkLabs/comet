#!/bin/bash

# Test Governor Setup Script
# This script runs the governance verification tests to validate the deployed governance configuration

set -e

# Default values
NETWORK="local"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -n|--network)
      NETWORK="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  -n, --network <network>    Network to test (default: local)"
      echo "  --help, -h                Show this help message"
      echo ""
      echo "Examples:"
      echo "  # Run governance verification tests on local network"
      echo "  $0 --network local"
      echo "  $0 -n local"
      echo ""
      echo "  # Run governance verification tests on polygon network"
      echo "  $0 --network polygon"
      echo "  $0 -n polygon"
      echo ""
      echo "Note: This script validates the deployed governance configuration"
      echo "against the expected configuration values."
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo "🔍 Starting Governor Setup Verification"
echo "Network: $NETWORK"
echo ""

# Run the governance verification tests
echo "🧪 Running Governance Verification Tests..."
echo ""

yarn hardhat test e2e/deployment-verification-test.ts --network "$NETWORK" --grep "Governance Verification"

echo ""
echo "✅ Governor Setup Verification Completed"
echo "🔧 Governance configuration has been validated successfully"
