const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const monthGrid = document.getElementById("monthGrid");
const monthCardTemplate = document.getElementById("monthCardTemplate");
const memoryNoticeTemplate = document.getElementById("memoryNoticeTemplate");
const currentMonthLabel = document.getElementById("currentMonthLabel");
const currentYearLabel = document.getElementById("currentYearLabel");
const jumpToCurrentMonthButton = document.getElementById("jumpToCurrentMonth");
const clearAllMemoriesButton = document.getElementById("clearAllMemories");

const today = new Date();
const currentMonthIndex = today.getMonth();

currentMonthLabel.textContent = MONTHS[currentMonthIndex];
currentYearLabel.textContent = String(today.getFullYear());

let memoryStore = {};

function createMemoryId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(dateValue) {
  if (!dateValue) return "No date added";
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime())
    ? "No date added"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatSavedAt(dateValue) {
  if (!dateValue) return "Just now";
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime())
    ? "Just now"
    : date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function getMonthMemories(monthName) {
  return memoryStore[monthName] || [];
}

async function refreshMemoryStore() {
  const memories = await getAllMemories();
  memoryStore = groupMemoriesByMonth(memories);
}

function renderMonths() {
  monthGrid.innerHTML = "";

  MONTHS.forEach((monthName, index) => {
    const monthCardFragment = monthCardTemplate.content.cloneNode(true);
    const monthCard = monthCardFragment.querySelector(".month-card");
    const monthTitle = monthCardFragment.querySelector(".month-card__title");
    const monthIndex = monthCardFragment.querySelector(".month-card__index");
    const monthCount = monthCardFragment.querySelector(".month-card__count");
    const memoryForm = monthCardFragment.querySelector(".memory-form");
    const captionInput = monthCardFragment.querySelector(".memory-caption");
    const dateInput = monthCardFragment.querySelector(".memory-date");
    const fileInput = monthCardFragment.querySelector(".memory-file");
    const galleryLink = monthCardFragment.querySelector(".month-card__link");
    const memoryList = monthCardFragment.querySelector(".memory-list");
    const memories = getMonthMemories(monthName).slice().sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

    monthCard.dataset.month = monthName;
    monthTitle.textContent = monthName;
    monthIndex.textContent = `Month ${index + 1}`;
    monthCount.textContent = `${memories.length} saved`;
    galleryLink.href = `gallery.html?month=${encodeURIComponent(monthName)}`;
    galleryLink.textContent = `Open ${monthName} Gallery`;

    if (index === currentMonthIndex) {
      monthCard.classList.add("month-card--current");
    }

    if (!memories.length) {
      const emptyState = document.createElement("p");
      emptyState.className = "memory-empty";
      emptyState.textContent = "No memories saved for this month yet.";
      memoryList.appendChild(emptyState);
    } else {
      const latestMemory = memories[0];
      const memoryFragment = memoryNoticeTemplate.content.cloneNode(true);
      const badge = memoryFragment.querySelector(".memory-notice__badge");
      const title = memoryFragment.querySelector(".memory-notice__title");
      const meta = memoryFragment.querySelector(".memory-notice__meta");

      badge.textContent = String(memories.length);
      title.textContent = `${memories.length} ${memories.length === 1 ? "memory" : "memories"} saved`;
      meta.textContent = `Latest save: ${formatSavedAt(latestMemory.savedAt)}`;
      memoryList.appendChild(memoryFragment);
    }

    memoryForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const file = fileInput.files[0];
      if (!file) {
        window.alert("Choose an image or video first.");
        return;
      }

      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        window.alert("Only image and video files are supported.");
        return;
      }

      try {
        await saveMemory({
          id: createMemoryId(),
          month: monthName,
          caption: captionInput.value.trim(),
          date: dateInput.value,
          savedAt: new Date().toISOString(),
          type: file.type.startsWith("video/") ? "video" : "image",
          fileBlob: file,
          fileName: file.name
        });

        captionInput.value = "";
        dateInput.value = "";
        fileInput.value = "";
        await refreshMemoryStore();
        renderMonths();
      } catch (error) {
        console.error("Failed to save memory:", error);
        window.alert("This file could not be saved. Your browser storage may be full.");
      }
    });

    monthGrid.appendChild(monthCardFragment);
  });
}

jumpToCurrentMonthButton.addEventListener("click", () => {
  const currentCard = document.querySelector(`.month-card[data-month="${MONTHS[currentMonthIndex]}"]`);
  currentCard?.scrollIntoView({ behavior: "smooth", block: "center" });
});

clearAllMemoriesButton.addEventListener("click", async () => {
  const confirmed = window.confirm("Delete every saved image and video from this browser?");
  if (!confirmed) return;

  await clearAllMemoriesFromDb();
  await refreshMemoryStore();
  renderMonths();
});

async function initializePage() {
  await migrateLegacyLocalStorage();
  await refreshMemoryStore();
  renderMonths();
}

initializePage().catch((error) => {
  console.error("Failed to initialize memory board:", error);
});
