const STORAGE_KEY = "chromium-cs-stars";
let currentPath = "";
let isInjectingDashboard = false;

interface Path {
  project: string;
  repo?: string;
  branch?: string;
  path?: string;
}

function init() {
  const observer = new MutationObserver(() => {
    handlePageChange();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  handlePageChange();
}

function handlePageChange() {
  const url = window.location.href;
  const path = parseUrl(url);
  if (!path) return;

  if (path.project && !path.repo && !path.branch && !path.path) {
    injectDashboard(path.project);
  } else if (path.branch && path.path) {
    hideDashboard(path.project);
    injectStarButton(path);
  } else {
    hideDashboard(path.project);
  }
}

function parseUrl(url: string): Path | null {
  const pattern =
    /^(?:https?:\/\/)?source\.chromium\.org\/(?<project>[^\/]+)(?:\/(?<repo>.+?)(?:\/\+\/(?<branch>[^:]+):(?<path>[^;?]*))?)?\/?(?=[?;]|$)/;

  const match = url.match(pattern);
  if (!match || !match.groups) return null;

  let project = decodeURIComponent(match.groups.project);
  let repo =
    match.groups.repo !== undefined
      ? decodeURIComponent(match.groups.repo)
      : undefined;
  let branch =
    match.groups.branch !== undefined
      ? decodeURIComponent(match.groups.branch)
      : undefined;
  let path =
    match.groups.path !== undefined
      ? decodeURIComponent(match.groups.path)
      : undefined;

  return {
    project,
    repo,
    branch,
    path,
  };
}

function injectStarButton(currentPath: Path) {
  if (document.querySelector(".ccss-star-btn")) return;

  // Try to find the breadcrumb container.
  const breadcrumbContainer = document.querySelector("#detail-header-id");
  if (!breadcrumbContainer) return;

  // Create button.
  const btn = document.createElement("button");
  btn.className = "ccss-star-btn";
  btn.title = "Star this path";
  btn.onclick = async () => {
    const isStarred = btn.classList.contains("starred");
    if (isStarred) {
      await removeStar(currentPath);
      updateBtnVisuals(btn, /*isStarred=*/ false);
    } else {
      await addStar(currentPath);
      updateBtnVisuals(btn, /*isStarred=*/ true);
    }
  };

  // Check state.
  checkIsStarred(currentPath).then((isStarred) => {
    updateBtnVisuals(btn, isStarred);
  });

  // Insert button.
  breadcrumbContainer.prepend(btn);
}

function updateBtnVisuals(btn: HTMLButtonElement, isStarred: boolean) {
  if (isStarred) {
    btn.classList.add("starred");
    btn.innerHTML = "★";
  } else {
    btn.classList.remove("starred");
    btn.innerHTML = "☆";
  }
}

async function injectDashboard(project: string) {
  // Prevent multiple attempts to inject the dashboard.
  if (isInjectingDashboard) return;
  isInjectingDashboard = true;

  const maybeDashboard = document.querySelector(
    `#${project}-dashboard.ccss-dashboard`
  );
  if (maybeDashboard) {
    maybeDashboard.classList.remove("hidden");
    isInjectingDashboard = false;
    return;
  }

  const targetContainer = document.querySelector(".project-card");
  if (!targetContainer) {
    isInjectingDashboard = false;
    return;
  }

  const dashboard = document.createElement("div");
  dashboard.id = `${project}-dashboard`;
  dashboard.className = "ccss-dashboard";

  const title = document.createElement("h3");
  title.innerText = "★ Starred Paths";
  dashboard.appendChild(title);

  const hr = document.createElement("hr");
  hr.className = "ccss-divider";
  dashboard.appendChild(hr);

  const list = document.createElement("ul");
  list.className = "ccss-list";
  dashboard.appendChild(list);

  // Populate list with files.
  const stars = (await getStarredPaths()).filter(
    (star) => star.project === project
  );
  const NO_FILES_INNER_HTML = "<li>No starred files or folders yet.</li>";
  if (stars.length === 0) {
    list.innerHTML = NO_FILES_INNER_HTML;
  } else {
    stars.forEach((star) => {
      const li = document.createElement("li");
      const link = document.createElement("a");

      link.href = `https://source.chromium.org/${star.project}/${star.repo}`;
      if (star.branch) link.href += `/+/${star.branch}:`;
      if (star.path) link.href += star.path;

      link.innerText = "";
      if (star.repo) link.innerText += star.repo;
      if (star.path) link.innerText += ":" + star.path;

      const removeBtn = document.createElement("span");
      removeBtn.className = "ccss-remove";
      removeBtn.innerText = "[Remove]";
      removeBtn.onclick = async () => {
        await removeStar(star);
        let isLastElement = li.parentElement!.children.length === 1;
        li.remove();
        if (isLastElement) {
          list.innerHTML = NO_FILES_INNER_HTML;
        }
      };

      li.appendChild(link);
      li.appendChild(removeBtn);
      list.appendChild(li);
    });
  }

  targetContainer.appendChild(dashboard);

  isInjectingDashboard = false;
}

function hideDashboard(project: string) {
  const maybeDashboard = document.querySelector(
    `#${project}-dashboard.ccss-dashboard`
  );
  if (maybeDashboard) maybeDashboard.classList.add("hidden");
}

async function getStarredPaths(): Promise<Path[]> {
  const storage = await chrome.storage.sync.get(STORAGE_KEY);
  return (storage[STORAGE_KEY] || []) as Path[];
}

async function addStar(path: Path) {
  const stars = await getStarredPaths();
  if (!stars.find((s) => arePathsEqual(s, path))) {
    stars.unshift(path);
    chrome.storage.sync.set({ [STORAGE_KEY]: stars });
  }
}

async function removeStar(path: Path) {
  let stars = await getStarredPaths();
  stars = stars.filter((s) => !arePathsEqual(s, path));
  chrome.storage.sync.set({ [STORAGE_KEY]: stars });
}

async function checkIsStarred(path: Path) {
  const stars = await getStarredPaths();
  return !!stars.find((s) => arePathsEqual(s, path));
}

function arePathsEqual(a: Path, b: Path) {
  return (
    a.project === b.project &&
    a.repo === b.repo &&
    a.branch === b.branch &&
    a.path === b.path
  );
}

init();
