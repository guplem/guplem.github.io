const API = 'https://api.github.com';
let token = '';
let currentRepo = null;

// DOM references
const tokenInput = document.getElementById('token-input');
const usernameInput = document.getElementById('username-input');
const tokenBtn = document.getElementById('token-btn');
const authSection = document.getElementById('auth-section');
const repoSection = document.getElementById('repo-section');
const statsSection = document.getElementById('stats-section');
const repoSearch = document.getElementById('repo-search');
const repoList = document.getElementById('repo-list');
const backBtn = document.getElementById('back-btn');
const loading = document.getElementById('loading');

let allRepos = [];

// GitHub API helper
async function ghFetch(url, allPages = false) {
    const headers = { Accept: 'application/vnd.github.v3+json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    if (!allPages) {
        const res = await fetch(url.startsWith('http') ? url : `${API}${url}`, { headers });
        if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
        return res.json();
    }

    // Paginate
    let results = [];
    let page = 1;
    const separator = url.includes('?') ? '&' : '?';
    while (true) {
        const res = await fetch(
            (url.startsWith('http') ? url : `${API}${url}`) + `${separator}per_page=100&page=${page}`,
            { headers }
        );
        if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;
        results = results.concat(data);
        if (data.length < 100) break;
        page++;
        if (page > 10) break; // safety limit
    }
    return results;
}

// Show/hide sections
function showSection(section) {
    [authSection, repoSection, statsSection].forEach(s => s.classList.add('hidden'));
    section.classList.remove('hidden');
}

function showLoading() { loading.classList.remove('hidden'); }
function hideLoading() { loading.classList.add('hidden'); }

// Load repos
tokenBtn.addEventListener('click', loadRepos);
tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadRepos(); });
usernameInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadRepos(); });

async function loadRepos() {
    token = tokenInput.value.trim();
    const username = usernameInput.value.trim();

    if (!token && !username) {
        alert('Please enter a token or a username.');
        return;
    }

    showLoading();
    try {
        if (token) {
            allRepos = await ghFetch('/user/repos?sort=updated&type=all', true);
        } else {
            allRepos = await ghFetch(`/users/${encodeURIComponent(username)}/repos?sort=updated`, true);
        }
        // Clear token from DOM input after reading it (keep in memory only)
        tokenInput.value = '';
        renderRepoList(allRepos);
        showSection(repoSection);
    } catch (err) {
        alert(`Failed to load repos: ${err.message}`);
    } finally {
        hideLoading();
    }
}

// Render repo list
function renderRepoList(repos) {
    repoList.innerHTML = repos.map(r => `
        <div class="repo-item" data-full-name="${r.full_name}">
            <div class="repo-item-info">
                <div class="repo-item-name">
                    ${escapeHtml(r.name)}
                    ${r.private ? '<span class="private-badge">Private</span>' : ''}
                </div>
                <div class="repo-item-desc">${escapeHtml(r.description || '')}</div>
            </div>
            <div class="repo-item-meta">
                <span>&#9733; ${r.stargazers_count}</span>
                <span>&#9741; ${r.forks_count}</span>
            </div>
        </div>
    `).join('');

    repoList.querySelectorAll('.repo-item').forEach(item => {
        item.addEventListener('click', () => selectRepo(item.dataset.fullName));
    });
}

repoSearch.addEventListener('input', () => {
    const q = repoSearch.value.toLowerCase();
    const filtered = allRepos.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
    );
    renderRepoList(filtered);
});

// Select repo and load stats
async function selectRepo(fullName) {
    showLoading();
    try {
        currentRepo = await ghFetch(`/repos/${fullName}`);

        // Fetch all data in parallel
        const [
            closedIssues,
            openIssues,
            mergedPRs,
            openPRs,
            closedPRs,
            contributors,
            languages,
            recentCommits,
            events,
            releases,
        ] = await Promise.all([
            ghFetch(`/repos/${fullName}/issues?state=closed&per_page=100`),
            ghFetch(`/repos/${fullName}/issues?state=open&per_page=100`),
            ghFetch(`/search/issues?q=repo:${fullName}+type:pr+is:merged&per_page=1`),
            ghFetch(`/search/issues?q=repo:${fullName}+type:pr+is:open&per_page=1`),
            ghFetch(`/search/issues?q=repo:${fullName}+type:pr+is:closed+is:unmerged&per_page=1`),
            ghFetch(`/repos/${fullName}/contributors?per_page=20`).catch(() => []),
            ghFetch(`/repos/${fullName}/languages`).catch(() => ({})),
            ghFetch(`/repos/${fullName}/commits?per_page=100`).catch(() => []),
            ghFetch(`/repos/${fullName}/events?per_page=30`).catch(() => []),
            ghFetch(`/repos/${fullName}/releases?per_page=10`).catch(() => []),
        ]);

        // Filter out PRs from issues lists (GitHub API includes PRs in issues)
        const realClosedIssues = closedIssues.filter(i => !i.pull_request);
        const realOpenIssues = openIssues.filter(i => !i.pull_request);

        renderStats({
            repo: currentRepo,
            closedIssues: realClosedIssues,
            openIssues: realOpenIssues,
            totalClosedIssues: currentRepo.open_issues_count !== undefined
                ? realClosedIssues.length : 0,
            mergedPRCount: mergedPRs.total_count || 0,
            openPRCount: openPRs.total_count || 0,
            closedPRCount: closedPRs.total_count || 0,
            contributors,
            languages,
            recentCommits,
            events,
            releases,
        });

        showSection(statsSection);
    } catch (err) {
        alert(`Failed to load stats: ${err.message}`);
    } finally {
        hideLoading();
    }
}

