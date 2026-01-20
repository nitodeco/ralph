#!/bin/bash
set -e

REPO="nitodeco/ralph"
INSTALL_DIR="/usr/local/bin"
BINARY_NAME="ralph"

get_arch() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64)
            echo "x64"
            ;;
        arm64|aarch64)
            echo "arm64"
            ;;
        *)
            echo "Unsupported architecture: $arch" >&2
            exit 1
            ;;
    esac
}

get_os() {
    local os
    os=$(uname -s)
    case "$os" in
        Darwin)
            echo "darwin"
            ;;
        Linux)
            echo "linux"
            ;;
        *)
            echo "Unsupported OS: $os" >&2
            echo "Ralph currently only supports macOS and Linux." >&2
            exit 1
            ;;
    esac
}

get_latest_version() {
    curl -sL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'
}

main() {
    echo "Installing Ralph CLI..."
    echo ""

    local os arch version download_url tmp_dir binary_path

    os=$(get_os)
    arch=$(get_arch)
    version=$(get_latest_version)

    if [ -z "$version" ]; then
        echo "Error: Could not determine latest version" >&2
        exit 1
    fi

    echo "  OS: $os"
    echo "  Architecture: $arch"
    echo "  Version: $version"
    echo ""

    download_url="https://github.com/${REPO}/releases/download/${version}/ralph-${os}-${arch}"

    tmp_dir=$(mktemp -d)
    binary_path="${tmp_dir}/${BINARY_NAME}"

    echo "Downloading from: $download_url"
    curl -sL "$download_url" -o "$binary_path"

    chmod +x "$binary_path"

    echo "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."

    if [ -w "$INSTALL_DIR" ]; then
        mv "$binary_path" "${INSTALL_DIR}/${BINARY_NAME}"
    else
        echo "Requesting sudo access to install to ${INSTALL_DIR}..."
        sudo mv "$binary_path" "${INSTALL_DIR}/${BINARY_NAME}"
    fi

    rm -rf "$tmp_dir"

    echo ""
    echo "Ralph CLI installed successfully!"
    echo ""

    "${INSTALL_DIR}/${BINARY_NAME}" setup
}

main
