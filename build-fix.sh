#!/bin/bash
# Install dependencies
npm install

# Ensure the build directory exists
mkdir -p build

# Run the build process
npm run build

echo "Build process completed!" 