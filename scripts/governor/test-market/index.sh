#!/bin/bash

# Test Market Script Wrapper
# This script provides a simple interface to test a market implementation

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
    echo -e "${BLUE}🧪 Test Market Script Wrapper${NC}"
    echo ""
    echo "Usage: ./scripts/governor/test-market/index.sh [options]"
    echo ""
    echo "Options:"
    echo "  -n, --network <network>                    Network to use (required)"
    echo "  -d, --deployment <market>                  Market to test (required)"
    echo "  -i, --implementation <addr>                New implementation address (optional - will prompt if not provided)"
    echo "  -h, --help                                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  # Test DAI market implementation on local network (will prompt for address)"
    echo "  ./scripts/governor/test-market/index.sh -n local -d dai"
    echo ""
    echo "  # Test USDC market implementation with specific address"
    echo "  ./scripts/governor/test-market/index.sh -n polygon -d usdc -i 0x1234567890123456789012345678901234567890"
    echo ""
    echo "  # Test WETH market implementation on mainnet (skip implementation update)"
    echo "  ./scripts/governor/test-market/index.sh -n mainnet -d weth"
    echo ""
    echo ""
    echo "Available networks: local, hardhat, mainnet, polygon, arbitrum, optimism, base, etc."
    echo "Available markets: dai, usdc, usdt, weth, wbtc, etc."
    echo ""
    echo "Features:"
    echo "  - Prompts for new implementation address if not provided (can skip)"
    echo "  - Updates aliases.json with new implementation address (only if provided)"
    echo "  - Runs spider to refresh roots.json (only if implementation provided)"
    echo "  - Executes deployment verification test"
    echo "  - Provides comprehensive error handling and troubleshooting tips"
    echo "  - Validates Ethereum address format"
    echo "  - Allows continuation despite non-critical failures"
    echo ""
    echo "Note: This script can be used to test a market implementation. If no new implementation"
    echo "address is provided, it will skip the file updates and just run the verification test."
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
NETWORK=""
DEPLOYMENT=""
IMPLEMENTATION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--network)
            NETWORK="$2"
            shift 2
            ;;
        -d|--deployment)
            DEPLOYMENT="$2"
            shift 2
            ;;
        -i|--implementation)
            IMPLEMENTATION="$2"
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
    # Validate required arguments
    if [[ -z "$NETWORK" || -z "$DEPLOYMENT" ]]; then
        print_error "Network and deployment are both required"
        show_help
        exit 1
    fi

    print_info "Starting market testing process..."
    print_info "Network: $NETWORK"
    print_info "Deployment: $DEPLOYMENT"
    if [[ -n "$IMPLEMENTATION" ]]; then
        print_info "Implementation: $IMPLEMENTATION"
    else
        print_info "Implementation: Will prompt for address (can skip)"
    fi
    
    # Check requirements
    check_requirements
    
    # Run the test script
    print_info "Executing market test script..."
    
    if [[ -n "$IMPLEMENTATION" ]]; then
        yarn ts-node scripts/governor/test-market/index.ts \
            --network "$NETWORK" \
            --deployment "$DEPLOYMENT" \
            --implementation "$IMPLEMENTATION"
    else
        yarn ts-node scripts/governor/test-market/index.ts \
            --network "$NETWORK" \
            --deployment "$DEPLOYMENT"
    fi
    
    print_success "Market test script completed"
}

# Run main function
main "$@"
