const STORAGE_KEY = "chromium-cs-stars";
let currentPath = "";
let isInjectingDashboard = false;

function init() {
  const observer = new MutationObserver(() => {
    handlePageChange();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  handlePageChange();
}

function handlePageChange() {
  const url = window.location.href;
  const isLanding = url.endsWith("source.chromium.org/");

  if (isLanding) {
    injectDashboard();
  } else {
    hideDashboard();
    injectStarButton();
  }
}

function injectStarButton() {
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
      const name = document.title.replace(" - Chromium Code Search", "");
      await addStar(currentPath, name);
      updateBtnVisuals(btn, /*isStarred=*/ true);
    }
  };

  // Determine current path from URL.
  currentPath = window.location.pathname + window.location.search;

  // Check state.
  checkIsStarred(currentPath).then((isStarred) => {
    updateBtnVisuals(btn, isStarred);
  });

  // Insert button.
  breadcrumbContainer.prepend(btn);
}

function updateBtnVisuals(btn, isStarred) {
  if (isStarred) {
    btn.classList.add("starred");
    btn.innerHTML = "★";
  } else {
    btn.classList.remove("starred");
    btn.innerHTML = "☆";
  }
}

async function injectDashboard() {
  // Prevent multiple attempts to inject the dashboard.
  if (isInjectingDashboard) return;
  isInjectingDashboard = true;

  const maybeDashboard = document.querySelector(".ccss-dashboard");
  if (maybeDashboard) {
    maybeDashboard.classList.remove("hidden");
    isInjectingDashboard = false;
    return;
  }

  const targetContainer = document.querySelector("whitelabelled-search");
  if (!targetContainer) {
    isInjectingDashboard = false;
    return;
  }

  const dashboard = document.createElement("div");
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
  const data = await getStarredPaths();
  const NO_FILES_INNER_HTML = "<li>No starred files or folders yet.</li>";
  if (data.length === 0) {
    list.innerHTML = NO_FILES_INNER_HTML;
  } else {
    data.forEach((item) => {
      const li = document.createElement("li");

      const link = document.createElement("a");
      link.href = `https://source.chromium.org${item.path}`;
      link.innerText = item.name || item.path;

      const removeBtn = document.createElement("span");
      removeBtn.className = "ccss-remove";
      removeBtn.innerText = "[Remove]";
      removeBtn.onclick = async () => {
        await removeStar(item.path);
        let isLastElement = li.parentElement.children.length === 1;
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

  targetContainer.appendChild(dashboard, targetContainer.firstChild);

  isInjectingDashboard = false;
}

function hideDashboard() {
  const maybeDashboard = document.querySelector(".ccss-dashboard");
  if (maybeDashboard) maybeDashboard.classList.add("hidden");
}

async function getStarredPaths() {
  const storage = await chrome.storage.sync.get(STORAGE_KEY);
  return storage[STORAGE_KEY] || [];
}

async function addStar(path, name) {
  const stars = await getStarredPaths();
  if (!stars.find((s) => s.path === path)) {
    stars.unshift({
      path,
      name,
      date: Date.now(),
    });
    chrome.storage.sync.set({ [STORAGE_KEY]: stars });
  }
}

async function removeStar(path) {
  let stars = await getStarredPaths();
  stars = stars.filter((s) => s.path !== path);
  chrome.storage.sync.set({ [STORAGE_KEY]: stars });
}

async function checkIsStarred(path) {
  const stars = await getStarredPaths();
  return !!stars.find((s) => s.path === path);
}

init();
