---
title: Authentication Methods
description: Understand the different ways to authenticate Ralph with GitHub.
sidebar:
  order: 2
  label: Auth Methods
---

# Authentication Methods

Ralph supports two authentication methods for GitHub integration. This page explains each option in detail.

## OAuth Device Flow

The recommended authentication method.

### How It Works

```bash
ralph auth login
```

1. Ralph requests a device code from GitHub
2. You receive a code and URL to visit
3. In your browser, you authorize Ralph
4. Ralph receives an access token automatically

### Advantages

- **No token management**: Tokens are handled automatically
- **Secure**: Uses GitHub's official OAuth flow
- **Minimal permissions**: Only requests what's needed
- **Token refresh**: Credentials stay valid

### Step-by-Step

```bash
$ ralph auth login

Visit this URL to authenticate:
https://github.com/login/device

Enter this code: ABCD-1234

Waiting for authorization...
```

1. Open the URL in your browser
2. Log in to GitHub if needed
3. Enter the code `ABCD-1234`
4. Click "Authorize" to grant access
5. Return to your terminal

```bash
✓ Authentication successful
  Logged in as: your-username
```

### Revoking Access

You can revoke Ralph's access from GitHub:

1. Go to [GitHub Settings > Applications > Authorized OAuth Apps](https://github.com/settings/applications)
2. Find "Ralph" in the list
3. Click "Revoke"

Then log out locally:

```bash
ralph auth logout
```

## Personal Access Token

An alternative method using GitHub personal access tokens.

### When to Use

- OAuth is blocked by your organization
- You need more control over permissions
- You prefer token-based auth

### Creating a Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Set a descriptive name: "Ralph CLI"
4. Select scopes:
   - `repo` (required)
   - `read:user` (recommended)
5. Click "Generate token"
6. Copy the token (it won't be shown again)

### Setting the Token

```bash
ralph github set-token ghp_xxxxxxxxxxxxxxxxxxxx
```

### Token Security

- Treat tokens like passwords
- Never commit tokens to git
- Rotate tokens periodically
- Use fine-grained tokens if available

### Fine-Grained Tokens

GitHub supports newer "fine-grained" tokens with more precise permissions. To use one:

1. Go to [GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens](https://github.com/settings/personal-access-tokens/new)
2. Set token name and expiration
3. Select the repository
4. Grant permissions:
   - Repository permissions: Contents (Read and write)
   - Repository permissions: Pull requests (Read and write)
5. Generate and copy the token
6. Set it: `ralph github set-token github_pat_...`

## Comparison

| Feature | OAuth | Personal Access Token |
|---------|-------|----------------------|
| Setup complexity | Low | Medium |
| Token management | Automatic | Manual |
| Permission scope | Minimal | You choose |
| Expiration | Handled | Manual rotation |
| Organization support | Usually yes | Depends on policy |

## Troubleshooting

### "Not authorized" error

Re-authenticate:

```bash
ralph auth logout
ralph auth login
```

### Token expired

Generate a new token and update:

```bash
ralph github set-token <new-token>
```

### Organization restrictions

Some organizations restrict OAuth apps. Check with your admin or use a personal access token with appropriate permissions.

## Next Steps

- [PR Creation](/ralph/docs/github-integration/pr-creation/) — Configure pull request creation
- [Configuration](/ralph/docs/configuration/overview/) — Full configuration reference
