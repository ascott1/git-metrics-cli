const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const dayjs = require("dayjs");
const duration = require("dayjs/plugin/duration");
dayjs.extend(duration);

const median = (arr) => {
  if (arr.length === 0) return null;
  const sorted = arr.sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

const average = (arr) => {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

async function saveResults(data, options) {
  const { date } = options;
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
      { id: "state", title: "State" },
      { id: "ciPassed", title: "CI Passed" },
      { id: "isLarge", title: "Is Large PR" },
      { id: "publishToMerge", title: "Publish to Merge (mins)" },
      { id: "leadTimeForChanges", title: "Lead Time for Changes (mins)" },
      { id: "timeToFirstReview", title: "Time to First Review (mins)" },
      { id: "timeToFirstComment", title: "Time to First Comment (mins)" },
      { id: "reviewCycles", title: "Review Cycles" },
    ],
  });

  await csvWriter.writeRecords(data);
  console.log(`Results saved to ${csvPath}`);
}

function printSummary(metrics, allPRs) {
  const openedPrCount = metrics.length;
  const mergedPrCount = metrics.filter((m) => m.state === "MERGED").length;
  const closedNotMergedCount = allPRs.filter(
    (pr) => pr.state === "CLOSED" && !pr.mergedAt
  ).length;
  const mergedWithoutCIPassingCount = metrics.filter(
    (m) => m.state === "MERGED" && !m.ciPassed
  ).length;
  const largePrCount = metrics.filter((m) => m.isLarge).length;
  const publishToMerge = metrics.map((m) => m.publishToMerge).filter(Boolean);
  const leadTimeForChanges = metrics
    .map((m) => m.leadTimeForChanges)
    .filter(Boolean);
  const timeToFirstReview = metrics
    .map((m) => m.timeToFirstReview)
    .filter(Boolean);
  const timeToFirstComment = metrics
    .map((m) => m.timeToFirstComment)
    .filter(Boolean);
  const reviewCycles = metrics.map((m) => m.reviewCycles);

  const formatDuration = (minutes) => {
    if (minutes === null || minutes === undefined) return "N/A";
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
    if (mins > 0 || result === "") {
      result += `${Math.round(mins)}m`;
    }

    return result.trim();
  };

  console.log("\n📈 Summary:");
  console.log(`Total PRs Opened: ${openedPrCount}`);
  console.log(`Total PRs Merged: ${mergedPrCount}`);
  console.log(`Total PRs Closed (not merged): ${closedNotMergedCount}`);
  console.log(`PRs Merged Without CI Passing: ${mergedWithoutCIPassingCount}`);
  console.log(`Total Large PRs: ${largePrCount}`);
  console.log(
    `Median Publish to Merge: ${formatDuration(median(publishToMerge))}`
  );
  console.log(
    `Median Lead Time for Changes: ${formatDuration(
      median(leadTimeForChanges)
    )}`
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
}

module.exports = { saveResults, printSummary };