backBtn.addEventListener('click', () => {
    showSection(repoSection);
});

// Render all stats
function renderStats(data) {
    const { repo, closedIssues, openIssues, mergedPRCount, openPRCount, closedPRCount,
        contributors, languages, recentCommits, events, releases } = data;

    // Header
    document.getElementById('repo-name').textContent = repo.full_name;
    document.getElementById('repo-description').textContent = repo.description || 'No description';

    // Overview cards
    const totalIssues = openIssues.length + closedIssues.length;
    const totalPRs = mergedPRCount + openPRCount + closedPRCount;
    const daysSinceCreation = Math.floor((Date.now() - new Date(repo.created_at)) / 86400000);
    const commitsPerWeek = recentCommits.length > 1
        ? (() => {
            const oldest = new Date(recentCommits[recentCommits.length - 1].commit.author.date);
            const newest = new Date(recentCommits[0].commit.author.date);
            const weeks = Math.max(1, (newest - oldest) / (7 * 86400000));
            return (recentCommits.length / weeks).toFixed(1);
        })()
        : '—';

    document.getElementById('overview-cards').innerHTML = `
        <div class="stat-card">
            <div class="stat-value stat-accent">&#9733; ${repo.stargazers_count}</div>
            <div class="stat-label">Stars</div>
        </div>
        <div class="stat-card">
            <div class="stat-value stat-purple">&#9741; ${repo.forks_count}</div>
            <div class="stat-label">Forks</div>
        </div>
        <div class="stat-card">
            <div class="stat-value stat-green">${repo.subscribers_count || 0}</div>
            <div class="stat-label">Watchers</div>
        </div>
        <div class="stat-card">
            <div class="stat-value stat-warn">${totalIssues}</div>
            <div class="stat-label">Total Issues</div>
        </div>
        <div class="stat-card">
            <div class="stat-value stat-accent">${totalPRs}</div>
            <div class="stat-label">Total PRs</div>
        </div>
        <div class="stat-card">
            <div class="stat-value stat-green">${commitsPerWeek}</div>
            <div class="stat-label">Commits/Week</div>
        </div>
        <div class="stat-card">
            <div class="stat-value stat-purple">${releases.length}</div>
            <div class="stat-label">Releases</div>
        </div>
        <div class="stat-card">
            <div class="stat-value stat-warn">${daysSinceCreation}d</div>
            <div class="stat-label">Age</div>
        </div>
    `;

    // Issues section
    const issueCloseRate = totalIssues > 0
        ? ((closedIssues.length / totalIssues) * 100).toFixed(0) : '—';
    const avgIssueCloseTime = closedIssues.length > 0
        ? formatDuration(closedIssues.reduce((sum, i) => {
            return sum + (new Date(i.closed_at) - new Date(i.created_at));
        }, 0) / closedIssues.length)
        : '—';

    document.getElementById('issues-stats').innerHTML = `
        <div class="detail-item">
            <div class="detail-value stat-green">${closedIssues.length}</div>
            <div class="detail-label">Closed</div>
        </div>
        <div class="detail-item">
            <div class="detail-value stat-warn">${openIssues.length}</div>
            <div class="detail-label">Open</div>
        </div>
        <div class="detail-item">
            <div class="detail-value stat-accent">${issueCloseRate}%</div>
            <div class="detail-label">Close Rate</div>
        </div>
        <div class="detail-item">
            <div class="detail-value stat-purple">${avgIssueCloseTime}</div>
            <div class="detail-label">Avg Close Time</div>
        </div>
    `;

    renderTimelineChart('issues-chart', closedIssues.map(i => i.closed_at), 'Issues closed');

    // PR section
    document.getElementById('pr-stats').innerHTML = `
        <div class="detail-item">
            <div class="detail-value stat-green">${mergedPRCount}</div>
            <div class="detail-label">Merged</div>
        </div>
        <div class="detail-item">
            <div class="detail-value stat-warn">${openPRCount}</div>
            <div class="detail-label">Open</div>
        </div>
        <div class="detail-item">
            <div class="detail-value stat-danger">${closedPRCount}</div>
            <div class="detail-label">Closed (unmerged)</div>
        </div>
        <div class="detail-item">
            <div class="detail-value stat-accent">${totalPRs > 0 ? ((mergedPRCount / totalPRs) * 100).toFixed(0) : '—'}%</div>
            <div class="detail-label">Merge Rate</div>
        </div>
    `;

    // PR chart — use events for timeline since we don't have individual PR close dates
    const prEvents = events.filter(e =>
        e.type === 'PullRequestEvent' && e.payload?.action === 'closed'
    );
    renderTimelineChart('pr-chart', prEvents.map(e => e.created_at), 'PRs closed');

    // Code stats
    const uniqueAuthors = new Set(recentCommits.map(c => c.commit?.author?.name)).size;
    document.getElementById('code-stats').innerHTML = `
        <div class="detail-item">
            <div class="detail-value stat-accent">${recentCommits.length}</div>
            <div class="detail-label">Recent Commits</div>
        </div>
        <div class="detail-item">
            <div class="detail-value stat-green">${uniqueAuthors}</div>
            <div class="detail-label">Authors (recent)</div>
        </div>
        <div class="detail-item">
            <div class="detail-value stat-purple">${repo.default_branch}</div>
            <div class="detail-label">Default Branch</div>
        </div>
        <div class="detail-item">
            <div class="detail-value stat-warn">${repo.size ? formatSize(repo.size) : '—'}</div>
            <div class="detail-label">Repo Size</div>
        </div>
    `;

    renderTimelineChart('commit-chart', recentCommits.map(c => c.commit.author.date), 'Commits');

    // Contributors
    const contribHtml = Array.isArray(contributors) ? contributors.slice(0, 12).map(c => `
        <div class="contributor-item">
            <img src="${c.avatar_url}&s=72" alt="${escapeHtml(c.login)}" loading="lazy">
            <div>
                <div class="contributor-name">${escapeHtml(c.login)}</div>
                <div class="contributor-commits">${c.contributions} commits</div>
            </div>
        </div>
    `).join('') : '<p style="color:var(--text-muted)">No contributor data available.</p>';
    document.getElementById('contributors-list').innerHTML = contribHtml;

    // Languages
    renderLanguages(languages);

    // Recent activity
    renderActivity(events);
}

