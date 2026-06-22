(function () {
  const manifestKey = "jrc-paike-legacy-cloud-transition-v1";
  const trackedStores = {
    "paike-june-system-v1": {
      label: "平时课数据",
      mode: "regular",
      summary(parsed) {
        return {
          scheduleEntries: parsed?.scheduleEntries?.length || 0,
          teachers: parsed?.teachers?.length || 0,
          rooms: parsed?.rooms?.length || 0
        };
      }
    },
    "paike-june-system-meta-v1": {
      label: "平时课状态",
      mode: "regular-meta",
      summary(parsed) {
        return {
          lastSavedAt: parsed?.lastSavedAt || "",
          importQuestions: parsed?.importQuestions?.length || 0
        };
      }
    },
    "paike-system-prototype-v1": {
      label: "暑假数据",
      mode: "holiday",
      summary(parsed) {
        return {
          teachers: parsed?.teachers?.length || 0,
          rooms: parsed?.rooms?.length || 0,
          demands: parsed?.demands?.length || 0,
          settlementStatements: parsed?.settlementStatements?.length || 0,
          settlementLines: parsed?.settlementLines?.length || 0
        };
      }
    },
    "paike-system-prototype-meta-v1": {
      label: "暑假状态",
      mode: "holiday-meta",
      summary(parsed) {
        return {
          lastSavedAt: parsed?.lastSavedAt || "",
          scheduleView: parsed?.scheduleView || "",
          importLog: parsed?.importLog || ""
        };
      }
    },
    "paike-summer-import-review-v1": {
      label: "暑假待确认项",
      mode: "holiday-review",
      summary(parsed) {
        return {
          reviewItems: Array.isArray(parsed) ? parsed.length : 0
        };
      }
    }
  };

  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const cloudWriteTimers = new Map();
  let cloudHydrated = false;
  let hydratingPromise = null;

  function safeParse(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function readManifest() {
    const raw = nativeGetItem.call(window.localStorage, manifestKey);
    const parsed = safeParse(raw, {});
    return {
      version: "2026-06-21-paike-legacy-cloud-transition-v1",
      updatedAt: parsed.updatedAt || "",
      sourceUrl: parsed.sourceUrl || window.location.href,
      stores: parsed.stores && typeof parsed.stores === "object" ? parsed.stores : {}
    };
  }

  function writeManifest(manifest) {
    nativeSetItem.call(window.localStorage, manifestKey, JSON.stringify(manifest));
  }

  function captureStore(key, rawValue) {
    const config = trackedStores[key];
    if (!config) return;
    const raw = String(rawValue ?? "");
    const parsed = safeParse(raw);
    const manifest = readManifest();
    manifest.updatedAt = new Date().toISOString();
    manifest.sourceUrl = window.location.href;
    manifest.stores[key] = {
      key,
      label: config.label,
      mode: config.mode,
      updatedAt: manifest.updatedAt,
      bytes: new Blob([raw]).size,
      summary: config.summary(parsed)
    };
    writeManifest(manifest);
    window.dispatchEvent(new CustomEvent("jrc-paike-legacy-store-captured", {
      detail: manifest.stores[key]
    }));
    if (cloudHydrated) scheduleCloudWrite(key, raw, parsed, manifest.stores[key]);
  }

  function cloudEnabled() {
    return Boolean(window.JRC_CLOUD?.isEnabled?.());
  }

  function buildCloudPayload(key, rawValue, parsedValue, summary) {
    return {
      schemaVersion: "paike-legacy-cloud-store-v1",
      storeKey: key,
      rawValue,
      parsedValue,
      summary,
      sourceUrl: window.location.href,
      savedAt: new Date().toISOString()
    };
  }

  async function writeStoreToCloud(key, rawValue, parsedValue = safeParse(rawValue), summary = null) {
    if (!cloudEnabled() || !window.JRC_CLOUD?.writeModuleData) {
      return { ok: false, skipped: true, reason: "cloud-disabled" };
    }
    const config = trackedStores[key];
    if (!config) return { ok: false, skipped: true, reason: "untracked-store" };
    const payload = buildCloudPayload(
      key,
      String(rawValue ?? ""),
      parsedValue,
      summary || {
        key,
        label: config.label,
        mode: config.mode,
        summary: config.summary(parsedValue)
      }
    );
    try {
      const result = await window.JRC_CLOUD.writeModuleData(key, "paike-legacy", payload);
      window.dispatchEvent(new CustomEvent("jrc-paike-legacy-cloud-saved", {
        detail: { key, result }
      }));
      return result;
    } catch (error) {
      window.dispatchEvent(new CustomEvent("jrc-paike-legacy-cloud-error", {
        detail: { key, error: String(error?.message || error) }
      }));
      return { ok: false, error: String(error?.message || error) };
    }
  }

  function scheduleCloudWrite(key, rawValue, parsedValue, summary) {
    if (!cloudEnabled()) return;
    window.clearTimeout(cloudWriteTimers.get(key));
    cloudWriteTimers.set(
      key,
      window.setTimeout(() => {
        cloudWriteTimers.delete(key);
        writeStoreToCloud(key, rawValue, parsedValue, summary);
      }, 450)
    );
  }

  async function hydrateStoreFromCloud(key) {
    if (!cloudEnabled() || !window.JRC_CLOUD?.readModuleData) {
      return { key, ok: false, skipped: true, reason: "cloud-disabled" };
    }
    try {
      const result = await window.JRC_CLOUD.readModuleData(key);
      const payload = result?.data?.payload;
      if (result?.ok && result.data?.found && payload && typeof payload.rawValue === "string") {
        nativeSetItem.call(window.localStorage, key, payload.rawValue);
        return {
          key,
          ok: true,
          found: true,
          updatedAt: result.data.updatedAt || payload.savedAt || ""
        };
      }
      return { key, ok: true, found: false };
    } catch (error) {
      return { key, ok: false, error: String(error?.message || error) };
    }
  }

  async function hydrateStores(keys = Object.keys(trackedStores)) {
    if (hydratingPromise) return hydratingPromise;
    hydratingPromise = (async () => {
      const wantedKeys = keys.filter((key) => trackedStores[key]);
      const results = [];
      for (const key of wantedKeys) {
        results.push(await hydrateStoreFromCloud(key));
      }
      cloudHydrated = true;
      bootstrapExistingStores();
      for (const key of wantedKeys) {
        const result = results.find((row) => row.key === key);
        const hasLocal = nativeGetItem.call(window.localStorage, key) !== null;
        if (result?.ok && result.found === false && hasLocal) {
          const raw = nativeGetItem.call(window.localStorage, key);
          await writeStoreToCloud(key, raw);
        }
      }
      window.dispatchEvent(new CustomEvent("jrc-paike-legacy-cloud-hydrated", {
        detail: { results }
      }));
      return results;
    })();
    try {
      return await hydratingPromise;
    } finally {
      hydratingPromise = null;
    }
  }

  function bootstrapExistingStores() {
    Object.keys(trackedStores).forEach((key) => {
      const raw = nativeGetItem.call(window.localStorage, key);
      if (raw !== null) captureStore(key, raw);
    });
  }

  if (!window.localStorage || window.JRC_PAIKE_LEGACY_CLOUD_TRANSITION) return;

  Storage.prototype.setItem = function setItemWithPaikeCapture(key, value) {
    nativeSetItem.call(this, key, value);
    if (this === window.localStorage) captureStore(String(key), value);
  };

  Storage.prototype.removeItem = function removeItemWithPaikeCapture(key) {
    nativeRemoveItem.call(this, key);
  };

  window.JRC_PAIKE_LEGACY_CLOUD_TRANSITION = {
    manifestKey,
    trackedStores: Object.keys(trackedStores),
    readManifest,
    captureStore,
    bootstrapExistingStores,
    hydrateStores,
    writeStoreToCloud,
    isCloudReady: () => cloudHydrated
  };

  bootstrapExistingStores();
})();
