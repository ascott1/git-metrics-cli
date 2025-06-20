#!/usr/bin/env node

require("dotenv").config();
const { graphql } = require("@octokit/graphql");
const { Command } = require("commander");
const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const dayjs = require("dayjs");
const duration = require("dayjs/plugin/duration");
dayjs.extend(duration);

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

const minutesBetween = (start, end) =>
  (new Date(end) - new Date(start)) / 1000 / 60;
const median = (arr) => arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)];
const average = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

async function fetchMetricsWithGraphQL() {
  const { days } = program.opts();
  const [owner, repo] = program.opts().repo.split("/");

  let searchQuery = `repo:${owner}/${repo} is:pr`;
  if (days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    searchQuery += ` created:>=${since.toISOString().slice(0, 10)}`;
  }

  console.log("Fetching pull request data with GraphQL...");
  console.log(`(Query: ${searchQuery})`);

  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${process.env.GITHUB_TOKEN}`,
    },
  });

  const query = /* GraphQL */ `
    query ($searchQuery: String!, $cursor: String) {
      search(query: $searchQuery, type: ISSUE, first: 50, after: $cursor) {
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          __typename
          ... on PullRequest {
            number
            title
            createdAt
            mergedAt
            state
            author {
              login
            }
            reviews(first: 10) {
              nodes {
                author {
                  login
                  __typename
                }
                submittedAt
                body
              }
            }
            comments(first: 10) {
              nodes {
                author {
                  login
                  __typename
                }
                createdAt
              }
            }
            reviewThreads(first: 10) {
              nodes {
                comments(first: 10) {
                  nodes {
                    author {
                      login
                      __typename
                    }
                    createdAt
                  }
                }
              }
            }
            timelineItems(itemTypes: [REVIEW_REQUESTED_EVENT], first: 100) {
              totalCount
            }
          }
        }
      }
    }
  `;

  let allPRs = [];
  let hasNextPage = true;
  let cursor = null;
  let pageCount = 0;

  while (hasNextPage) {
    const response = await graphqlWithAuth(query, {
      searchQuery,
      cursor,
    });
    pageCount++;
    process.stdout.write(`\rFetched page ${pageCount}...`);

    const prs = response.search.nodes.filter(
      (pr) => pr.__typename === "PullRequest"
    );
    allPRs = allPRs.concat(prs);

    hasNextPage = response.search.pageInfo.hasNextPage;
    cursor = response.search.pageInfo.endCursor;
  }
  process.stdout.write("\n");
  console.log(`Found ${allPRs.length} total pull requests.`);

  console.log("\nProcessing metrics...");
  const metrics = allPRs.map((pr, index) => {
    process.stdout.write(
      `\r(${index + 1}/${allPRs.length}) Processing PR #${pr.number}`
    );
    const created = pr.createdAt;
    const merged = pr.mergedAt;
    const author = pr.author ? pr.author.login : null;

    const publishToMerge = merged ? minutesBetween(created, merged) : null;

    const firstReview = pr.reviews.nodes.find(
      (r) =>
        r.author && r.author.login !== author && r.author.__typename !== "Bot"
    );

    const commentDates = [];
    // Issue Comments
    const firstIssueComment = pr.comments.nodes.find(
      (c) =>
        c.author && c.author.login !== author && c.author.__typename !== "Bot"
    );
    if (firstIssueComment) {
      commentDates.push(new Date(firstIssueComment.createdAt));
    }

    // Review Comments (line comments)
    const reviewComments = pr.reviewThreads.nodes.flatMap(
      (thread) => thread.comments.nodes
    );
    const firstReviewComment = reviewComments.find(
      (c) =>
        c.author && c.author.login !== author && c.author.__typename !== "Bot"
    );
    if (firstReviewComment) {
      commentDates.push(new Date(firstReviewComment.createdAt));
    }

    // Review bodies
    const firstReviewWithBody = pr.reviews.nodes.find(
      (r) =>
        r.author &&
        r.author.login !== author &&
        r.author.__typename !== "Bot" &&
        r.body
    );
    if (firstReviewWithBody) {
      commentDates.push(new Date(firstReviewWithBody.submittedAt));
    }

    commentDates.sort((a, b) => a - b);
    const firstCommentDate = commentDates.length > 0 ? commentDates[0] : null;

    const cycleCount = pr.timelineItems.totalCount;

    return {
      number: pr.number,
      title: pr.title,
      publishToMerge,
      timeToFirstReview: firstReview
        ? minutesBetween(created, firstReview.submittedAt)
        : null,
      timeToFirstComment: firstCommentDate
        ? minutesBetween(created, firstCommentDate)
        : null,
      reviewCycles: cycleCount,
      state: pr.state,
    };
  });
  process.stdout.write("\n\n");
  return { metrics, allPRs };
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
      { id: "timeToFirstReview", title: "Time to First Review (mins)" },
      { id: "timeToFirstComment", title: "Time to First Comment (mins)" },
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
    }...
`
  );
  const { metrics, allPRs } = await fetchMetricsWithGraphQL();

  const openedPrCount = metrics.length;
  const closedNotMergedCount = allPRs.filter(
    (pr) => pr.state === "CLOSED" && !pr.mergedAt
  ).length;
  const publishToMerge = metrics.map((m) => m.publishToMerge).filter(Boolean);
  const timeToFirstReview = metrics
    .map((m) => m.timeToFirstReview)
    .filter(Boolean);
  const timeToFirstComment = metrics
    .map((m) => m.timeToFirstComment)
    .filter(Boolean);
  const reviewCycles = metrics.map((m) => m.reviewCycles).filter(Boolean);

  const formatDuration = (minutes) => {
    const d = dayjs.duration(minutes, "minutes");
    const days = Math.floor(d.asDays());
    const hours = d.hours();
    const mins = d.minutes();

    let result = "";
    if (days > 0) {
      result += `${days}d `;
    }
    if (hours > 0) {
      result += `${hours}h `;
    }
    if (mins > 0) {
      result += `${mins}m`;
    }

    return result.trim();
  };

  console.log("📈 Summary:");
  console.log(`Total PRs Opened: ${openedPrCount}`);
  console.log(`Total PRs Merged: ${publishToMerge.length}`);
  console.log(`Total PRs Closed (not merged): ${closedNotMergedCount}`);
  console.log(
    `Median Publish to Merge: ${formatDuration(median(publishToMerge))}`
  );
  console.log(
    `Median Time to First Review: ${formatDuration(median(timeToFirstReview))}`
  );
  console.log(
    `Median Time to First Comment: ${formatDuration(
      median(timeToFirstComment)
    )}`
  );
  console.log(`Average Review Cycles: ${average(reviewCycles).toFixed(2)}`);

  await saveResults(metrics);
})();
