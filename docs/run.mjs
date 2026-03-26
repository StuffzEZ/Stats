// run.mjs — Stats auto-update script
// Served from stuffzez.github.io/Stats/run.mjs
// Downloaded by profile repo workflows to update README + submit txtdb PR

import { Octokit } from "@octokit/rest";
import { readFileSync, writeFileSync, existsSync } from "fs";

const octokit  = new Octokit({ auth: process.env.GH_PAT });
const username = process.env.GITHUB_USERNAME;
const now      = new Date().toISOString();

const opt = {
  privateRepos:   process.env.SHOW_PRIVATE_REPOS   === "true",
  allOrgs:        process.env.SHOW_ALL_ORGS        === "true",
  privateCommits: process.env.SHOW_PRIVATE_COMMITS === "true",
  customNotes:    process.env.SHOW_CUSTOM_NOTES    === "true",
  pinnedOverride: process.env.SHOW_PINNED_OVERRIDE === "true",
};

const pinned = [1,2,3,4,5,6]
  .map(i => process.env[`PINNED_${i}`]).filter(Boolean);

const custom = {
  website:  process.env.CUSTOM_WEBSITE  || "",
  bio:      process.env.CUSTOM_BIO      || "",
  pronouns: process.env.CUSTOM_PRONOUNS || "",
  hire:     process.env.CUSTOM_HIRE     || "",
  note:     process.env.CUSTOM_NOTE     || "",
};

const statsRepoOwner = process.env.STATS_REPO_OWNER || "StuffzEZ";
const statsRepoName  = process.env.STATS_REPO_NAME  || "Stats";

// ── Helpers ──────────────────────────────────────────────────────────────────
const pad     = n => String(n).padStart(2, "0");
const fmt     = iso => { const d=new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const daysAgo = iso => Math.floor((Date.now()-new Date(iso))/86_400_000);

const LANG_LOGOS = {
  JavaScript:"javascript", TypeScript:"typescript", Python:"python",
  Rust:"rust", Go:"go", "C++":"cplusplus", "C#":"csharp", Java:"java",
  Ruby:"ruby", PHP:"php", Swift:"swift", Kotlin:"kotlin", Dart:"dart",
  HTML:"html5", CSS:"css3", Shell:"gnubash", Vue:"vuedotjs", React:"react",
};

function langBadges(langs) {
  const t = Object.values(langs).reduce((a,b) => a+b, 0);
  if (!t) return "—";
  return Object.entries(langs).sort((a,b) => b[1]-a[1]).slice(0,3)
    .map(([l]) => `![${l}](https://img.shields.io/badge/-${encodeURIComponent(l)}-05122A?style=flat-square&logo=${LANG_LOGOS[l]||l.toLowerCase()})`)
    .join(" ");
}

// ── Fetchers ─────────────────────────────────────────────────────────────────
async function fetchUser() {
  try { const{data}=await octokit.users.getAuthenticated(); return data; }
  catch { const{data}=await octokit.users.getByUsername({username}); return data; }
}

async function fetchRepos() {
  return (await octokit.paginate(octokit.repos.listForUser, {
    username, type:"owner", sort:"pushed", per_page:100,
  })).filter(r => !r.fork);
}

async function fetchAllReposWithPrivate() {
  try {
    return await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
      visibility:"all", affiliation:"owner", sort:"pushed", per_page:100,
    });
  } catch { return []; }
}

async function fetchLanguages(repo) {
  try { const{data}=await octokit.repos.listLanguages({owner:username, repo}); return data; }
  catch { return {}; }
}

async function countCommits(repos) {
  let total = 0;
  for (const repo of repos) {
    try {
      const res = await octokit.request("GET /repos/{owner}/{repo}/commits", {
        owner: username, repo: repo.name, author: username, per_page: 1,
      });
      const m = (res.headers.link||"").match(/page=(\d+)>; rel="last"/);
      total += m ? parseInt(m[1]) : res.data.length;
    } catch {}
  }
  return total;
}

