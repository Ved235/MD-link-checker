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
   git clone https://github.com/Ved235/MD-link-checker.git
   cd markdown-link-checker

   # Install dependencies
   npm install

   # Configure environment
   cp .env.example .env
   
   # Start the app
   npm start

   # Setup GitHub App
   - Go to [localhost:3000](http://localhost:3000)
   - Follow the Probot instructions given there

   # Host the GitHub App
   Use Probot [documentation](https://github.com/probot/example-vercel#readme) to host it on vercel```

In vercel enviornment variables add **NODEJS_HELPERS = 0**, else you will receive errors
