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
- `-d, --days <days>`: (Optional) The number of days to look back for pull requests. If not specified, all pull requests will be fetched.

### Examples

- Collect metrics for all pull requests in a repository:

  ```bash
  node index.js -r microsoft/vscode
  ```

- Collect metrics for pull requests created in the last 30 days:
  ```bash
  node index.js -r microsoft/vscode -d 30
  ```

## Output

The script will generate two files:

- `metrics.json`: A JSON file containing the raw metric data for each pull request.
- `metrics.csv`: A CSV file with a summary of the metrics for each pull request.

It will also print a summary of the median and average metrics to the console.