async function fetchPublicOrgs() {
  try { const{data}=await octokit.orgs.listForUser({username, per_page:100}); return data; }
  catch { return []; }
}

async function fetchAllOrgs() {
  try { const{data}=await octokit.orgs.listForAuthenticatedUser({per_page:100}); return data; }
  catch { return fetchPublicOrgs(); }
}

async function fetchActivity() {
  try { const{data}=await octokit.activity.listPublicEventsForUser({username, per_page:15}); return data; }
  catch { return []; }
}

async function fetchIssues() {
  try {
    return (await octokit.paginate(octokit.issues.listForAuthenticatedUser, {
      filter:"created", state:"open", per_page:100,
    })).filter(i => !i.pull_request);
  } catch { return []; }
}

async function fetchPRs() {
  try {
    const{data}=await octokit.search.issuesAndPullRequests({
      q:`author:${username} type:pr state:open`, per_page:20,
    });
    return data.items;
  } catch { return []; }
}

// ── README section builders ───────────────────────────────────────────────────
function buildHeader(u) {
  const bio  = u.bio ? `\n> ${u.bio}\n` : "";
  const loc  = u.location ? `📍 **${u.location}**` : "";
  const blog = u.blog ? `🌐 [${u.blog}](${u.blog.startsWith("http")?u.blog:"https://"+u.blog})` : "";
  const tw   = u.twitter_username ? `🐦 [@${u.twitter_username}](https://twitter.com/${u.twitter_username})` : "";
  const statsLink = `[📊 Full Stats Dashboard](https://stuffzez.github.io/Stats/stats.html?user=${username})`;
  const links = [loc, blog, tw].filter(Boolean).join(" · ");
  return [
    `<div align="center">`, ``,
    `# 👋 Hi, I'm ${u.name||username}`,
    bio, links, ``,
    `[![Profile Views](https://komarev.com/ghpvc/?username=${username}&color=6366f1&style=flat-square&label=Profile+Views)](https://github.com/${username})`,
    `[![Followers](https://img.shields.io/github/followers/${username}?label=Followers&style=flat-square&color=6366f1&logo=github)](https://github.com/${username}?tab=followers)`,
    `[![Stars](https://img.shields.io/github/stars/${username}?affiliations=OWNER&style=flat-square&color=f59e0b&logo=github&label=Stars)](https://github.com/${username})`,
    ``, statsLink, ``, `</div>`, ``, `---`, ``,
  ].join("\n");
}

function buildStats(u, commits, repos, issues, prs, orgs) {
  const stars   = repos.reduce((s,r) => s+r.stargazers_count, 0);
  const forks   = repos.reduce((s,r) => s+r.forks_count, 0);
  const updated = new Date().toUTCString();
  return [
    `## 📊 GitHub Stats`, ``, `<div align="center">`, ``,
    `<img src="https://github-readme-stats.vercel.app/api?username=${username}&show_icons=true&theme=tokyonight&hide_border=true&count_private=true&include_all_commits=true" height="160"/>`,
    `&nbsp;`,
    `<img src="https://github-readme-stats.vercel.app/api/top-langs/?username=${username}&layout=compact&theme=tokyonight&hide_border=true&langs_count=6" height="160"/>`, ``,
    `<img src="https://github-readme-streak-stats.herokuapp.com/?user=${username}&theme=tokyonight&hide_border=true" height="150"/>`, ``, `</div>`, ``,
    `<div align="center">`, ``,
    `![Repos](https://img.shields.io/badge/Repos-${u.public_repos}-6366f1?style=for-the-badge)`,
    `![Stars](https://img.shields.io/badge/Stars-${stars}-f59e0b?style=for-the-badge)`,
    `![Forks](https://img.shields.io/badge/Forks-${forks}-f97316?style=for-the-badge)`,
    `![Commits](https://img.shields.io/badge/Commits-${commits}%2B-22c55e?style=for-the-badge)`,
    `![Issues](https://img.shields.io/badge/Issues-${issues.length}-ef4444?style=for-the-badge)`,
    `![PRs](https://img.shields.io/badge/PRs-${prs.length}-8b5cf6?style=for-the-badge)`,
    `![Orgs](https://img.shields.io/badge/Orgs-${orgs.length}-0ea5e9?style=for-the-badge)`,
    `![Followers](https://img.shields.io/badge/Followers-${u.followers}-ec4899?style=for-the-badge)`,
    ``, `</div>`, ``, `<sub>🕒 Last updated: ${updated}</sub>`, ``, `---`, ``,
  ].join("\n");
}

