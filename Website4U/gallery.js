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

const galleryTitle = document.getElementById("galleryTitle");
const gallerySubtitle = document.getElementById("gallerySubtitle");
const calendarMonthHeading = document.getElementById("calendarMonthHeading");
const galleryCount = document.getElementById("galleryCount");
const galleryList = document.getElementById("galleryList");
const calendarGrid = document.getElementById("calendarGrid");
const timelineList = document.getElementById("timelineList");
const galleryItemTemplate = document.getElementById("galleryItemTemplate");
const timelineItemTemplate = document.getElementById("timelineItemTemplate");
const deleteModal = document.getElementById("deleteModal");
const confirmDeleteButton = document.getElementById("confirmDeleteButton");
const cancelDeleteButton = document.getElementById("cancelDeleteButton");

const params = new URLSearchParams(window.location.search);
const requestedMonth = params.get("month");
const activeMonth = MONTHS.includes(requestedMonth) ? requestedMonth : MONTHS[new Date().getMonth()];
const activeMonthIndex = MONTHS.indexOf(activeMonth);
const activeYear = new Date().getFullYear();

let memoryStore = {};
let pendingDeleteMemoryId = null;
let activeObjectUrls = [];

function formatDate(dateValue) {
  if (!dateValue) return "No date added";
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime())
    ? "No date added"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatSavedAt(dateValue) {
  if (!dateValue) return "No saved date";
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime())
    ? "No saved date"
    : date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function getSortedMemories() {
  return (memoryStore[activeMonth] || []).slice().sort((a, b) => {
    const firstDate = new Date(b.date || b.savedAt || 0).getTime();
    const secondDate = new Date(a.date || a.savedAt || 0).getTime();
    return firstDate - secondDate;
  });
}

async function refreshMemoryStore() {
  const memories = await getAllMemories();
  memoryStore = groupMemoriesByMonth(memories);
}

function resetObjectUrls() {
  activeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  activeObjectUrls = [];
}

function createMediaUrl(fileBlob) {
  const objectUrl = URL.createObjectURL(fileBlob);
  activeObjectUrls.push(objectUrl);
  return objectUrl;
}

function renderHeader() {
  const memories = getSortedMemories();
  galleryTitle.textContent = `${activeMonth} Gallery`;
  gallerySubtitle.textContent = `All saved photos and videos for ${activeMonth}. Each memory keeps both the memory date and the date it was saved.`;
  calendarMonthHeading.textContent = `${activeMonth} ${activeYear}`;
  galleryCount.textContent = `${memories.length} ${memories.length === 1 ? "memory" : "memories"}`;
}

function renderGallery() {
  const memories = getSortedMemories();
  resetObjectUrls();
  galleryList.innerHTML = "";
  timelineList.innerHTML = "";

  if (!memories.length) {
    const empty = document.createElement("p");
    empty.className = "memory-empty";
    empty.textContent = "No memories saved for this month yet.";
    galleryList.appendChild(empty);

    const timelineEmpty = document.createElement("p");
    timelineEmpty.className = "memory-empty";
    timelineEmpty.textContent = "Timeline will appear after you save memories.";
    timelineList.appendChild(timelineEmpty);
    return;
  }

  memories.forEach((memory) => {
    const galleryFragment = galleryItemTemplate.content.cloneNode(true);
    const mediaContainer = galleryFragment.querySelector(".gallery-item__media");
    const caption = galleryFragment.querySelector(".gallery-item__caption");
    const meta = galleryFragment.querySelector(".gallery-item__meta");
    const saved = galleryFragment.querySelector(".gallery-item__saved");
    const editButton = galleryFragment.querySelector(".gallery-action--edit");
    const deleteButton = galleryFragment.querySelector(".gallery-action--delete");
    const editForm = galleryFragment.querySelector(".gallery-edit-form");
    const captionInput = galleryFragment.querySelector(".gallery-edit-caption");
    const dateInput = galleryFragment.querySelector(".gallery-edit-date");
    const fileInput = galleryFragment.querySelector(".gallery-edit-file");
    const cancelButton = galleryFragment.querySelector(".gallery-edit-cancel");
    const mediaElement = document.createElement(memory.type === "video" ? "video" : "img");

    if (memory.type === "video") {
      mediaElement.controls = true;
      mediaElement.playsInline = true;
    } else {
      mediaElement.alt = memory.caption || `${activeMonth} memory`;
    }

    mediaElement.src = createMediaUrl(memory.fileBlob);
    caption.textContent = memory.caption || "Untitled memory";
    meta.textContent = `Memory date: ${formatDate(memory.date)} | Type: ${memory.type}`;
    saved.textContent = `Saved on: ${formatSavedAt(memory.savedAt)}`;
    captionInput.value = memory.caption || "";
    dateInput.value = memory.date || "";
    mediaContainer.appendChild(mediaElement);

    editButton.addEventListener("click", () => {
      editForm.hidden = !editForm.hidden;
    });

    cancelButton.addEventListener("click", () => {
      editForm.hidden = true;
      captionInput.value = memory.caption || "";
      dateInput.value = memory.date || "";
      fileInput.value = "";
    });

    deleteButton.addEventListener("click", () => {
      openDeleteModal(memory.id);
    });

    editForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await updateMemory(memory.id, {
        caption: captionInput.value.trim(),
        date: dateInput.value,
        file: fileInput.files[0] || null
      });
    });

    galleryList.appendChild(galleryFragment);

    const timelineFragment = timelineItemTemplate.content.cloneNode(true);
    timelineFragment.querySelector(".timeline-item__date").textContent = formatDate(memory.date);
    timelineFragment.querySelector(".timeline-item__caption").textContent = memory.caption || "Untitled memory";
    timelineList.appendChild(timelineFragment);
  });
}

