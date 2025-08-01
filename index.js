#!/usr/bin/env node

require("dotenv").config();
const { parseOptions } = require("./src/cli");
const { fetchPullRequests, fetchIssues } = require("./src/github");
const { calculateMetrics, calculateIssueMetrics } = require("./src/metrics");
const {
  saveResults,
  printSummary,
  saveIssueResults,
  printIssueSummary,
} = require("./src/output");

async function main() {
  if (!process.env.GITHUB_TOKEN) {
    console.error("Error: GITHUB_TOKEN environment variable not set.");
    console.error("Please create a .env file with GITHUB_TOKEN=<your-token>");
    process.exit(1);
  }

  const options = parseOptions();

  // Validate options
  if (options.issues && !options.labels) {
    console.error(
      "Error: --labels option is required when using --issues flag."
    );
    process.exit(1);
  }

  if (options.labels && !options.issues) {
    console.error(
      "Error: --labels option can only be used with --issues flag."
    );
    process.exit(1);
  }

  const [owner, repo] = options.repo.split("/");

  if (options.issues) {
    // Issues mode
    console.log(
      `Starting issue metric collection for ${owner}/${repo}${
        options.days ? ` (last ${options.days} days)` : ""
      }...
    `
    );

    const { allIssues, targetLabels } = await fetchIssues(
      owner,
      repo,
      options.labels,
      options.days
    );
    const issueMetrics = calculateIssueMetrics(allIssues, targetLabels);

    printIssueSummary(issueMetrics);
    await saveIssueResults(issueMetrics, options);
  } else {
    // PR mode (existing functionality)
    console.log(
      `Starting metric collection for ${owner}/${repo}${
        options.days ? ` (last ${options.days} days)` : ""
      }...
    `
    );

    let allPRs = await fetchPullRequests(owner, repo, options.days);

    if (options.excludeHotfixes) {
      const initialCount = allPRs.length;
      allPRs = allPRs.filter(
        (pr) => !pr.title.toLowerCase().includes("hotfix")
      );
      console.log(`\nFiltered out ${initialCount - allPRs.length} hotfix PRs.`);
    }

    const metrics = calculateMetrics(allPRs, options);

    printSummary(metrics, allPRs);
    await saveResults(metrics, options);
  }
}

main().catch((error) => {
  console.error("\nAn unexpected error occurred:", error);
  process.exit(1);
});