function buildProjects(repos, languages, max=10) {
  const list = (opt.pinnedOverride && pinned.length)
    ? pinned.map(n => repos.find(r => r.name===n)).filter(Boolean)
        .concat(repos.filter(r => !pinned.includes(r.name))).slice(0, max)
    : repos.slice(0, max);
  const rows = list.map(r => {
    const l  = langBadges(languages[r.name]||{});
    const d  = (r.description||"—").replace(/\|/g,"\\|").slice(0,55);
    const sb = r.stargazers_count > 0
      ? `![](https://img.shields.io/github/stars/${username}/${r.name}?style=flat-square&color=f59e0b&label=⭐)`
      : "—";
    return `| [**\`${r.name}\`**](${r.html_url}) | ${d} | ${l} | ${sb} | \`${fmt(r.pushed_at)}\` |`;
  });
  return [
    `## 📦 Recent Projects`, ``,
    `| Repository | Description | Stack | Stars | Last Push |`,
    `|------------|-------------|:-----:|:-----:|:---------:|`,
    ...rows, ``, `---`, ``,
  ].join("\n");
}

function buildActivity(events) {
  const map = {
    PushEvent:         e => `\`📦 Push\` → [\`${e.repo.name}\`](https://github.com/${e.repo.name})`,
    CreateEvent:       e => `\`✨ Create\` → ${e.payload.ref_type} in [\`${e.repo.name}\`](https://github.com/${e.repo.name})`,
    IssuesEvent:       e => `\`🐛 Issue\` → ${e.payload.action} in [\`${e.repo.name}\`](https://github.com/${e.repo.name})`,
    PullRequestEvent:  e => `\`🔀 PR\` → ${e.payload.action} in [\`${e.repo.name}\`](https://github.com/${e.repo.name})`,
    WatchEvent:        e => `\`⭐ Star\` → [\`${e.repo.name}\`](https://github.com/${e.repo.name})`,
    ForkEvent:         e => `\`🍴 Fork\` → [\`${e.repo.name}\`](https://github.com/${e.repo.name})`,
    IssueCommentEvent: e => `\`💬 Comment\` → [\`${e.repo.name}\`](https://github.com/${e.repo.name})`,
    ReleaseEvent:      e => `\`🚀 Release\` → [\`${e.repo.name}\`](https://github.com/${e.repo.name})`,
  };
  const rows = events.filter(e => map[e.type]).slice(0,8)
    .map(e => `| ${map[e.type](e)} | \`${fmt(e.created_at)}\` |`);
  if (!rows.length) return `## ⚡ Recent Activity\n\n*No recent activity.*\n\n---\n\n`;
  return [`## ⚡ Recent Activity`, ``, `| Event | Date |`, `|-------|:----:|`, ...rows, ``, `---`, ``].join("\n");
}

