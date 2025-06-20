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
    .option("--no-date", "Do not append the date to the output filenames");
  program.parse(process.argv);
  return program.opts();
}

module.exports = { parseOptions };
