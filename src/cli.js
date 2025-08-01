const { Command } = require("commander");

function parseOptions() {
  const program = new Command();
  program
    .requiredOption("-r, --repo <repo>", "GitHub repo in the form org/repo")
    .option(
      "-d, --days <days>",
      "Number of days to look back for pull requests",
      parseInt
    )
    .option("--no-date", "Do not append the date to the output filenames")
    .option(
      "--exclude-hotfixes",
      'Exclude pull requests with "hotfix" in the title'
    )
    .option(
      "--large-loc-threshold <lines>",
      "Number of lines of code (additions + deletions) to consider a PR large",
      parseInt,
      400
    )
    .option(
      "--large-files-threshold <files>",
      "Number of changed files to consider a PR large",
      parseInt,
      15
    )
    .option("--issues", "Collect issue metrics instead of pull request metrics")
    .option(
      "--labels <labels>",
      "Comma-separated list of GitHub issue labels to analyze (requires --issues flag)"
    );
  program.parse(process.argv);
  return program.opts();
}

module.exports = { parseOptions };
