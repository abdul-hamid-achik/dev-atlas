# GitHub Actions Secrets Configuration

This document outlines the required secrets for the GitHub Actions workflows to function properly.

## Required Secrets

### NPM Publishing (`NPM_TOKEN`)
- **Purpose**: Publish MCP package to npm registry
- **How to obtain**:
  1. Go to [npmjs.com](https://npmjs.com) and log in
  2. Click on your profile → Access Tokens
  3. Generate new token with "Automation" type
  4. Copy the token value

### VS Code Marketplace (`VSCE_PAT`)
- **Purpose**: Publish VS Code extension to marketplace
- **How to obtain**:
  1. Go to [Azure DevOps](https://dev.azure.com)
  2. Create a Personal Access Token
  3. Set scope to "Marketplace" with "Acquire" and "Publish" permissions
  4. Copy the token value

### Vercel Deployment
Required for website deployment:

#### `VERCEL_TOKEN`
- **Purpose**: Deploy website to Vercel
- **How to obtain**:
  1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
  2. Settings → Tokens
  3. Create new token
  4. Copy the token value

#### `ORG_ID`
- **Purpose**: Vercel organization identifier
- **How to obtain**:
  1. Go to Vercel Dashboard
  2. Settings → General
  3. Copy the Organization ID

#### `PROJECT_ID`
- **Purpose**: Vercel project identifier
- **How to obtain**:
  1. Go to your project in Vercel
  2. Settings → General
  3. Copy the Project ID

## Setting Secrets in GitHub

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Enter the secret name and value
6. Click **Add secret**

## Secrets List

Add these secrets to your GitHub repository:

- `NPM_TOKEN` - For publishing MCP package to npm
- `VSCE_PAT` - For publishing VS Code extension
- `VERCEL_TOKEN` - For Vercel deployment
- `ORG_ID` - Vercel organization ID
- `PROJECT_ID` - Vercel project ID

## Notes

- `GITHUB_TOKEN` is automatically provided by GitHub Actions
- Keep all tokens secure and don't share them
- Regenerate tokens periodically for security
- Test workflows in a fork first before setting up in production

## Workflow Status

Once all secrets are configured:

- ✅ **Release workflow** will publish packages automatically
- ✅ **Website deployment** will deploy to Vercel on pushes to main
- ✅ **PR previews** will create preview deployments for pull requests

## Troubleshooting

If workflows fail:

1. Check that all required secrets are set
2. Verify secret values are correct and not expired
3. Check workflow logs for specific error messages
4. Ensure package.json versions and configurations are correct
