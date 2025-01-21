import fetch from "node-fetch";
import extractLinks from "markdown-link-extractor";
import path from "path";
/**
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.log.info("Markdown Link Checker loaded!");

  // Handle scheduled events
  app.on("push", async (context) => {
    try {
      app.log.info(
        `Running scheduled check for ${context.payload.repository.full_name}`
      );

      // Get all files in the repository
      const { data: files } = await context.octokit.repos.getContent({
        ...context.repo(),
        path: "",
      });

      // Filter for markdown files
      const markdownFiles = files.filter(
        (file) => file.name.endsWith(".md") && file.type === "file"
      );

      if (markdownFiles.length === 0) {
        app.log.info("No markdown files found");
        return;
      }

      let allResults = [];

      // Process each markdown file
      for (const file of markdownFiles) {
        try {
          // Get file content
          const { data: content } = await context.octokit.repos.getContent({
            ...context.repo(),
            path: file.path,
          });

          const fileContent = Buffer.from(content.content, "base64").toString();
          const results = await processMarkdownContent(
            fileContent,
            file.path,
            context
          );
          allResults.push(...results);
        } catch (error) {
          app.log.error(`Error processing file ${file.path}: ${error}`);
        }
      }

      // If there are broken links, create an issue
      const invalidLinks = allResults.filter((r) => !r.valid);
      if (invalidLinks.length > 0) {
        await createOrUpdateIssue(context, allResults);
      }
    } catch (error) {
      app.log.error(`Error in scheduled check: ${error}`);
    }
  });
};

// Process markdown content and extract links
async function processMarkdownContent(content, filename, context) {
  const links = extractLinks(content);
  const results = await Promise.all(
    links.map(async (link) => {
      // Handle anchor links
      if (link.startsWith("#")) {
        return {
          url: link,
          filename,
          status: "INTERNAL_ANCHOR",
          valid: true,
        };
      }

      // Check if it's a URL
      try {
        new URL(link);
        // It's a valid URL, check if it's a GitHub repo URL for this repository
        if (
          link.includes("github.com") &&
          link.includes(context.repo().owner) &&
          link.includes(context.repo().repo)
        ) {
          // Extract the file path from GitHub URL
          const matches = link.match(/\/blob\/[^/]+\/(.+)$/);
          if (matches) {
            const filePath = matches[1];
            return await checkInternalFile(filePath, link, filename, context);
          }
        }
        // External URL
        const result = await checkUrl(link);
        return { ...result, filename };
      } catch (urlError) {
        // Not a URL, treat as internal file path
        let filePath = link;

        // Handle relative paths and bare filenames
        const basePath = path.dirname(filename);
        filePath = path
          .normalize(path.join(basePath, link))
          .replace(/\\/g, "/");
        return await checkInternalFile(filePath, link, filename, context);
      }
    })
  );
  return results;
}

// Helper function to check if a file exists in the repository
async function checkInternalFile(filePath, originalLink, sourceFile, context) {
  try {
    await context.octokit.repos.getContent({
      ...context.repo(),
      path: filePath,
    });

    return {
      url: originalLink,
      filename: sourceFile,
      status: "INTERNAL_OK",
      valid: true,
      resolvedPath: filePath,
    };
  } catch (error) {
    return {
      url: originalLink,
      filename: sourceFile,
      status: "INTERNAL_NOT_FOUND",
      valid: false,
      error: "File not found in repository",
      attemptedPath: filePath,
    };
  }
}

// Check if a URL is valid and accessible
async function checkUrl(url) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      timeout: 5000,
      headers: {
        "User-Agent": "Link-Checker-Bot",
      },
      redirect: "follow", // Follow redirects
    });
    return {
      url,
      status: response.status,
      valid: response.ok,
    };
  } catch (error) {
    return {
      url,
      status: 0,
      valid: false,
      error: error.message,
    };
  }
}

// Generate issue body content
function generateIssueBody(results) {
  const validLinks = results.filter((r) => r.valid);
  const invalidLinks = results.filter((r) => !r.valid);

  let body = `## 🔍 Markdown Link Check Results\n\n`;
  body += `*Last checked: ${new Date().toUTCString()}*\n\n`;

  if (invalidLinks.length > 0) {
    body += "### ❌ Broken Links Found\n\n";
    invalidLinks.forEach((link) => {
      body += `- In \`${link.filename}\`:\n`;
      body += `  - ${link.url}\n`;
      if (link.status === "INTERNAL_NOT_FOUND") {
        body += `  - Status: Internal link not found\n`;
        if (link.attemptedPath) {
          body += `  - Attempted path: ${link.attemptedPath}\n`;
        }
      } else {
        body += `  - Status: ${link.status}\n`;
        if (link.error) {
          body += `  - Error: ${link.error}\n`;
        }
      }
    });
  }

  if (validLinks.length > 0) {
    body += "\n### ✅ Valid Links\n\n";
    const groupedByFile = {};
    validLinks.forEach((link) => {
      if (!groupedByFile[link.filename]) {
        groupedByFile[link.filename] = [];
      }
      groupedByFile[link.filename].push(link);
    });

    Object.entries(groupedByFile).forEach(([filename, links]) => {
      body += `**In \`${filename}\`:**\n`;
      links.forEach((link) => {
        if (link.status === "INTERNAL_ANCHOR") {
          body += `- ${link.url} (Anchor Link)\n`;
        } else if (link.status === "INTERNAL_OK") {
          body += `- ${link.url} → ${link.resolvedPath}\n`;
        } else {
          body += `- ${link.url}\n`;
        }
      });
      body += "\n";
    });
  }

  body += "\n*Generated by Link Checker* 🤖";
  return body;
}

// Create or update issue with link check results
async function createOrUpdateIssue(context, results) {
  const issueTitle = "🔍 Markdown Link Check Report";

  // Search for existing open issues
  const { data: existingIssues } = await context.octokit.issues.listForRepo({
    ...context.repo(),
    state: "open",
    creator: "app",
    labels: ["link-check"],
  });

  const issueBody = generateIssueBody(results);

  if (existingIssues.length > 0) {
    // Update existing issue
    await context.octokit.issues.update({
      ...context.repo(),
      issue_number: existingIssues[0].number,
      body: issueBody,
    });
    app.log.info(`Updated existing issue #${existingIssues[0].number}`);
  } else {
    // Create new issue
    await context.octokit.issues.create({
      ...context.repo(),
      title: issueTitle,
      body: issueBody,
      labels: ["link-check"],
    });
    app.log.info("Created new issue for broken links");
  }
}