function renderCalendar() {
  const memories = getSortedMemories();
  calendarGrid.innerHTML = "";

  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  labels.forEach((label) => {
    const dayLabel = document.createElement("div");
    dayLabel.className = "calendar-grid__label";
    dayLabel.textContent = label;
    calendarGrid.appendChild(dayLabel);
  });

  const firstDay = new Date(activeYear, activeMonthIndex, 1).getDay();
  const daysInMonth = new Date(activeYear, activeMonthIndex + 1, 0).getDate();
  const highlightedDays = new Set(
    memories
      .map((memory) => {
        const date = new Date(memory.date);
        return Number.isNaN(date.getTime()) ? null : date.getDate();
      })
      .filter(Boolean)
  );

  for (let index = 0; index < firstDay; index += 1) {
    const spacer = document.createElement("div");
    spacer.className = "calendar-grid__cell calendar-grid__cell--empty";
    calendarGrid.appendChild(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = document.createElement("div");
    cell.className = "calendar-grid__cell";
    const number = document.createElement("span");
    number.className = "calendar-grid__number";
    number.textContent = String(day);

    if (highlightedDays.has(day)) {
      cell.classList.add("calendar-grid__cell--active");

      const pin = document.createElement("span");
      pin.className = "calendar-grid__pin";
      pin.setAttribute("aria-hidden", "true");
      pin.textContent = "\u2665";
      cell.appendChild(pin);
    }

    cell.appendChild(number);
    calendarGrid.appendChild(cell);
  }
}

async function deleteMemory(memoryId) {
  await deleteMemoryById(memoryId);
  await refreshMemoryStore();
  renderAll();
}

async function updateMemory(memoryId, updates) {
  const monthMemories = memoryStore[activeMonth] || [];
  const currentMemory = monthMemories.find((memory) => memory.id === memoryId);
  if (!currentMemory) return;

  const nextMemory = {
    ...currentMemory,
    caption: updates.caption,
    date: updates.date
  };

  if (updates.file) {
    if (!updates.file.type.startsWith("image/") && !updates.file.type.startsWith("video/")) {
      window.alert("Only image and video files are supported.");
      return;
    }

    nextMemory.fileBlob = updates.file;
    nextMemory.type = updates.file.type.startsWith("video/") ? "video" : "image";
    nextMemory.fileName = updates.file.name;
    nextMemory.savedAt = new Date().toISOString();
  }

  try {
    await saveMemory(nextMemory);
    await refreshMemoryStore();
    renderAll();
  } catch (error) {
    console.error("Failed to update file:", error);
    window.alert("This file could not be updated. Your browser storage may be full.");
  }
}

function renderAll() {
  renderHeader();
  renderGallery();
  renderCalendar();
}

function openDeleteModal(memoryId) {
  pendingDeleteMemoryId = memoryId;
  deleteModal.hidden = false;
}

function closeDeleteModal() {
  pendingDeleteMemoryId = null;
  deleteModal.hidden = true;
}

confirmDeleteButton.addEventListener("click", async () => {
  if (!pendingDeleteMemoryId) return;
  await deleteMemory(pendingDeleteMemoryId);
  closeDeleteModal();
});

cancelDeleteButton.addEventListener("click", () => {
  closeDeleteModal();
});

deleteModal.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.closeModal === "true") {
    closeDeleteModal();
  }
});

async function initializeGalleryPage() {
  await migrateLegacyLocalStorage();
  await refreshMemoryStore();
  renderAll();
}

initializeGalleryPage().catch((error) => {
  console.error("Failed to initialize gallery:", error);
});
