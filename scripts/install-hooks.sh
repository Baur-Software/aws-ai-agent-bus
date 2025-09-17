#!/bin/bash
# Install git hooks for test debt prevention

echo "Installing git hooks..."

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Pre-commit hook to prevent commits with skipped tests

echo "Checking for skipped tests..."
node scripts/pre-commit-check.js

if [ $? -ne 0 ]; then
    echo "❌ Commit blocked due to skipped tests"
    echo "Run 'npm run check:test-debt' for details"
    exit 1
fi

echo "✅ No skipped tests found"
EOF

# Make hook executable
chmod +x .git/hooks/pre-commit

echo "✅ Git hooks installed successfully"
echo ""
echo "The pre-commit hook will now prevent commits with skipped tests."
echo "To bypass (not recommended): git commit --no-verify"