function buildIssues(issues) {
  if (!issues.length) return `## 🐛 Open Issues\n\n![](https://img.shields.io/badge/Open%20Issues-0-brightgreen?style=for-the-badge)\n\n---\n\n`;
  const rows = issues.slice(0,8).map(i => {
    const repo = i.repository_url.replace("https://api.github.com/repos/","");
    const age  = daysAgo(i.created_at);
    const c    = age<7?"brightgreen":age<30?"yellow":"red";
    return `| [${i.title.replace(/\|/g,"\\|").slice(0,55)}](${i.html_url}) | [\`${repo}\`](https://github.com/${repo}) | ![](https://img.shields.io/badge/${age}d-open-${c}?style=flat-square) |`;
  });
  return [`## 🐛 Open Issues`, ``, `| Title | Repository | Age |`, `|-------|------------|:---:|`, ...rows, ``, `---`, ``].join("\n");
}

function buildPRs(prs) {
  if (!prs.length) return `## 🔀 Open Pull Requests\n\n![](https://img.shields.io/badge/Open%20PRs-0-brightgreen?style=for-the-badge)\n\n---\n\n`;
  const rows = prs.slice(0,8).map(pr => {
    const repo = pr.repository_url.replace("https://api.github.com/repos/","");
    const age  = daysAgo(pr.created_at);
    return `| [${pr.title.replace(/\|/g,"\\|").slice(0,55)}](${pr.html_url}) | [\`${repo}\`](https://github.com/${repo}) | \`${age}d ago\` |`;
  });
  return [`## 🔀 Open Pull Requests`, ``, `| Title | Repository | Age |`, `|-------|------------|:---:|`, ...rows, ``, `---`, ``].join("\n");
}

function buildOrgs(orgs) {
  if (!orgs.length) return "";
  const avs = orgs.map(o =>
    `<a href="https://github.com/${o.login}" title="${o.login}"><img src="${o.avatar_url}&s=60" width="60" height="60" alt="${o.login}" style="border-radius:12px;margin:4px"/></a>`
  ).join("\n");
  return [`## 🏢 Organisations`, ``, `<div align="center">`, ``, avs, ``, `</div>`, ``, `---`, ``].join("\n");
}

function inject(readme, marker, content) {
  const s     = `<!-- ${marker}:START -->`;
  const e     = `<!-- ${marker}:END -->`;
  const block = `${s}\n${content}\n${e}`;
  return readme.includes(s)
    ? readme.replace(new RegExp(`${s}[\\s\\S]*?${e}`), block)
    : readme + "\n" + block + "\n";
}

