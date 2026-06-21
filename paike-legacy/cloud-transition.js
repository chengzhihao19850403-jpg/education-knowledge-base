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

  window.JRC_PAIKE_LEGACY_CLOUD_TRANSITION = {
    manifestKey,
    trackedStores: Object.keys(trackedStores),
    readManifest,
    captureStore,
    bootstrapExistingStores
  };

  bootstrapExistingStores();
})();
