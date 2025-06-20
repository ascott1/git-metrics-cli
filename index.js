#!/usr/bin/env node

require("dotenv").config();
const { Octokit } = require("@octokit/rest");
const { Command } = require("commander");
const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const program = new Command();
program
  .requiredOption("-r, --repo <repo>", "GitHub repo in the form org/repo")
  .option(
    "-d, --days <days>",
    "Number of days to look back for pull requests",
    parseInt
  )
  .option("--no-date", "Do not append the date to the output filenames");
program.parse(process.argv);

const [owner, repo] = program.opts().repo.split("/");

if (!process.env.GITHUB_TOKEN) {
  console.error("Error: GITHUB_TOKEN environment variable not set.");
  console.error("Please create a .env file with GITHUB_TOKEN=<your-token>");
  process.exit(1);
}

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const minutesBetween = (start, end) =>
  (new Date(end) - new Date(start)) / 1000 / 60;
const median = (arr) => arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)];
const average = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

async function getMergedPullRequests() {
  const { days } = program.opts();
  const prs = [];
  console.log("Fetching merged pull requests...");
  if (days) {
    console.log(`(Looking back ${days} days)`);
  }

  const since = days ? new Date() : null;
  if (since) {
    since.setDate(since.getDate() - days);
  }

  let keepFetching = true;

  for await (const response of octokit.paginate.iterator(octokit.pulls.list, {
    owner,
    repo,
    state: "closed",
    per_page: 100,
  })) {
    if (!keepFetching) break;

    const merged = response.data.filter((pr) => pr.merged_at);

    for (const pr of merged) {
      if (since && new Date(pr.created_at) < since) {
        keepFetching = false;
        break;
      }
      prs.push(pr);
    }

    process.stdout.write(`\rFetched ${prs.length} pull requests...`);
  }
  process.stdout.write("\n");

  console.log(
    `Found ${prs.length} merged pull requests${
      days ? ` in the last ${days} days` : ""
    }.`
  );
  return prs;
}

async function collectMetrics() {
  const prs = await getMergedPullRequests();
  const output = [];

  console.log("\nCollecting metrics for each pull request...");
  for (const [index, pr] of prs.entries()) {
    process.stdout.write(
      `\r(${index + 1}/${prs.length}) Processing PR #${pr.number}`
    );
    const created = pr.created_at;
    const merged = pr.merged_at;

    const publishToMerge = minutesBetween(created, merged);

    const [reviews, comments, events] = await Promise.all([
      octokit.pulls.listReviews({ owner, repo, pull_number: pr.number }),
      octokit.pulls.listReviewComments({ owner, repo, pull_number: pr.number }),
      octokit.issues.listEvents({ owner, repo, issue_number: pr.number }),
    ]);

    const firstReview = reviews.data.find(
      (r) => r.user.login !== pr.user.login && r.user.type !== "Bot"
    );
    const firstComment = comments.data.find(
      (c) => c.user.login !== pr.user.login && c.user.type !== "Bot"
    );
    const cycleCount = events.data.filter(
      (e) => e.event === "review_requested"
    ).length;

    output.push({
      number: pr.number,
      title: pr.title,
      publishToMerge,
      waitToFirstReview: firstReview
        ? minutesBetween(created, firstReview.submitted_at)
        : null,
      reviewResponseTime: firstComment
        ? minutesBetween(created, firstComment.created_at)
        : null,
      reviewCycles: cycleCount,
    });
  }
  process.stdout.write("\n\n");
  return output;
}

async function saveResults(data) {
  const { date } = program.opts();
  const folder = "metrics";
  const dateSuffix = date ? `-${new Date().toISOString().slice(0, 10)}` : "";
  const jsonPath = `${folder}/metrics${dateSuffix}.json`;
  const csvPath = `${folder}/metrics${dateSuffix}.csv`;

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  console.log(`\nResults saved to ${jsonPath}`);

  const csvWriter = createCsvWriter({
    path: csvPath,
    header: [
      { id: "number", title: "PR Number" },
      { id: "title", title: "Title" },
      { id: "publishToMerge", title: "Publish to Merge (mins)" },
      { id: "waitToFirstReview", title: "Wait to First Review (mins)" },
      { id: "reviewResponseTime", title: "Review Response Time (mins)" },
      { id: "reviewCycles", title: "Review Cycles" },
    ],
  });

  await csvWriter.writeRecords(data);
  console.log(`Results saved to ${csvPath}`);
}

(async () => {
  const { days } = program.opts();
  console.log(
    `Starting metric collection for ${owner}/${repo}${
      days ? ` (last ${days} days)` : ""
    }...\n`
  );
  const metrics = await collectMetrics();

  const publishToMerge = metrics.map((m) => m.publishToMerge).filter(Boolean);
  const waitToFirstReview = metrics
    .map((m) => m.waitToFirstReview)
    .filter(Boolean);
  const reviewResponseTime = metrics
    .map((m) => m.reviewResponseTime)
    .filter(Boolean);
  const reviewCycles = metrics.map((m) => m.reviewCycles).filter(Boolean);

  console.log("📈 Summary:");
  console.log(
    `Median Publish to Merge: ${median(publishToMerge).toFixed(2)} mins`
  );
  console.log(
    `Median Wait to First Review: ${median(waitToFirstReview).toFixed(2)} mins`
  );
  console.log(
    `Median Review Response Time: ${median(reviewResponseTime).toFixed(2)} mins`
  );
  console.log(`Average Review Cycles: ${average(reviewCycles).toFixed(2)}`);

  await saveResults(metrics);
})();
