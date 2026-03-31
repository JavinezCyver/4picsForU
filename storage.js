const MEMORY_DB_NAME = "monthsary-memory-vault-db";
const MEMORY_DB_VERSION = 1;
const MEMORY_STORE_NAME = "memories";
const LEGACY_STORAGE_KEY = "monthsary-memory-vault-v1";

let memoryDbPromise = null;

function openMemoryDatabase() {
  if (memoryDbPromise) {
    return memoryDbPromise;
  }

  memoryDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(MEMORY_DB_NAME, MEMORY_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(MEMORY_STORE_NAME)) {
        const store = database.createObjectStore(MEMORY_STORE_NAME, { keyPath: "id" });
        store.createIndex("month", "month", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return memoryDbPromise;
}

function runMemoryTransaction(mode, operation) {
  return openMemoryDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(MEMORY_STORE_NAME, mode);
    const store = transaction.objectStore(MEMORY_STORE_NAME);
    const result = operation(store, transaction);

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

async function getAllMemories() {
  const database = await openMemoryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MEMORY_STORE_NAME, "readonly");
    const store = transaction.objectStore(MEMORY_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function saveMemory(memory) {
  await runMemoryTransaction("readwrite", (store) => {
    store.put(memory);
  });
}

async function deleteMemoryById(memoryId) {
  await runMemoryTransaction("readwrite", (store) => {
    store.delete(memoryId);
  });
}

async function clearAllMemoriesFromDb() {
  await runMemoryTransaction("readwrite", (store) => {
    store.clear();
  });
}

async function migrateLegacyLocalStorage() {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return;

  let legacyStore;
  try {
    legacyStore = JSON.parse(raw);
  } catch (error) {
    console.error("Unable to parse legacy memory store:", error);
    return;
  }

  const existingMemories = await getAllMemories();
  if (existingMemories.length > 0) {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return;
  }

  const legacyEntries = Object.entries(legacyStore);
  for (const [month, memories] of legacyEntries) {
    for (const memory of memories || []) {
      await saveMemory({
        id: memory.id,
        month,
        caption: memory.caption || "",
        date: memory.date || "",
        savedAt: memory.savedAt || new Date().toISOString(),
        type: memory.type || "image",
        fileBlob: dataUrlToBlob(memory.dataUrl),
        fileName: memory.fileName || `${memory.id}.${memory.type === "video" ? "mp4" : "png"}`
      });
    }
  }

  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

function dataUrlToBlob(dataUrl) {
  if (!dataUrl) {
    return new Blob([]);
  }

  const parts = dataUrl.split(",");
  const mimeMatch = parts[0].match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const byteCharacters = atob(parts[1]);
  const byteNumbers = new Array(byteCharacters.length);

  for (let index = 0; index < byteCharacters.length; index += 1) {
    byteNumbers[index] = byteCharacters.charCodeAt(index);
  }

  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

function groupMemoriesByMonth(memories) {
  return memories.reduce((accumulator, memory) => {
    if (!accumulator[memory.month]) {
      accumulator[memory.month] = [];
    }

    accumulator[memory.month].push(memory);
    return accumulator;
  }, {});
}