// Timeline bar chart (groups dates into weekly buckets)
function renderTimelineChart(containerId, dates, label) {
    const container = document.getElementById(containerId);
    if (!dates.length) {
        container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:2rem 0;">No ${label.toLowerCase()} data</p>`;
        return;
    }

    const timestamps = dates.map(d => new Date(d).getTime()).sort((a, b) => a - b);
    const min = timestamps[0];
    const max = timestamps[timestamps.length - 1];
    const range = max - min;
    const bucketCount = Math.min(Math.max(12, Math.ceil(range / (7 * 86400000))), 52);
    const bucketSize = range / bucketCount || 1;

    const buckets = new Array(bucketCount).fill(0);
    timestamps.forEach(t => {
        const idx = Math.min(Math.floor((t - min) / bucketSize), bucketCount - 1);
        buckets[idx]++;
    });

    const maxVal = Math.max(...buckets);
    const bars = buckets.map((count, i) => {
        const height = maxVal > 0 ? (count / maxVal) * 100 : 0;
        const date = new Date(min + i * bucketSize);
        const tooltip = `${date.toLocaleDateString('en', { month: 'short', year: 'numeric' })}: ${count}`;
        return `<div class="bar" style="height:${Math.max(height, 2)}%"><span class="bar-tooltip">${tooltip}</span></div>`;
    }).join('');

    const startLabel = new Date(min).toLocaleDateString('en', { month: 'short', year: '2-digit' });
    const endLabel = new Date(max).toLocaleDateString('en', { month: 'short', year: '2-digit' });

    container.innerHTML = `
        <div class="bar-chart">${bars}</div>
        <div class="chart-labels"><span>${startLabel}</span><span>${label}</span><span>${endLabel}</span></div>
    `;
}

