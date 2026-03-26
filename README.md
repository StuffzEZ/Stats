<div align="center">

# 📊 Stats

**Auto-updating GitHub profile stats for your README.**

[![Website](https://img.shields.io/badge/Website-stuffzez.github.io%2FStats-6366f1?style=for-the-badge&logo=github)](https://stuffzez.github.io/Stats)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)
[![Setup Time](https://img.shields.io/badge/Setup-60%20seconds-f59e0b?style=for-the-badge)](https://stuffzez.github.io/Stats/#setup)

Set up in 60 seconds · Runs every 6 hours · Your PAT never leaves GitHub

[**🌐 Visit stuffzez.github.io/Stats →**](https://stuffzez.github.io/Stats)

</div>

---

## What is this?

**Stats** is a GitHub Actions workflow + website that auto-updates your profile README with beautiful, live stats — projects, commits, issues, PRs, organisations, and more.

It also powers a public stats dashboard at `stuffzez.github.io/Stats/stats.html?user=USERNAME` — shareable, no auth required.

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 📦 **Recent Projects** | Top repos sorted by last push, with language badges, stars, open issues |
| 📊 **Stats badges** | Repos, stars, forks, commits, issues, PRs, orgs, followers |
| 🏢 **Organisation avatars** | Avatar grid with clickable links to each org |
| 🐛 **Open Issues** | Issues you've created, with age-coloured badges |
| 🔀 **Open PRs** | Your open pull requests across all repos |
| ⚡ **Activity feed** | Pushes, stars, comments, releases and more |
| 📈 **Stats charts** | `github-readme-stats` + streak counter |
| 🌐 **Public dashboard** | Full stats page using only the public API |
| 🔒 **Secure** | PAT stored as a GitHub secret, never exposed to the web |

---

## 🚀 Quick Setup

> **Visit [stuffzez.github.io/Stats/#setup](https://stuffzez.github.io/Stats/#setup) for the interactive setup form.**

Or manually:

### 1. Create a Personal Access Token

Go to **GitHub → Settings → Developer Settings → Fine-grained tokens** and create a token with:
- `Contents`: Read and Write
- `Metadata`: Read

### 2. Add it as a repository secret

In your profile repo (`<username>/<username>`): **Settings → Secrets → Actions → New secret**

- Name: `GH_PAT`
- Value: your token

### 3. Add the workflow

Copy `.github/workflows/update-readme.yml` from this repo into your profile repo at the same path.

### 4. Add markers to your README

Place these comment pairs wherever you want each section to appear:

```markdown
<!-- GITHUB_HEADER:START -->
<!-- GITHUB_HEADER:END -->

<!-- GITHUB_STATS:START -->
<!-- GITHUB_STATS:END -->

<!-- GITHUB_PROJECTS:START -->
<!-- GITHUB_PROJECTS:END -->

<!-- GITHUB_ACTIVITY:START -->
<!-- GITHUB_ACTIVITY:END -->

<!-- GITHUB_ISSUES:START -->
<!-- GITHUB_ISSUES:END -->

<!-- GITHUB_PRS:START -->
<!-- GITHUB_PRS:END -->

<!-- GITHUB_ORGS:START -->
<!-- GITHUB_ORGS:END -->
```

### 5. Run it

Trigger the workflow manually from the **Actions** tab, or wait for the next scheduled run.

---

## 🌐 Stats Dashboard

Anyone can view a full stats dashboard for any public GitHub user:

```
https://stuffzez.github.io/Stats/stats.html?user=YOUR_USERNAME
```

Share this link in your README, bio, or portfolio. It uses **only the public GitHub API** — no PAT, no auth.

---

## 🔒 Security

- Your PAT is stored **encrypted** as a GitHub Actions secret
- The stats website **never requests or stores** any PAT
- The workflow only writes to `README.md` in your profile repo
- All web fetches on the dashboard use the **unauthenticated** public GitHub API

---

## 📁 Repository Structure

```
Stats/
├── docs/                        # GitHub Pages site (stuffzez.github.io/Stats)
│   ├── index.html               # Landing page + setup form
│   └── stats.html               # Public stats dashboard
├── .github/
│   └── workflows/
│       └── update-readme.yml    # The installable workflow
└── README.md                    # This file
```

---

## 🛠 Customisation

The setup form at [stuffzez.github.io/Stats/#setup](https://stuffzez.github.io/Stats/#setup) lets you:

- Choose which sections to include/exclude
- Set the refresh schedule (6h / 12h / daily / weekly)
- Set how many repos to show (5 / 10 / 15 / 20)

The generated YAML is personalised for your username and preferences.

---

<div align="center">

Built by [StuffzEZ](https://github.com/StuffzEZ) · [Website](https://stuffzez.github.io/Stats) · MIT License

</div>