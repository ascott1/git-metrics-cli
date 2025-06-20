#!/usr/bin/env node

require("dotenv").config();
const { parseOptions } = require("./src/cli");
const { fetchPullRequests } = require("./src/github");
const { calculateMetrics } = require("./src/metrics");
const { saveResults, printSummary } = require("./src/output");

async function main() {
  if (!process.env.GITHUB_TOKEN) {
    console.error("Error: GITHUB_TOKEN environment variable not set.");
    console.error("Please create a .env file with GITHUB_TOKEN=<your-token>");
    process.exit(1);
  }

  const options = parseOptions();
  const [owner, repo] = options.repo.split("/");

  console.log(
    `Starting metric collection for ${owner}/${repo}${
      options.days ? ` (last ${options.days} days)` : ""
    }...
`
  );

  let allPRs = await fetchPullRequests(owner, repo, options.days);

  if (options.excludeHotfixes) {
    const initialCount = allPRs.length;
    allPRs = allPRs.filter((pr) => !pr.title.toLowerCase().includes("hotfix"));
    console.log(`\nFiltered out ${initialCount - allPRs.length} hotfix PRs.`);
  }

  const metrics = calculateMetrics(allPRs);

  printSummary(metrics, allPRs);
  await saveResults(metrics, options);
}

main().catch((error) => {
  console.error("\nAn unexpected error occurred:", error);
  process.exit(1);
});
