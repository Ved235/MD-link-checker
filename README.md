# Markdown Link Checker

A GitHub App that automatically checks for broken links in markdown files across your repositories. When new commits are pushed, it scans all markdown files and creates/updates an issue with the status of all links.

## Features

- 🔍 Scans all markdown files in your repository
- ✅ Validates both internal and external links
- 🔄 Updates results on each push
- 📊 Creates/updates a single issue with results
- 🎯 Handles relative paths and anchor links
- 🚀 Easy to deploy and self-host

## Installation

1. **As a GitHub App**
   - Install directly from [GitHub Apps Marketplace](https://github.com/apps/markdown-link-checker)
   - Select repositories you want to monitor
   - It hasn't been deployed on the marketplace yet

2. **Self Hosting**
   ```sh
   # Clone repository
   git clone <your-repo-url>
   cd markdown-link-checker

   # Install dependencies
   npm install

   # Configure environment
   cp .env.example .env
   # Fill in your GitHub App credentials in .env