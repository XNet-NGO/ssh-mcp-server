# SSH MCP Server - Workspace Cleanup Script
# Copyright (c) 2026 XNet Inc., Joshua S. Doucette
# This script removes temporary files and prepares the workspace for repository

Write-Host "SSH MCP Server - Workspace Cleanup" -ForegroundColor Cyan
Write-Host "Copyright (c) 2026 XNet Inc., Joshua S. Doucette" -ForegroundColor Gray
Write-Host ""

# Files to remove (temporary/test files)
$filesToRemove = @(
    "ALL_TOOLS_TEST_REPORT.md",
    "AWS_CONFIG_FINAL.md",
    "AWS_PROFILE_CLEANUP.md",
    "AWS_PROFILE_ENV_VAR.md",
    "check-vhdx.ps1",
    "chmod-script-request.json",
    "connect-request.json",
    "delete-script-request.json",
    "DEPLOYMENT_CHECKLIST.md",
    "DEPLOYMENT_SUCCESS.md",
    "disconnect-request.json",
    "DOCKER_MCP_GATEWAY_LIMITATION.md",
    "DOCKER_MCP_SETUP.md",
    "DOCKER_WSL_FIX.md",
    "DOCUMENTATION_SYSTEM_COMPLETE.md",
    "E2E_TEST_SUCCESS.md",
    "EC2_SSH_MCP_SUCCESS.md",
    "EC2_SSH_TEST_REPORT.md",
    "execute-request.json",
    "execute-script-request.json",
    "FEATURES_RESTORED.md",
    "fingerprint-request.json",
    "get-config-request.json",
    "IAM_AI_ADMIN_USER.md",
    "keygen-request.json",
    "list-keys-request.json",
    "list-sessions-request.json",
    "MCP_CLEANUP_SUMMARY.md",
    "MCP_CONTAINERS_SUMMARY.md",
    "MCP_DOCKER_TROUBLESHOOTING.md",
    "MCP_GATEWAY_FINAL_STATUS.md",
    "MCP_GATEWAY_TEST_REPORT.md",
    "MCP_SSH_DIAGNOSTIC_REPORT.md",
    "MCP_STATUS.md",
    "MCP_TOOLKIT_E2E_SUCCESS.md",
    "MCP_TOOLKIT_FINAL_STATUS.md",
    "MCP_TOOLKIT_TEST_STATUS.md",
    "mcp-catalog-custom.yaml",
    "NETBIRD_CONFIG_MAPPER_PLAN.md",
    "NETBIRD_TOKEN_RENEWAL_GUIDE.md",
    "PACKAGE_SUMMARY.md",
    "QUICK_VHDX_FIX.md",
    "RUN_VHDX_DIAGNOSTICS.md",
    "run-mcp-with-key.sh",
    "run-script-request.json",
    "SECURE_CREDENTIALS_SETUP.md",
    "setup-docker-mcp.ps1",
    "setup-ssh-user.sh",
    "sftp-list-request.json",
    "SMOKE_TEST_RESULTS.md",
    "SSH_MCP_COMPLETE_SUMMARY.md",
    "SSH_MCP_DOCKER_GATEWAY_ISSUE.md",
    "SSH_MCP_FINAL_SOLUTION.md",
    "SSH_MCP_PERSISTENCE_INVESTIGATION.md",
    "SSH_MCP_PERSISTENT_STORAGE.md",
    "SSH_MCP_READY.md",
    "SSH_MCP_SOLUTION.md",
    "ssh-mcp-server-0.1.0.tgz",
    "ssm-commands.json",
    "STATELESS_IMPLEMENTATION_COMPLETE.md",
    "STATELESS_IMPLEMENTATION_PLAN.md",
    "STATELESS_MIGRATION_SUCCESS.md",
    "temp-vhdx-diag.ps1",
    "test_key",
    "test-e2e-workflow-fixed.ps1",
    "test-e2e-workflow.ps1",
    "test-ec2-direct.ps1",
    "test-ec2-direct.sh",
    "test-ec2-ssh.js",
    "test-ec2-success.md",
    "test-mcp-client.js",
    "test-mcp-direct.js",
    "test-mcp-ec2-demo.md",
    "test-mcp-env.js",
    "test-mcp-simple.sh",
    "test-script.sh",
    "test-ssh-direct.sh",
    "test-ssh-no-command.js",
    "test-stateless.js",
    "UNIX_TEST_FIX_PROGRESS.md",
    "UNIX_TEST_RESULTS_FINAL.md",
    "UNIX_TEST_RESULTS.md",
    "upload-script-request.json",
    "VHDX_DIAGNOSTIC_REPORT.md",
    "VHDX_DIAGNOSTIC_RESULTS.md",
    "VHDX_TROUBLESHOOTING_GUIDE.md",
    "vhdx-diagnostic-output.txt",
    "WSL_FIX.md",
    "WSL_SETUP_COMPLETE.md",
    "XNET_DIAGNOSTIC_REPORT.md",
    "XNET_RESOLUTION_SUMMARY.md"
)

# Directories to remove
$dirsToRemove = @(
    "mcp-registry",
    "openssh-portable",
    ".kiro"
)

# Remove files
Write-Host "Removing temporary files..." -ForegroundColor Yellow
$removedCount = 0
foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "  Removed: $file" -ForegroundColor Gray
        $removedCount++
    }
}

# Remove directories
Write-Host "`nRemoving temporary directories..." -ForegroundColor Yellow
foreach ($dir in $dirsToRemove) {
    if (Test-Path $dir) {
        Remove-Item $dir -Recurse -Force
        Write-Host "  Removed: $dir/" -ForegroundColor Gray
        $removedCount++
    }
}

Write-Host "`nCleanup complete! Removed $removedCount items." -ForegroundColor Green
Write-Host ""
Write-Host "Repository is ready for:" -ForegroundColor Cyan
Write-Host "  1. Git initialization" -ForegroundColor White
Write-Host "  2. Initial commit" -ForegroundColor White
Write-Host "  3. Push to GitHub" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  git init" -ForegroundColor White
Write-Host "  git add ." -ForegroundColor White
Write-Host "  git commit -m 'Initial commit - SSH MCP Server v0.2.0'" -ForegroundColor White
Write-Host "  git branch -M main" -ForegroundColor White
Write-Host "  git remote add origin https://github.com/XNet-NGO/ssh-mcp-server.git" -ForegroundColor White
Write-Host "  git push -u origin main" -ForegroundColor White
Write-Host ""