// ── txtdb builder ─────────────────────────────────────────────────────────────
function buildTxtdb(user, repos, allRepos, publicOrgs, allOrgs, commits, privateCommits) {
  const totalStars      = repos.reduce((s,r) => s+r.stargazers_count, 0);
  const totalForks      = repos.reduce((s,r) => s+r.forks_count, 0);
  const privateRepoCount = allRepos.filter(r => r.private).length;
  const memberDays      = Math.floor((Date.now()-new Date(user.created_at))/86_400_000);

  const orgsToShow = opt.allOrgs ? allOrgs : publicOrgs;
  const orgsBlock  = orgsToShow.map((o,i) => {
    const isPublic = publicOrgs.some(p => p.id===o.id);
    return [
      `org_${i+1}_login = ${o.login}`,
      `org_${i+1}_name = ${o.description||o.login}`,
      `org_${i+1}_avatar = ${o.avatar_url}`,
      `org_${i+1}_public = ${isPublic}`,
      `org_${i+1}_visible = true`,
    ].join("\n");
  }).join("\n\n");

  const pinnedBlock = pinned.length
    ? pinned.map((p,i) => `pin_${i+1} = ${p}`).join("\n")
    : "# No pinned overrides set";

  const customBlock = [
    custom.website  ? `website = ${custom.website}`        : "# website =",
    custom.bio      ? `bio_override = ${custom.bio}`       : "# bio_override =",
    custom.pronouns ? `pronouns = ${custom.pronouns}`      : "# pronouns =",
    custom.hire     ? `hire_status = ${custom.hire}`       : "# hire_status =",
    custom.note     ? `note = ${custom.note}`              : "# note =",
  ].join("\n");

  return `# txtdb for ${username}
# Auto-generated by profile workflow — do not edit [meta] or [public_stats] manually.
# You CAN manually edit: [opted_in], [pinned_projects], [custom]
# Docs: https://stuffzez.github.io/Stats/docs/txtdb.html
# ─────────────────────────────────────────────────────────────────────────────

[meta]
username = ${username}
display_name = ${user.name||username}
last_updated = ${now}
workflow_version = 2.1.0
stats_page = https://stuffzez.github.io/Stats/stats.html?user=${username}
account_url = https://github.com/${username}
avatar_url = ${user.avatar_url}

[public_stats]
public_repos = ${user.public_repos}
public_gists = ${user.public_gists}
followers = ${user.followers}
following = ${user.following}
total_stars = ${totalStars}
total_forks = ${totalForks}
public_commits_est = ${commits}
account_created = ${fmt(user.created_at)}
member_since_days = ${memberDays}
location = ${user.location||""}
bio = ${(user.bio||"").replace(/\n/g," ")}
blog = ${user.blog||""}
twitter = ${user.twitter_username||""}
company = ${user.company||""}

[opted_in]
show_private_repo_count = ${opt.privateRepos}
show_all_orgs = ${opt.allOrgs}
show_private_commit_count = ${opt.privateCommits}
show_custom_notes = ${opt.customNotes}
show_pinned_override = ${opt.pinnedOverride}

[private_stats]
${opt.privateRepos   ? `private_repos = ${privateRepoCount}` : "# private_repos = (not opted in)"}
${opt.privateCommits ? `total_commits_including_private = ${privateCommits}` : "# total_commits_including_private = (not opted in)"}

[orgs]
# ${opt.allOrgs ? `All orgs (including private memberships) — ${orgsToShow.length} total` : `Public orgs only — ${orgsToShow.length} total`}
${orgsBlock || "# No organisations"}

[pinned_projects]
${opt.pinnedOverride ? pinnedBlock : "# Pinned override not enabled"}

[custom]
${opt.customNotes ? customBlock : "# Custom notes not opted in"}
`;
}

