# GitHub Pull Request Metrics

This script collects pull request metrics from a GitHub repository and outputs them to JSON and CSV files.

## Setup

1.  Install the dependencies:

    ```bash
    npm install
    ```

2.  Create a `.env` file in the root of the project and add your GitHub personal access token:
    ```
    GITHUB_TOKEN=<your-token>
    ```

## Usage

```bash
node index.js -r <owner>/<repo> [options]
```

### Options

- `-r, --repo <repo>`: **(Required)** The GitHub repository in the format `owner/repo`.
- `-d, --days <days>`: (Optional) The number of days to look back for pull requests or issues. If not specified, all pull requests/issues will be fetched.
- `--exclude-hotfixes`: (Optional) Exclude pull requests with "hotfix" in the title.
- `--issues`: (Optional) Collect issue metrics instead of pull request metrics.
- `--labels <labels>`: (Optional) Comma-separated list of GitHub issue labels to analyze (requires `--issues` flag). Label matching is case-insensitive.

### Examples

#### Pull Request Metrics (Default Mode)

- Collect metrics for all pull requests in a repository:

  ```bash
  node index.js -r microsoft/vscode
  ```

- Collect metrics for pull requests created in the last 30 days:

  ```bash
  node index.js -r microsoft/vscode -d 30
  ```

- Collect metrics, excluding "hotfix" PRs:
  ```bash
  node index.js -r microsoft/vscode --exclude-hotfixes
  ```

#### Issue Metrics Mode

- Collect metrics for issues with specific labels:

  ```bash
  node index.js -r microsoft/vscode --issues --labels "bug,enhancement"
  ```

- Collect metrics for issues with labels closed in the last 30 days:
  ```bash
  node index.js -r microsoft/vscode --issues --labels "bug,performance" -d 30
  ```

## Output

### Pull Request Metrics

When collecting PR metrics (default mode), the script will generate two files:

- `metrics.json`: A JSON file containing the raw metric data for each pull request.
- `metrics.csv`: A CSV file with a summary of the metrics for each pull request.

It will also print a summary of the median and average metrics to the console.

### Issue Metrics

When collecting issue metrics (`--issues` flag), the script will generate:

- `issue-metrics.json`: A JSON file containing the issue analysis data.
- `issue-metrics.csv`: A CSV file with details of issues matching the specified labels.

The console output will show:

- Total number of closed issues (for percentage context)
- Issues with ANY of the specified labels
- Issues with ALL specified labels (when multiple labels are provided)
- Breakdown by individual labels
- Issues containing only specific labels vs. multiple target labels
