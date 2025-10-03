#!/bin/bash

# Comet Reward Funding Proposal Script Wrapper
# This script provides a simple interface to create a governance proposal to fund CometRewards

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to show help
show_help() {
    echo -e "${BLUE}💰 Comet Reward Funding Proposal Script Wrapper${NC}"
    echo ""
    echo "Usage: ./scripts/governor/propose/comet-reward-funding/index.sh [options]"
    echo ""
    echo "Options:"
    echo "  -n, --network <network>     Network to use (default: local)"
    echo "  -h, --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  # Create a proposal to fund CometRewards on local network (amount will be asked interactively)"
    echo "  ./scripts/governor/propose/comet-reward-funding/index.sh -n local"
    echo ""
    echo "  # Create a proposal to fund CometRewards on polygon network (amount will be asked interactively)"
    echo "  ./scripts/governor/propose/comet-reward-funding/index.sh -n polygon"
    echo ""
    echo "Amount examples (when prompted):"
    echo "  1000000000000000000000 = 1000 COMP tokens"
    echo "  500000000000000000000  = 500 COMP tokens"
    echo "  100000000000000000000  = 100 COMP tokens"
    echo ""
    echo "Note: This script creates a governance proposal to fund CometRewards with COMP tokens."
    echo "The actual funding will occur after the proposal goes through the governance process."
    echo ""
    echo "Available networks: local, hardhat, mainnet, polygon, arbitrum, optimism, base, etc."
}

# Function to check if required tools are installed
check_requirements() {
    print_info "Checking requirements..."
    
    # Check if yarn is installed
    if ! command -v yarn &> /dev/null; then
        print_error "yarn is not installed. Please install yarn first."
        exit 1
    fi
    
    # Check if ts-node is available
    if ! yarn ts-node --version &> /dev/null; then
        print_error "ts-node is not available. Please run 'yarn install' first."
        exit 1
    fi
    
    print_success "Requirements check passed"
}

# Parse command line arguments
NETWORK="local"

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--network)
            NETWORK="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_info "Starting Comet Reward Funding Proposal process..."
    print_info "Network: $NETWORK"
    print_info "Amount will be asked interactively"
    
    # Check requirements
    check_requirements
    
    # Run the funding proposal script
    print_info "Executing funding proposal script..."
    
    yarn ts-node scripts/governor/propose/comet-reward-funding/index.ts \
        --network "$NETWORK"
    
    print_success "Funding proposal script completed"
}

# Run main function
main "$@" 