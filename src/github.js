const { graphql } = require("@octokit/graphql");

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

async function fetchPullRequests(owner, repo, days) {
  let searchQuery = `repo:${owner}/${repo} is:pr`;
  if (days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    searchQuery += ` created:>=${since.toISOString().slice(0, 10)}`;
  }

  console.log("Fetching pull request data with GraphQL...");
  console.log(`(Query: ${searchQuery})`);

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
            additions
            deletions
            changedFiles
            author {
              login
            }
            firstCommit: commits(first: 1) {
              nodes {
                commit {
                  committedDate
                }
              }
            }
            lastCommit: commits(last: 1) {
              nodes {
                commit {
                  statusCheckRollup {
                    state
                  }
                }
              }
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
  return allPRs;
}

async function fetchIssues(owner, repo, labels, days) {
  const labelArray = labels.split(",").map((label) => label.trim());

  // Build search query for issues
  let searchQuery = `repo:${owner}/${repo} is:issue is:closed`;
  if (days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    searchQuery += ` closed:>=${since.toISOString().slice(0, 10)}`;
  }

  console.log("Fetching issue data with GraphQL...");
  console.log(`(Query: ${searchQuery})`);
  console.log(`Looking for labels: ${labelArray.join(", ")}`);

  const query = /* GraphQL */ `
    query ($searchQuery: String!, $cursor: String) {
      search(query: $searchQuery, type: ISSUE, first: 50, after: $cursor) {
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          __typename
          ... on Issue {
            number
            title
            createdAt
            closedAt
            state
            author {
              login
            }
            labels(first: 20) {
              nodes {
                name
              }
            }
          }
        }
      }
    }
  `;

  let allIssues = [];
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

    const issues = response.search.nodes.filter(
      (issue) => issue.__typename === "Issue"
    );
    allIssues = allIssues.concat(issues);

    hasNextPage = response.search.pageInfo.hasNextPage;
    cursor = response.search.pageInfo.endCursor;
  }

  process.stdout.write("\n");
  console.log(`Found ${allIssues.length} total closed issues.`);

  return { allIssues, targetLabels: labelArray };
}

module.exports = { fetchPullRequests, fetchIssues };