// ── Submit txtdb PR ───────────────────────────────────────────────────────────
async function submitTxtdbPR(txtdbContent) {
  const owner  = statsRepoOwner;
  const repo   = statsRepoName;
  const path   = `db/${username}.txtdb`;
  const b64    = Buffer.from(txtdbContent).toString("base64");
  const branch = `txtdb/${username}-${Date.now()}`;

  try {
    // Get default branch SHA
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;
    const { data: ref }  = await octokit.git.getRef({ owner, repo, ref:`heads/${defaultBranch}` });
    const baseSha = ref.object.sha;

    // Create branch
    await octokit.git.createRef({ owner, repo, ref:`refs/heads/${branch}`, sha:baseSha });

    // Get existing file SHA if any
    let fileSha;
    try {
      const { data: existing } = await octokit.repos.getContent({ owner, repo, path });
      fileSha = existing.sha;
    } catch { /* new file */ }

    // Create or update file
    await octokit.repos.createOrUpdateFileContents({
      owner, repo, path,
      message: `txtdb: update ${username}.txtdb`,
      content: b64, branch,
      ...(fileSha ? { sha: fileSha } : {}),
    });

    // Close any existing open PR for this user
    const { data: allPRs } = await octokit.pulls.list({ owner, repo, state:"open" });
    const myPR = allPRs.find(pr =>
      pr.head.ref.startsWith(`txtdb/${username}-`) &&
      pr.user.login.toLowerCase() === username.toLowerCase()
    );
    if (myPR) {
      console.log(`ℹ️  Closing stale PR #${myPR.number}`);
      await octokit.pulls.update({ owner, repo, pull_number:myPR.number, state:"closed" });
    }

    // Open new PR
    const { data: pr } = await octokit.pulls.create({
      owner, repo,
      title: `txtdb: update ${username}.txtdb`,
      head: branch, base: defaultBranch,
      body: `## 📊 txtdb auto-update\n\nAuto-generated by @${username}'s profile workflow.\n\n- **User:** @${username}\n- **Updated:** ${new Date().toUTCString()}\n- **Stats page:** https://stuffzez.github.io/Stats/stats.html?user=${username}\n\n> This PR will be automatically validated and merged.`,
    });
    console.log(`✅ Opened txtdb PR #${pr.number}: ${pr.html_url}`);
  } catch(e) {
    console.warn(`⚠️  Could not open txtdb PR: ${e.message}`);
    console.warn("This is non-fatal — your README was still updated.");
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!username) {
    console.error("❌ GITHUB_USERNAME environment variable is not set.");
    process.exit(1);
  }
  if (!process.env.GH_PAT) {
    console.error("❌ GH_PAT environment variable is not set.");
    process.exit(1);
  }

  console.log(`⏳ Fetching data for @${username}…`);

  const [user, repos, publicOrgs, allOrgs, activity, issues, prs] = await Promise.all([
    fetchUser(),
    fetchRepos(),
    fetchPublicOrgs(),
    fetchAllOrgs(),
    fetchActivity(),
    fetchIssues(),
    fetchPRs(),
  ]);

  // Fetch languages in parallel (top 15 repos)
  const langs = Object.fromEntries(
    await Promise.all(repos.slice(0,15).map(async r => [r.name, await fetchLanguages(r.name)]))
  );

  // Commit count (top 20 repos)
  const commits = await countCommits(repos.slice(0,20));

  // Private stats (only if opted in)
  let allRepos       = repos;
  let privateCommits = 0;
  if (opt.privateRepos || opt.privateCommits) {
    allRepos = await fetchAllReposWithPrivate();
    if (opt.privateCommits) {
      const privateOnly = allRepos.filter(r => r.private);
      privateCommits = commits + await countCommits(privateOnly.slice(0,10));
    }
  }

  const maxRepos = parseInt(process.env.MAX_REPOS || "10", 10);
  console.log(`📦 ${repos.length} public repos | 🏢 ${allOrgs.length} orgs | 💬 ~${commits} commits`);

  // ── Update README ────────────────────────────────────────────────────────────
  let readme = "";
  try { readme = readFileSync("README.md","utf8"); }
  catch { readme = `# ${username}\n`; }

  readme = inject(readme, "GITHUB_HEADER",   buildHeader(user));
  readme = inject(readme, "GITHUB_STATS",    buildStats(user, commits, repos, issues, prs, allOrgs));
  readme = inject(readme, "GITHUB_PROJECTS", buildProjects(repos, langs, maxRepos));
  readme = inject(readme, "GITHUB_ACTIVITY", buildActivity(activity));
  readme = inject(readme, "GITHUB_ISSUES",   buildIssues(issues));
  readme = inject(readme, "GITHUB_PRS",      buildPRs(prs));
  readme = inject(readme, "GITHUB_ORGS",     buildOrgs(opt.allOrgs ? allOrgs : publicOrgs));

  writeFileSync("README.md", readme, "utf8");
  console.log("✅ README.md updated");

  // ── Write txtdb ──────────────────────────────────────────────────────────────
  const txtdb = buildTxtdb(user, repos, allRepos, publicOrgs, allOrgs, commits, privateCommits);
  writeFileSync(`${username}.txtdb`, txtdb, "utf8");
  writeFileSync("txtdb_content.txt", txtdb, "utf8");
  console.log(`✅ ${username}.txtdb written`);

  // ── Submit PR to Stats repo ──────────────────────────────────────────────────
  await submitTxtdbPR(txtdb);
}

main().catch(e => { console.error(e); process.exit(1); });
