"use strict";

const path = require("path");
const { Octokit } = require("@octokit/rest");

/**
 * Open a pull request that adds the rendered Monaco service folder.
 *
 * Flow (Contents API, no local git needed):
 *   1. read default branch HEAD sha
 *   2. create a feature branch
 *   3. create each rendered file on that branch
 *   4. open a PR back to the default branch using the PR template body
 *
 * Requires env GITHUB_TOKEN (repo scope) and GITHUB_REPOSITORY="owner/name".
 */
async function openServicePR({ normalized, files, prBody }) {
  const token = process.env.GITHUB_TOKEN;
  const repoFull = process.env.GITHUB_REPOSITORY;
  if (!token || !repoFull) {
    throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY must be set to open a PR");
  }
  const [owner, repo] = repoFull.split("/");
  const octokit = new Octokit({ auth: token });

  const { data: repoInfo } = await octokit.repos.get({ owner, repo });
  const base = repoInfo.default_branch;
  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${base}` });
  const baseSha = ref.object.sha;

  const branch = `oaac/${normalized.configId}-${Date.now()}`;
  await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: baseSha });

  for (const f of files) {
    await octokit.repos.createOrUpdateFileContents({
      owner, repo,
      path: f.relPath,
      message: `oaac: add ${normalized.serviceName} (${path.basename(f.relPath)})`,
      content: Buffer.from(f.content, "utf8").toString("base64"),
      branch
    });
  }

  const { data: pr } = await octokit.pulls.create({
    owner, repo,
    title: `[OaC] Instrument ${normalized.serviceName} (${normalized.severity})`,
    head: branch,
    base,
    body: prBody
  });

  return { url: pr.html_url, number: pr.number, branch };
}

module.exports = { openServicePR };