// Languages
const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
    'C#': '#178600', 'C++': '#f34b7d', C: '#555555', Go: '#00ADD8', Rust: '#dea584',
    Ruby: '#701516', PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB',
    HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Lua: '#000080', R: '#198CE7',
    Scala: '#c22d40', Haskell: '#5e5086', Elixir: '#6e4a7e', Vue: '#41b883',
};

function renderLanguages(languages) {
    const container = document.getElementById('languages-chart');
    const entries = Object.entries(languages);
    if (!entries.length) {
        container.innerHTML = '<p style="color:var(--text-muted)">No language data available.</p>';
        return;
    }

    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    const sorted = entries.sort((a, b) => b[1] - a[1]);

    const barSegments = sorted.map(([lang, bytes]) => {
        const pct = (bytes / total) * 100;
        const color = LANG_COLORS[lang] || `hsl(${hashStr(lang) % 360}, 55%, 55%)`;
        return `<div class="lang-bar-segment" style="width:${pct}%;background:${color}" title="${lang}: ${pct.toFixed(1)}%"></div>`;
    }).join('');

    const items = sorted.map(([lang, bytes]) => {
        const pct = (bytes / total) * 100;
        const color = LANG_COLORS[lang] || `hsl(${hashStr(lang) % 360}, 55%, 55%)`;
        return `
            <div class="lang-item">
                <span class="lang-dot" style="background:${color}"></span>
                <span class="lang-name">${escapeHtml(lang)}</span>
                <span class="lang-percent">${pct.toFixed(1)}%</span>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="lang-bar-wrapper">${barSegments}</div>
        ${items}
    `;
}

// Recent activity
function renderActivity(events) {
    const container = document.getElementById('recent-activity');
    if (!events.length) {
        container.innerHTML = '<p style="color:var(--text-muted)">No recent activity.</p>';
        return;
    }

    const icons = {
        PushEvent: '&#128640;',
        PullRequestEvent: '&#128256;',
        IssuesEvent: '&#9899;',
        IssueCommentEvent: '&#128172;',
        CreateEvent: '&#10024;',
        DeleteEvent: '&#128465;',
        ReleaseEvent: '&#127991;',
        ForkEvent: '&#9741;',
        WatchEvent: '&#9733;',
    };

    const html = events.slice(0, 20).map(e => {
        const icon = icons[e.type] || '&#128196;';
        const date = new Date(e.created_at);
        const text = describeEvent(e);
        if (!text) return '';
        return `
            <div class="activity-item">
                <span class="activity-icon">${icon}</span>
                <span class="activity-text">${text}</span>
                <span class="activity-date">${timeAgo(date)}</span>
            </div>
        `;
    }).filter(Boolean).join('');

    container.innerHTML = html || '<p style="color:var(--text-muted)">No describable activity.</p>';
}

function describeEvent(e) {
    const actor = `<strong>${escapeHtml(e.actor?.login || 'Unknown')}</strong>`;
    switch (e.type) {
        case 'PushEvent': {
            const count = e.payload?.commits?.length || 0;
            return `${actor} pushed ${count} commit${count !== 1 ? 's' : ''} to ${escapeHtml(e.payload?.ref?.replace('refs/heads/', '') || '?')}`;
        }
        case 'PullRequestEvent':
            return `${actor} ${e.payload?.action} PR #${e.payload?.pull_request?.number}: ${escapeHtml(e.payload?.pull_request?.title || '')}`;
        case 'IssuesEvent':
            return `${actor} ${e.payload?.action} issue #${e.payload?.issue?.number}: ${escapeHtml(e.payload?.issue?.title || '')}`;
        case 'IssueCommentEvent':
            return `${actor} commented on #${e.payload?.issue?.number}`;
        case 'CreateEvent':
            return `${actor} created ${e.payload?.ref_type} ${escapeHtml(e.payload?.ref || '')}`;
        case 'DeleteEvent':
            return `${actor} deleted ${e.payload?.ref_type} ${escapeHtml(e.payload?.ref || '')}`;
        case 'ReleaseEvent':
            return `${actor} ${e.payload?.action} release ${escapeHtml(e.payload?.release?.tag_name || '')}`;
        case 'ForkEvent':
            return `${actor} forked the repository`;
        case 'WatchEvent':
            return `${actor} starred the repository`;
        default:
            return null;
    }
}

// Utilities
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDuration(ms) {
    const hours = ms / 3600000;
    if (hours < 24) return `${hours.toFixed(0)}h`;
    const days = hours / 24;
    if (days < 30) return `${days.toFixed(0)}d`;
    return `${(days / 30).toFixed(0)}mo`;
}

function formatSize(kb) {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
}

function timeAgo(date) {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

function hashStr(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
}
