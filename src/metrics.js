const minutesBetween = (start, end) =>
  (new Date(end) - new Date(start)) / 1000 / 60;

function calculateMetrics(allPRs, options) {
  console.log("\nProcessing metrics...");
  const metrics = allPRs.map((pr, index) => {
    process.stdout.write(
      `\r(${index + 1}/${allPRs.length}) Processing PR #${pr.number}`
    );
    const created = pr.createdAt;
    const merged = pr.mergedAt;
    const author = pr.author ? pr.author.login : null;
    const firstCommitDate = pr.firstCommit.nodes[0]?.commit.committedDate;

    const publishToMerge = merged ? minutesBetween(created, merged) : null;
    const leadTimeForChanges =
      merged && firstCommitDate
        ? minutesBetween(firstCommitDate, merged)
        : null;

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

    const lastCommit = pr.lastCommit.nodes[0]?.commit;
    const ciStatus = lastCommit?.statusCheckRollup?.state;

    const totalLinesChanged = pr.additions + pr.deletions;
    const isLarge =
      totalLinesChanged >= options.largeLocThreshold ||
      pr.changedFiles > options.largeFilesThreshold;

    return {
      number: pr.number,
      title: pr.title,
      publishToMerge,
      leadTimeForChanges,
      timeToFirstReview: firstReview
        ? minutesBetween(created, firstReview.submittedAt)
        : null,
      timeToFirstComment: firstCommentDate
        ? minutesBetween(created, firstCommentDate)
        : null,
      reviewCycles: cycleCount,
      state: pr.state,
      ciPassed: ciStatus === "SUCCESS",
      isLarge,
    };
  });
  process.stdout.write("\n\n");
  return metrics;
}

module.exports = { calculateMetrics };
