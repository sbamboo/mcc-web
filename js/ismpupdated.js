/**
 * MCC Version Checker — VerCheck core logic.
 *
 * You **must** load these in the HTML **before** this file, in order:
 *
 *     <link
 *         rel="stylesheet"
 *         href="./js/libs/progressdrop_a0.0.4/progressdrop.min.css"
 *     />
 *     <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
 *     <script src="./js/libs/progressdrop_a0.0.4/progressdrop.min.js"></script>
 *
 *     <script src="./js/ismpupdated.js"></script>
 */

class VerCheck {
    constructor(options = {}) {
        this.options = {
            defaultProgressHostSelector:
                options.defaultProgressHostSelector ?? "#compat-progress-root",
            iconMapUrl:
                options.iconMapUrl ??
                "https://raw.githubusercontent.com/sbamboo/mcc-web/main/images/icons/icons_b64map.json",
        };
        /** @type {HTMLElement | null} */
        this._progressOverride = null;
        /** @type {Record<string, string> | null} */
        this._iconMapCache = null;
        if (typeof window !== "undefined") {
            window.__verCheckActive = this;
        }
    }

    compareMcVer(version1, version2, textPlacement) {
        return this.compareMcVerCore(version1, version2, textPlacement);
    }

    async getMccV2Modpacks(repoUrl, showHidden = false) {
        const flavors = await this.fetchRepoData(repoUrl);
        flavors.sort((a, b) => {
            const mcverCompare = this.compareMcVerCore(b.mcver, a.mcver);
            if (mcverCompare !== 0) return mcverCompare;
            return b.name.localeCompare(a.name);
        });
        if (!showHidden) {
            return flavors.filter((f) => f && f.hidden !== true);
        }
        return flavors.slice();
    }

    async getMcVersions(showReleaseOnly = true) {
        const manifest = await this.fetchMinecraftVersionManifest();
        const all = manifest.versions ?? [];
        const versions = showReleaseOnly
            ? all.filter((v) => v.type === "release")
            : all.slice();
        versions.sort(
            (a, b) => new Date(b.releaseTime) - new Date(a.releaseTime),
        );
        return versions;
    }

    async loadIconMapping() {
        if (!this._iconMapCache) {
            try {
                const response = await fetch(this.options.iconMapUrl);
                if (!response.ok) throw new Error(String(response.status));
                this._iconMapCache = await response.json();
            } catch (error) {
                console.error("Error fetching icon map:", error);
                this._iconMapCache = {};
            }
        }
        return this._iconMapCache;
    }

    async getMccV2MappedIcon(iconRaw, defaultSrc = "./images/modpack_default.png") {
        const map = await this.loadIconMapping();
        return this.resolveFlavorIconSrc(iconRaw, map, defaultSrc);
    }

    /** Same data as {@link VerCheck#loadIconMapping}; for page boot parity. */
    fetchIconMapping() {
        return this.loadIconMapping();
    }

    findFlavorByMccmp(flavors, rawQuery) {
        return this.lookupFlavorByMccmp(flavors, rawQuery);
    }

    async withProgressHost(progressdropContainer, fn) {
        const prev = this._progressOverride;
        if (progressdropContainer != null) {
            this._progressOverride =
                typeof progressdropContainer === "string"
                    ? document.querySelector(progressdropContainer)
                    : progressdropContainer;
        } else {
            this._progressOverride = null;
        }
        try {
            return await fn();
        } finally {
            this._progressOverride = prev;
        }
    }

    async loadModpackSource(flavor, progressdropContainer = null) {
        if (progressdropContainer != null) {
            return await this.withProgressHost(progressdropContainer, () =>
                this.loadAndLogModpackSource(flavor),
            );
        }
        return await this.loadAndLogModpackSource(flavor);
    }

    async getMccV2ModsFromPack(
        repoUrl,
        modpackNameOrID,
        progressdropContainer = null,
    ) {
        const flavors = await this.getMccV2Modpacks(repoUrl, true);
        const q = this.safeDecodeUriParam(modpackNameOrID).trim();
        const hit =
            q.toLowerCase() === "*latest"
                ? flavors[0]
                : this.lookupFlavorByMccmp(flavors, modpackNameOrID);
        if (!hit) {
            throw new Error("Modpack not found: " + String(modpackNameOrID));
        }
        return await this.loadModpackSource(hit, progressdropContainer);
    }

    async runModrinthCompatibilityCheck(args) {
        return this.runIsmpModrinthCompatibilityCheck(
            args.allModrinthMods,
            args.totalModsInModpack,
            args.skippedCount,
            args.selectedVersion,
            args.progressHost,
            args.resultsHost,
            args.cancelState,
            args.listing,
        );
    }

    compatProgressHost() {
        if (this._progressOverride) {
            return this._progressOverride;
        }
        const sel =
            this.options?.defaultProgressHostSelector ??
            "#compat-progress-root";
        if (typeof document !== "undefined") {
            return document.querySelector(sel);
        }
        return null;
    }

    compareMcVerCore(version1, version2, textPlacement = "last") {
    const PRE_RANK = { snapshot_n: 0, pre: 1, rc: 2, release: 3 };

    const stripNumericPrerelease = (s) => {
        const patterns = [
            [/[-_]snapshot[-_](\d+)$/i, "snapshot_n"],
            [/[-_]pre[-_](\d+)$/i, "pre"],
            [/[-_]pre(\d+)$/i, "pre"],
            [/[-_]rc[-_](\d+)$/i, "rc"],
            [/[-_]rc(\d+)$/i, "rc"],
        ];
        for (const [re, kind] of patterns) {
            const m = s.match(re);
            if (!m) continue;
            const tail = m[0];
            return {
                core: s.slice(0, -tail.length),
                preKind: kind,
                preNum: parseInt(m[1], 10) || 0,
            };
        }
        return { core: s, preKind: "release", preNum: 0 };
    };

    const parseVersion = (raw) => {
        let s = String(raw).trim();
        let textPlaceholder = "";

        const pre = stripNumericPrerelease(s);
        s = pre.core;

        const weeklyOnly = /^(\d{2})w(\d{1,2})([a-z])?$/i.exec(s);
        if (weeklyOnly) {
            const yy = parseInt(weeklyOnly[1], 10);
            const ww = parseInt(weeklyOnly[2], 10);
            const letter = weeklyOnly[3]
                ? weeklyOnly[3].toLowerCase().charCodeAt(0) - 96
                : 0;
            const baseParts = [100 + yy, ww, letter, 0, 0];
            while (baseParts.length < 5) baseParts.push(0);
            return {
                baseParts,
                preKind: pre.preKind,
                preNum: pre.preNum,
                textPlaceholder,
            };
        }

        const textMatch = s.match(/^(.+?)([a-zA-Z_]+)$/);
        if (
            textMatch &&
            /\d/.test(textMatch[1]) &&
            !/[.\-_]$/.test(textMatch[1])
        ) {
            s = textMatch[1];
            textPlaceholder = textMatch[2];
        }

        let beta = false;
        if (/^b/i.test(s)) {
            beta = true;
            s = s.replace(/^b/i, "");
        }

        const baseParts = s
            .split(/[.\-_]+/)
            .filter((p) => p.length > 0)
            .map((part) => {
                const n = parseInt(part, 10);
                return Number.isFinite(n) ? n : 0;
            });

        const merged = beta ? [0, ...baseParts] : baseParts;
        while (merged.length < 5) merged.push(0);

        return {
            baseParts: merged,
            preKind: pre.preKind,
            preNum: pre.preNum,
            textPlaceholder,
        };
    };

    const p1 = parseVersion(version1);
    const p2 = parseVersion(version2);

    const compareBaseVersions = () => {
        const n = Math.max(p1.baseParts.length, p2.baseParts.length);
        for (let i = 0; i < n; i++) {
            const a = p1.baseParts[i] || 0;
            const b = p2.baseParts[i] || 0;
            if (a > b) return 1;
            if (a < b) return -1;
        }
        return 0;
    };

    const comparePrerelease = () => {
        const r1 = PRE_RANK[p1.preKind] ?? 0;
        const r2 = PRE_RANK[p2.preKind] ?? 0;
        if (r1 > r2) return 1;
        if (r1 < r2) return -1;
        if (p1.preNum > p2.preNum) return 1;
        if (p1.preNum < p2.preNum) return -1;
        return 0;
    };

    const compareTextPlaceholders = () => {
        const t1 = p1.textPlaceholder;
        const t2 = p2.textPlaceholder;
        if (textPlacement === "last") {
            if (t1 && !t2) return 1;
            if (!t1 && t2) return -1;
            if (t1 && t2) return t1.localeCompare(t2);
        } else {
            if (t1 && !t2) return -1;
            if (!t1 && t2) return 1;
            if (t1 && t2) return t1.localeCompare(t2);
        }
        return 0;
    };

    const bc = compareBaseVersions();
    if (bc !== 0) return bc;

    const pc = comparePrerelease();
    if (pc !== 0) return pc;

    return compareTextPlaceholders();
    }

    async fetchRepoData(repoUrl) {
        try {
            const response = await fetch(repoUrl);
            const data = await response.json();
            return data.flavors;
        } catch (error) {
            console.error("Error fetching data:", error);
            return [];
        }
    }

    async fetchMinecraftVersionManifest() {
        const response = await fetch(
            "https://piston-meta.mojang.com/mc/game/version_manifest.json",
        );
        if (!response.ok) {
            throw new Error(
                `Failed to fetch Minecraft versions: ${response.statusText}`,
            );
        }
        return response.json();
    }

    safeDecodeUriParam(value) {
        if (value == null) return "";
        const s = String(value).trim();
        if (s === "") return "";
        try {
            return decodeURIComponent(s.replace(/\+/g, " "));
        } catch {
            return s;
        }
    }

    isUrlTruthyParam(raw) {
        if (raw == null) return false;
        const s = String(raw).trim().toLowerCase();
        return s === "true" || s === "1" || s === "yes";
    }

    lookupFlavorByMccmp(flavors, rawQuery) {
        if (!Array.isArray(flavors) || rawQuery == null) return null;
        const q = this.safeDecodeUriParam(rawQuery).trim();
        if (q === "") return null;
        const qLower = q.toLowerCase();
        return (
            flavors.find((f) => {
                if (!f) return false;
                const name = f.name != null ? String(f.name).trim() : "";
                const id = f.id != null ? String(f.id).trim() : "";
                return (
                    name === q ||
                    id === q ||
                    name.toLowerCase() === qLower ||
                    id.toLowerCase() === qLower
                );
            }) ?? null
        );
    }

    fullyDecodeBootUrlValue(raw) {
        if (raw == null) return "";
        let s = String(raw).trim();
        if (s === "") return "";
        /* Query values may use + for space (application/x-www-form-urlencoded). */
        s = s.replace(/\+/g, " ");
        /* Peel layers in case the whole URL was encoded more than once. */
        for (let i = 0; i < 8; i++) {
            try {
                const next = decodeURIComponent(s);
                if (next === s) break;
                s = next;
            } catch {
                break;
            }
        }
        return s.trim();
    }

    parseNavUrlBootParam(raw) {
        const s = this.fullyDecodeBootUrlValue(raw);
        if (s === "") return null;
        try {
            const u = new URL(s, window.location.href);
            if (u.protocol === "javascript:" || u.protocol === "data:")
                return null;
            return u.href;
        } catch {
            return null;
        }
    }

    applyPageHeaderNavBootParams(params) {
        const backRaw = params.get("backurl");
        const homeRaw = params.get("homeurl");
        const backHref =
            backRaw != null ? this.parseNavUrlBootParam(backRaw) : null;
        const homeHref =
            homeRaw != null ? this.parseNavUrlBootParam(homeRaw) : null;
        if (!backHref && !homeHref) return;
        const row = document.querySelector(".page-header-heading");
        if (!row) return;
        const actions = document.createElement("div");
        actions.className = "page-header-nav-actions";
        if (backHref) {
            const a = document.createElement("a");
            a.className = "page-header-back-link";
            a.href = backHref;
            a.textContent = "Go Back";
            actions.appendChild(a);
        }
        if (homeHref) {
            const a = document.createElement("a");
            a.className = "page-header-home-link";
            a.href = homeHref;
            a.textContent = "MCC Web";
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            actions.appendChild(a);
        }
        row.appendChild(actions);
    }

    applyIsmpToolbarUiBootParams(params) {
        const root = document.documentElement;
        if (this.isUrlTruthyParam(params.get("ui.mccnohidden"))) {
            root.classList.add("ismp-ui-nohidden");
        }
        if (this.isUrlTruthyParam(params.get("ui.mccnosnap"))) {
            root.classList.add("ismp-ui-nosnap");
        }
    }

    applyGuideSectionBootParam(params) {
        if (params.has("guide")) {
            document.documentElement.classList.add("ismp-show-guide");
        }
    }

    scrollToIsmpSection(sValue) {
        const idByS = {
            mcc: "section-mcc",
            "modrinth.mp": "section-modrinth-mp",
            "modrinth.mod": "section-modrinth-mod",
            guide: "section-guide",
        };
        const id = idByS[String(sValue || "").trim()];
        if (!id) return;
        const el = document.getElementById(id);
        if (el) {
            requestAnimationFrame(() =>
                el.scrollIntoView({ behavior: "smooth", block: "start" }),
            );
        }
    }

    resolveFlavorIconSrc(iconRaw, iconMapping, defaultSrc) {
        if (iconRaw == null || String(iconRaw).trim() === "") {
            return defaultSrc;
        }
        const key = String(iconRaw).trim();
        if (
            iconMapping &&
            Object.prototype.hasOwnProperty.call(iconMapping, key)
        ) {
            const mapped = iconMapping[key];
            if (mapped != null && String(mapped).trim() !== "") {
                return mapped;
            }
            return defaultSrc;
        }
        return key;
    }

    base64ToUint8Array(b64) {
        const clean = String(b64).replace(/\s/g, "");
        const binary = atob(clean);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    clearCompatProgress() {
        const root = this.compatProgressHost();
        if (root) root.innerHTML = "";
    }

    async compatFetchArrayBuffer(url, name) {
        this.clearCompatProgress();
        const root = this.compatProgressHost();
        if (!root || typeof ProgressLoader === "undefined") {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error("fetch failed: " + res.status);
            }
            return res.arrayBuffer();
        }
        const loader = new ProgressLoader(root);
        const response = await loader.fetch(
            url,
            name,
            true,
            true,
            false,
            false,
        );
        return response.arrayBuffer();
    }

    async compatLoadZipAndRun(buf, run) {
        if (typeof JSZip === "undefined") {
            throw new Error("JSZip is not loaded");
        }
        this.clearCompatProgress();
        const root = this.compatProgressHost();
        let bar = null;
        if (root && typeof ProgressLoader !== "undefined") {
            const loader = new ProgressLoader(root);
            bar = loader.createProgressBar(
                "Loading archive...",
                true,
                0,
                100,
            );
            bar.update(12);
        }
        const zip = await JSZip.loadAsync(buf);
        if (bar) bar.update(62);
        const result = await run(zip);
        if (bar) {
            bar.complete();
            bar.cleanUp();
        }
        return result;
    }

    normalizeZipPath(p) {
        return String(p).replace(/\\/g, "/");
    }

    findListingJsonPath(zip) {
        let found = null;
        zip.forEach((relPath, entry) => {
            if (entry.dir) return;
            const p = this.normalizeZipPath(relPath);
            if (/(^|\/)listing\.json$/i.test(p)) {
                if (!found || p.length < found.length) {
                    found = relPath;
                }
            }
        });
        return found;
    }

    async parseMlistingFromZip(zip) {
        const path = this.findListingJsonPath(zip);
        if (!path) {
            throw new Error("No listing.json found in mlisting archive");
        }
        const file = zip.file(path);
        if (!file || file.dir) {
            throw new Error("listing.json entry not readable");
        }
        const text = await file.async("string");
        const listing = JSON.parse(text);
        return listing;
    }

    bufferLooksLikeZip(buf) {
        if (!buf || buf.byteLength < 2) return false;
        const a = new Uint8Array(buf, 0, 2);
        return a[0] === 0x50 && a[1] === 0x4b;
    }

    async logListingFromFetchedBuffer(buf) {
        if (this.bufferLooksLikeZip(buf)) {
            return await this.compatLoadZipAndRun(buf, (zip) =>
                this.parseMlistingFromZip(zip),
            );
        }
        this.clearCompatProgress();
        const root = this.compatProgressHost();
        let bar = null;
        if (root && typeof ProgressLoader !== "undefined") {
            const loader = new ProgressLoader(root);
            bar = loader.createProgressBar(
                "Parsing listing...",
                true,
                0,
                100,
            );
            bar.update(25);
        }
        const text = new TextDecoder("utf-8").decode(buf);
        const listing = JSON.parse(text);
        if (bar) bar.update(85);
        if (bar) {
            bar.complete();
            bar.cleanUp();
        }
        return listing;
    }

    logLegacyModsFileList(zip) {
        const names = [];
        zip.forEach((relPath, entry) => {
            if (entry.dir) return;
            const p = this.normalizeZipPath(relPath);
            const m = /^mods\/(.+)$/i.exec(p);
            if (m) names.push(m[1]);
        });
        names.sort();
        console.log("legacy mods/ file list:", names);
        return names;
    }

    async logLegacyArchiveZip(data) {
        return await this.compatLoadZipAndRun(data, (zip) => {
            return this.logLegacyModsFileList(zip);
        });
    }

    compatModrinthResultsEl() {
        return document.getElementById("compat-modrinth-results");
    }

    clearCompatModrinthResults() {
        const el = this.compatModrinthResultsEl();
        if (el) el.innerHTML = "";
    }

    generateRandomString(length) {
        const chars =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let out = "";
        for (let i = 0; i < length; i++) {
            out += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return out;
    }

    /**
     * Build Modrinth `/v2/search` `facets` JSON from UI filter state.
     * Uses AND between facet groups, OR within each group (see Modrinth search docs).
     *
     * @param {{
     *   categories?: string[],
     *   loaders?: string[],
     *   environment?: { client?: boolean, server?: boolean },
     *   openSourceOnly?: boolean,
     * }} [filters]
     * @returns {string} JSON string for the `facets` query parameter
     */
    buildModrinthModpackSearchFacets(filters = {}) {
        const facetGroups = [["project_type:modpack"]];
        const cats = Array.isArray(filters.categories)
            ? filters.categories
                  .map((c) => String(c ?? "").trim())
                  .filter((c) => c !== "")
            : [];
        const loaders = Array.isArray(filters.loaders)
            ? filters.loaders
                  .map((l) => String(l ?? "").trim())
                  .filter((l) => l !== "")
            : [];
        if (cats.length > 0) {
            facetGroups.push(cats.map((c) => `categories:${c}`));
        }
        if (loaders.length > 0) {
            facetGroups.push(loaders.map((l) => `categories:${l}`));
        }
        const env = filters.environment || {};
        if (env.client === true) {
            facetGroups.push(["client_side:required", "client_side:optional"]);
        }
        if (env.server === true) {
            facetGroups.push(["server_side:required", "server_side:optional"]);
        }
        if (filters.openSourceOnly === true) {
            facetGroups.push(["open_source:true"]);
        }
        return JSON.stringify(facetGroups);
    }

    /**
     * Build Modrinth `/v2/search` facets for **mod** projects (not modpacks).
     * Same filter shape as {@link VerCheck#buildModrinthModpackSearchFacets}.
     *
     * @param {{
     *   categories?: string[],
     *   loaders?: string[],
     *   environment?: { client?: boolean, server?: boolean },
     *   openSourceOnly?: boolean,
     * }} [filters]
     * @returns {string} JSON string for the `facets` query parameter
     */
    buildModrinthModSearchFacets(filters = {}) {
        const facetGroups = [["project_type:mod"]];
        const cats = Array.isArray(filters.categories)
            ? filters.categories
                  .map((c) => String(c ?? "").trim())
                  .filter((c) => c !== "")
            : [];
        const loaders = Array.isArray(filters.loaders)
            ? filters.loaders
                  .map((l) => String(l ?? "").trim())
                  .filter((l) => l !== "")
            : [];
        if (cats.length > 0) {
            facetGroups.push(cats.map((c) => `categories:${c}`));
        }
        if (loaders.length > 0) {
            facetGroups.push(loaders.map((l) => `categories:${l}`));
        }
        const env = filters.environment || {};
        if (env.client === true) {
            facetGroups.push(["client_side:required", "client_side:optional"]);
        }
        if (env.server === true) {
            facetGroups.push(["server_side:required", "server_side:optional"]);
        }
        if (filters.openSourceOnly === true) {
            facetGroups.push(["open_source:true"]);
        }
        return JSON.stringify(facetGroups);
    }

    /**
     * Search Modrinth for mod projects ({@link https://api.modrinth.com}).
     * Empty `query` returns `{ hits: [], totalHits: 0 }` without a network call.
     *
     * @param {string} query
     * @param {{
     *   limit?: number,
     *   offset?: number,
     *   signal?: AbortSignal,
     *   filters?: {
     *     categories?: string[],
     *     loaders?: string[],
     *     environment?: { client?: boolean, server?: boolean },
     *     openSourceOnly?: boolean,
     *   },
     * }} [options]
     * @returns {Promise<{ hits: object[], totalHits: number, limit: number, offset: number }>}
     */
    async searchModrinthMods(query, options = {}) {
        const q = String(query ?? "").trim();
        if (!q) {
            return { hits: [], totalHits: 0, limit: 0, offset: 0 };
        }
        const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
        const offset = Math.max(Number(options.offset) || 0, 0);
        const facets = this.buildModrinthModSearchFacets(options.filters ?? {});
        const ua = `minecraftcustomclient-website-modrinth-mod@${this.generateRandomString(
            8,
        )}`;
        const url =
            "https://api.modrinth.com/v2/search" +
            `?query=${encodeURIComponent(q)}` +
            `&facets=${encodeURIComponent(facets)}` +
            `&limit=${encodeURIComponent(String(limit))}` +
            `&offset=${encodeURIComponent(String(offset))}`;
        const res = await fetch(url, {
            headers: { "User-Agent": ua },
            signal: options.signal ?? undefined,
        });
        if (!res.ok) {
            throw new Error(`Modrinth search HTTP ${res.status}`);
        }
        const data = await res.json();
        const hits = Array.isArray(data.hits) ? data.hits : [];
        const totalHits =
            typeof data.total_hits === "number" ? data.total_hits : hits.length;
        return {
            hits,
            totalHits,
            limit: typeof data.limit === "number" ? data.limit : limit,
            offset: typeof data.offset === "number" ? data.offset : offset,
        };
    }

    /**
     * Search Modrinth for modpack projects ({@link https://api.modrinth.com}).
     * Empty `query` returns `{ hits: [], totalHits: 0 }` without a network call.
     *
     * @param {string} query
     * @param {{
     *   limit?: number,
     *   offset?: number,
     *   signal?: AbortSignal,
     *   filters?: {
     *     categories?: string[],
     *     loaders?: string[],
     *     environment?: { client?: boolean, server?: boolean },
     *     openSourceOnly?: boolean,
     *   },
     * }} [options]
     * @returns {Promise<{ hits: object[], totalHits: number, limit: number, offset: number }>}
     */
    async searchModrinthModpacks(query, options = {}) {
        const q = String(query ?? "").trim();
        if (!q) {
            return { hits: [], totalHits: 0, limit: 0, offset: 0 };
        }
        const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
        const offset = Math.max(Number(options.offset) || 0, 0);
        const facets = this.buildModrinthModpackSearchFacets(
            options.filters ?? {},
        );
        const ua = `minecraftcustomclient-website-modrinth-mp@${this.generateRandomString(
            8,
        )}`;
        const url =
            "https://api.modrinth.com/v2/search" +
            `?query=${encodeURIComponent(q)}` +
            `&facets=${encodeURIComponent(facets)}` +
            `&limit=${encodeURIComponent(String(limit))}` +
            `&offset=${encodeURIComponent(String(offset))}`;
        const res = await fetch(url, {
            headers: { "User-Agent": ua },
            signal: options.signal ?? undefined,
        });
        if (!res.ok) {
            throw new Error(`Modrinth search HTTP ${res.status}`);
        }
        const data = await res.json();
        const hits = Array.isArray(data.hits) ? data.hits : [];
        const totalHits =
            typeof data.total_hits === "number" ? data.total_hits : hits.length;
        return {
            hits,
            totalHits,
            limit: typeof data.limit === "number" ? data.limit : limit,
            offset: typeof data.offset === "number" ? data.offset : offset,
        };
    }

    /**
     * Lists all published file versions for a Modrinth project (paginated).
     *
     * @param {string} projectId
     * @param {{ signal?: AbortSignal }} [options]
     * @returns {Promise<object[]>}
     */
    async fetchModrinthProjectVersions(projectId, options = {}) {
        const pid = String(projectId ?? "").trim();
        if (!pid) {
            throw new Error("Modrinth project id is empty");
        }
        const ua = `minecraftcustomclient-website-modrinth-ver@${this.generateRandomString(
            8,
        )}`;
        const signal = options.signal;
        const all = [];
        let offset = 0;
        const limit = 100;
        for (;;) {
            const url =
                `https://api.modrinth.com/v2/project/${encodeURIComponent(
                    pid,
                )}/version?limit=${encodeURIComponent(String(limit))}` +
                `&offset=${encodeURIComponent(String(offset))}`;
            const res = await fetch(url, {
                headers: { "User-Agent": ua },
                signal,
            });
            if (!res.ok) {
                throw new Error(`Modrinth versions HTTP ${res.status}`);
            }
            const chunk = await res.json();
            if (!Array.isArray(chunk) || chunk.length === 0) {
                break;
            }
            all.push(...chunk);
            if (chunk.length < limit) {
                break;
            }
            offset += limit;
        }
        return all;
    }

    /**
     * Whether the project has at least one file version that lists the given
     * Minecraft version in `game_versions`, and the union of all declared MC
     * versions (newest first per {@link VerCheck#compareMcVer}).
     *
     * @param {string} projectId
     * @param {string} minecraftVersion
     * @param {{ signal?: AbortSignal }} [options]
     * @returns {Promise<{
     *   supportsSelected: boolean,
     *   selectedMinecraftVersion: string,
     *   allGameVersions: string[],
     *   otherGameVersions: string[],
     *   fileVersionCount: number,
     * }>}
     */
    async checkModrinthModUpdatedForMcVersion(
        projectId,
        minecraftVersion,
        options = {},
    ) {
        const mc = String(minecraftVersion ?? "").trim();
        if (!mc) {
            throw new Error("Minecraft version is empty");
        }
        const versions = await this.fetchModrinthProjectVersions(
            projectId,
            options,
        );
        const gameSet = new Set();
        for (const v of versions) {
            const gv = v?.game_versions;
            if (!Array.isArray(gv)) {
                continue;
            }
            for (const x of gv) {
                const s = String(x ?? "").trim();
                if (s) {
                    gameSet.add(s);
                }
            }
        }
        const allGameVersions = [...gameSet].sort((a, b) =>
            this.compareMcVer(b, a),
        );
        const supportsSelected = gameSet.has(mc);
        const otherGameVersions = allGameVersions.filter((v) => v !== mc);
        return {
            supportsSelected,
            selectedMinecraftVersion: mc,
            allGameVersions,
            otherGameVersions,
            fileVersionCount: versions.length,
        };
    }

    async fetchModrinthLatestVersionDisplayLabel(projectId, modLoader) {
        const ua = `minecraftcustomclient-website-compat@${this.generateRandomString(
            8,
        )}`;
        const opts = { headers: { "User-Agent": ua } };
        const loader =
            modLoader != null && String(modLoader).trim() !== ""
                ? String(modLoader).trim()
                : "fabric";
        const encLoader = encodeURIComponent(JSON.stringify([loader]));
        let url = `https://api.modrinth.com/v2/project/${encodeURIComponent(
            projectId,
        )}/version?loaders=${encLoader}`;
        let res = await fetch(url, opts);
        if (!res.ok && res.status !== 404) {
            throw new Error(`HTTP ${res.status}`);
        }
        let arr = await res.json();
        if (!Array.isArray(arr)) arr = [];
        if (arr.length === 0) {
            url = `https://api.modrinth.com/v2/project/${encodeURIComponent(
                projectId,
            )}/version`;
            res = await fetch(url, opts);
            if (!res.ok && res.status !== 404) {
                throw new Error(`HTTP ${res.status}`);
            }
            arr = await res.json();
            if (!Array.isArray(arr)) arr = [];
        }
        if (arr.length === 0) {
            return "No published versions found.";
        }
        const sorted = arr.slice().sort((a, b) => {
            const ta = Date.parse(String(a.date_published ?? ""));
            const tb = Date.parse(String(b.date_published ?? ""));
            if (Number.isFinite(tb) && Number.isFinite(ta) && tb !== ta) {
                return tb - ta;
            }
            return 0;
        });
        const v = sorted[0];
        const label =
            (v.version_number != null &&
                String(v.version_number).trim()) ||
            (v.name != null && String(v.name).trim()) ||
            (v.id != null && String(v.id).trim()) ||
            "(version)";
        let extra = "";
        if (Array.isArray(v.game_versions) && v.game_versions.length > 0) {
            const gv = v.game_versions.slice().reverse().slice(0, 4);
            const tail = v.game_versions.length > 4 ? ", …" : "";
            extra = ` · MC ${gv.join(", ")}${tail}`;
        }
        return label + extra;
    }

    async onCompatModrinthNotUpdatedInfoClick(ev) {
        const btn = ev.target.closest(".compat-not-updated-modrinth-info");
        if (!btn) return;
        const panel = btn.closest(".compat-modrinth-results");
        if (!panel) return;
        ev.preventDefault();
        if (btn.disabled || btn.dataset.compatFetching === "1") return;
        const projectId = btn.getAttribute("data-project-id");
        const modLoader =
            btn.getAttribute("data-mod-loader") || "fabric";
        if (!projectId) return;
        const out = btn.nextElementSibling;
        if (
            !out ||
            !out.classList.contains("compat-not-updated-modrinth-version")
        ) {
            return;
        }

        btn.dataset.compatFetching = "1";
        out.textContent = "Loading…";
        try {
            const label = await this.fetchModrinthLatestVersionDisplayLabel(
                projectId,
                modLoader,
            );
            out.textContent = label;
            btn.disabled = true;
            btn.classList.add("is-done");
        } catch (err) {
            console.error(err);
            out.textContent = "Could not load version.";
        } finally {
            delete btn.dataset.compatFetching;
        }
    }

    listingDefaultModloader(listing) {
        if (!listing || typeof listing !== "object") return "fabric";
        return (
            listing.modloader ||
            listing.modLoader ||
            listing.loader ||
            "fabric"
        );
    }

    /**
     * @param {Record<string, unknown>} index
     * @returns {string}
     */
    mrpackDefaultModloaderFromIndex(index) {
        const d =
            index && typeof index === "object" && index.dependencies != null
                ? /** @type {Record<string, unknown>} */ (index.dependencies)
                : {};
        const ks = new Set(
            Object.keys(d).map((k) => String(k).toLowerCase()),
        );
        if (ks.has("fabric-loader")) return "fabric";
        if (ks.has("quilt-loader")) return "quilt";
        if (ks.has("neoforge")) return "neoforge";
        if (ks.has("forge")) return "forge";
        return "fabric";
    }

    /**
     * @param {{ downloads?: unknown }} file
     * @returns {string[]}
     */
    modrinthIndexFileDownloadUrls(file) {
        const d = file?.downloads;
        if (d == null) return [];
        if (Array.isArray(d)) {
            return d.filter((x) => typeof x === "string").map(String);
        }
        if (typeof d === "object") {
            return Object.keys(/** @type {Record<string, unknown>} */ (d));
        }
        return [];
    }

    /**
     * @param {string} url
     * @returns {string | null}
     */
    extractModrinthProjectIdFromPackDownloadUrl(url) {
        if (url == null || String(url).trim() === "") return null;
        try {
            const u = new URL(String(url).trim());
            if (!/modrinth\.com$/i.test(u.hostname)) return null;
            const m = u.pathname.match(/\/data\/([a-zA-Z0-9]+)\//);
            if (m) return m[1];
        } catch (_) {
            /* ignore */
        }
        return null;
    }

    /**
     * Converts `modrinth.index.json` content into an MCC-style v2 listing
     * so {@link VerCheck#extractModrinthModsFromListing} / compat check can run.
     *
     * @param {object} index
     * @returns {{ sources: object[], modloader: string }}
     */
    modrinthPackIndexToMccStyleListing(index) {
        const defaultLoader = this.mrpackDefaultModloaderFromIndex(index);
        const files = Array.isArray(index.files) ? index.files : [];
        const sources = [];
        for (const f of files) {
            if (!f || typeof f !== "object") continue;
            const path = f.path != null ? String(f.path) : "";
            const leaf = path.split("/").filter(Boolean).pop() || path || "entry";
            let projectId = null;
            for (const u of this.modrinthIndexFileDownloadUrls(f)) {
                projectId = this.extractModrinthProjectIdFromPackDownloadUrl(u);
                if (projectId) break;
            }
            if (projectId) {
                sources.push({
                    type: "modrinth",
                    filename: leaf,
                    url: `https://modrinth.com/mod/${projectId}/versions/x`,
                    modloader: defaultLoader,
                });
            } else {
                sources.push({
                    type: "unknown",
                    filename: leaf,
                    url: "",
                });
            }
        }
        return { sources, modloader: defaultLoader };
    }

    findModrinthIndexJsonPath(zip) {
        let found = null;
        zip.forEach((relPath, entry) => {
            if (entry.dir) return;
            const p = this.normalizeZipPath(relPath);
            if (/modrinth\.index\.json$/i.test(p)) {
                if (!found || p.length < this.normalizeZipPath(found).length) {
                    found = relPath;
                }
            }
        });
        return found;
    }

    async parseModrinthMrpackIndexFromZip(zip) {
        const path = this.findModrinthIndexJsonPath(zip);
        if (!path) {
            throw new Error("modrinth.index.json not found in .mrpack");
        }
        const file = zip.file(path);
        if (!file || file.dir) {
            throw new Error("modrinth.index.json entry not readable");
        }
        const text = await file.async("string");
        return JSON.parse(text);
    }

    /**
     * @param {object} version
     * @returns {object | null}
     */
    pickMrpackFileFromVersion(version) {
        const files = Array.isArray(version?.files) ? version.files : [];
        const mrpacks = files.filter(
            (f) =>
                f &&
                f.url &&
                String(f.filename || "")
                    .toLowerCase()
                    .endsWith(".mrpack"),
        );
        if (mrpacks.length === 0) return null;
        const primary = mrpacks.find((f) => f.primary);
        return primary || mrpacks[0];
    }

    /**
     * @param {object[]} versions
     * @returns {object | null}
     */
    pickModrinthVersionWithMrpack(versions) {
        if (!Array.isArray(versions)) return null;
        for (const v of versions) {
            if (this.pickMrpackFileFromVersion(v)) return v;
        }
        return null;
    }

    /**
     * Resolves a Modrinth modpack `.mrpack` download URL for a project + game version.
     *
     * @param {string} projectId
     * @param {string} minecraftVersion
     * @param {{ signal?: AbortSignal }} [options]
     */
    async fetchModrinthModpackMrpackFileUrl(
        projectId,
        minecraftVersion,
        options = {},
    ) {
        const pid = String(projectId ?? "").trim();
        const mc = String(minecraftVersion ?? "").trim();
        if (!pid) throw new Error("Modrinth project id is empty");
        if (!mc) throw new Error("Minecraft version is empty");
        const ua = `minecraftcustomclient-website-mrpack@${this.generateRandomString(
            8,
        )}`;
        const encGv = encodeURIComponent(JSON.stringify([mc]));
        const signal = options.signal;
        let res = await fetch(
            `https://api.modrinth.com/v2/project/${encodeURIComponent(pid)}/version?game_versions=${encGv}`,
            {
                headers: { "User-Agent": ua },
                signal,
            },
        );
        if (!res.ok) {
            throw new Error(`Modrinth versions HTTP ${res.status}`);
        }
        let versions = await res.json();
        if (!Array.isArray(versions)) versions = [];
        let versionHit = this.pickModrinthVersionWithMrpack(versions);
        if (!versionHit) {
            res = await fetch(
                `https://api.modrinth.com/v2/project/${encodeURIComponent(pid)}/version`,
                { headers: { "User-Agent": ua }, signal },
            );
            if (!res.ok) {
                throw new Error(`Modrinth versions HTTP ${res.status}`);
            }
            const all = await res.json();
            versionHit = this.pickModrinthVersionWithMrpack(
                Array.isArray(all) ? all : [],
            );
        }
        if (!versionHit) {
            throw new Error(
                "No .mrpack Modrinth pack version found for this project / game version.",
            );
        }
        const file = this.pickMrpackFileFromVersion(versionHit);
        if (!file?.url) {
            throw new Error("Modrinth pack version has no .mrpack file URL");
        }
        return { fileUrl: String(file.url), version: versionHit };
    }

    /**
     * Downloads the project's `.mrpack` for `minecraftVersion` and returns an MCC-style v2 listing
     * built from `modrinth.index.json` (progress via {@link VerCheck#compatProgressHost}).
     *
     * @param {string} projectId
     * @param {string} minecraftVersion
     * @param {{ signal?: AbortSignal }} [options]
     * @returns {Promise<{ listing: object }>}
     */
    async getModrinthModpackModsListingFromMrpack(
        projectId,
        minecraftVersion,
        options = {},
    ) {
        const { fileUrl } = await this.fetchModrinthModpackMrpackFileUrl(
            projectId,
            minecraftVersion,
            options,
        );
        const buf = await this.compatFetchArrayBuffer(
            fileUrl,
            "Fetching Modrinth .mrpack…",
        );
        const listing = await this.compatLoadZipAndRun(buf, async (zip) => {
            const index = await this.parseModrinthMrpackIndexFromZip(zip);
            return this.modrinthPackIndexToMccStyleListing(index);
        });
        return { listing };
    }

    /**
     * Runs the same Modrinth-per-mod version check as the ISMP/MCC flow.
     */
    async runModrinthPackModrinthCompatibilityCheck(
        allModrinthMods,
        totalModsInModpack,
        skippedCount,
        selectedVersion,
        progressHost,
        resultsHost,
        cancelState,
        listing,
    ) {
        return this.runIsmpModrinthCompatibilityCheck(
            allModrinthMods,
            totalModsInModpack,
            skippedCount,
            selectedVersion,
            progressHost,
            resultsHost,
            cancelState,
            listing,
        );
    }

    sourceIsCountedAsModrinthForCheck(mod) {
        if (!mod || mod.type !== "modrinth" || !mod.url) return false;
        const modrinthId = mod.url
            .split("/versions/")[0]
            .split("/")
            .filter(Boolean)
            .pop();
        return Boolean(modrinthId);
    }

    extractModrinthModsFromListing(listing) {
        if (!listing || !Array.isArray(listing.sources)) return [];
        const defaultLoader = this.listingDefaultModloader(listing);
        const out = [];
        for (const mod of listing.sources) {
            if (!this.sourceIsCountedAsModrinthForCheck(mod)) continue;
            const modrinthId = mod.url
                .split("/versions/")[0]
                .split("/")
                .filter(Boolean)
                .pop();
            out.push({
                id: modrinthId,
                filename: mod.filename || modrinthId,
                modloader: mod.modloader || defaultLoader,
            });
        }
        return out;
    }

    compatCheckingLabel(n, total, skipped) {
        return `Checking compatibility... (${n}/${total} checked on Modrinth, ${skipped} skipped)`;
    }

    /**
     * Tooltip panel HTML for mods that matched the selected MC version on Modrinth.
     * @param {{ name: string, url: string }[]} mods
     */
    buildUpdatedModsTooltipBodyHtml(mods) {
        if (!mods || mods.length === 0) return "";
        const items = mods
            .map((m) => {
                const name = this.escapeHtml(m.name ?? "");
                const rawUrl = m.url != null ? String(m.url).trim() : "";
                const safe = rawUrl ? this.safeHttpUrl(rawUrl) : null;
                const href = safe ? this.escapeHtml(safe) : "";
                if (href) {
                    return `<li><a href="${href}" target="_blank" rel="noopener noreferrer">${name}</a></li>`;
                }
                return `<li>${name}</li>`;
            })
            .join("");
        return `<span class="compat-mc-stat-tip-body" role="tooltip"><ul class="compat-mc-stat-tip-list">${items}</ul></span>`;
    }

    async runIsmpModrinthCompatibilityCheck(
        allModrinthMods,
        totalModsInModpack,
        skippedCount,
        selectedVersion,
        progressHost,
        resultsHost,
        cancelState,
        listing,
    ) {
        const modrinthModsToCheck = allModrinthMods.length;
        let updatedModsCount = 0;
        /** @type {{ name: string, url: string }[]} */
        const updatedMods = [];
        const notUpdatedMods = [];

        const modrinthCompatUserAgent = `minecraftcustomclient-website-compat@${this.generateRandomString(
            8,
        )}`;
        console.log("Modrinth API User-Agent:", modrinthCompatUserAgent);

        progressHost.innerHTML = "";
        let bar = null;
        if (typeof ProgressLoader !== "undefined") {
            const loader = new ProgressLoader(progressHost);
            bar = loader.createProgressBar(
                this.compatCheckingLabel(
                    0,
                    modrinthModsToCheck,
                    skippedCount,
                ),
                true,
                0,
                100,
            );
        }

        for (let i = 0; i < modrinthModsToCheck; i++) {
            if (cancelState && cancelState.cancelled) {
                break;
            }

            const mod = allModrinthMods[i];
            const projectId = mod.id;
            const modLoader = mod.modloader;
            const modrinthProjectUrl = `https://modrinth.com/mod/${projectId}`;

            if (bar) {
                bar.updateName(
                    this.compatCheckingLabel(
                        i + 1,
                        modrinthModsToCheck,
                        skippedCount,
                    ),
                );
            }

            try {
                const compatibility_modrinth_api_requestOptions = {
                    headers: {
                        "User-Agent": modrinthCompatUserAgent,
                    },
                };
                const modrinthVersionsResponse = await fetch(
                    `https://api.modrinth.com/v2/project/${projectId}/version?game_versions=["${selectedVersion}"]&loaders=["${modLoader}"]`,
                    compatibility_modrinth_api_requestOptions,
                );
                if (
                    !modrinthVersionsResponse.ok &&
                    modrinthVersionsResponse.status !== 404
                ) {
                    throw new Error(
                        `HTTP error! status: ${modrinthVersionsResponse.status}`,
                    );
                }
                const modrinthVersions =
                    await modrinthVersionsResponse.json();

                if (modrinthVersions.length > 0) {
                    updatedModsCount++;
                    updatedMods.push({
                        name: mod.filename,
                        url: modrinthProjectUrl,
                    });
                } else {
                    notUpdatedMods.push({
                        name: mod.filename,
                        url: modrinthProjectUrl,
                        projectId,
                        modLoader,
                    });
                }
            } catch (error) {
                console.error(
                    `Error checking Modrinth mod ${projectId} (${mod.filename}):`,
                    error,
                );
                notUpdatedMods.push({
                    name: mod.filename,
                    url: modrinthProjectUrl,
                    projectId,
                    modLoader,
                });
            }

            if (bar) {
                bar.update(((i + 1) / modrinthModsToCheck) * 100);
            }
        }

        if (bar) {
            bar.complete();
            bar.cleanUp();
        }

        const progressRow = progressHost.closest(".compat-modrinth-progress-row");
        progressRow?.querySelector(".compat-modrinth-cancel")?.remove();

        if (cancelState && cancelState.cancelled) {
            resultsHost.innerHTML =
                '<p class="compat-modrinth-orange">Check cancelled.</p>';
            return;
        }

        const notCheckedMods = this.buildSkippedNotCheckedEntries(listing);
        const uncheckedModsCount = notCheckedMods.length;

        const percentageUpdatedOverall =
            totalModsInModpack > 0
                ? (
                        (updatedModsCount / totalModsInModpack) *
                        100
                    ).toFixed(2)
                : "0.00";

        const modrinthPercentageUpdated =
            modrinthModsToCheck > 0
                ? (
                        (updatedModsCount / modrinthModsToCheck) *
                        100
                    ).toFixed(2)
                : "0.00";

        const uncheckedProportionPercentage =
            totalModsInModpack > 0
                ? (
                        (uncheckedModsCount / totalModsInModpack) *
                        100
                    ).toFixed(2)
                : "0.00";

        const notUpdatedNonMc =
            totalModsInModpack -
            updatedModsCount -
            uncheckedModsCount;

        const updatedModsTipBody =
            updatedMods.length > 0
                ? this.buildUpdatedModsTooltipBodyHtml(updatedMods)
                : "";
        const statMixHtml =
            updatedMods.length > 0
                ? `<span class="compat-mc-stat-mix compat-mc-stat-tip" tabindex="0"><span class="compat-mc-stat-tip-trigger">${percentageUpdatedOverall}% (${updatedModsCount})</span>${updatedModsTipBody}</span>`
                : `<span class="compat-mc-stat-mix">${percentageUpdatedOverall}% (${updatedModsCount})</span>`;
        const statModrinthOkHtml =
            updatedMods.length > 0
                ? `<span class="compat-mc-stat-ok compat-mc-stat-tip" tabindex="0"><span class="compat-mc-stat-tip-trigger">${modrinthPercentageUpdated}% (${updatedModsCount})</span>${updatedModsTipBody}</span>`
                : `<span class="compat-mc-stat-ok">${modrinthPercentageUpdated}% (${updatedModsCount})</span>`;

        resultsHost.innerHTML = `
        <div class="compat-modrinth-summary-line">
            ${statMixHtml}
            updated to ${this.escapeHtml(selectedVersion)} out of
            <span class="compat-mc-stat-total">${totalModsInModpack}</span>
            [
            ${statModrinthOkHtml} Modrinth,
            <span class="compat-mc-stat-bad">${(
                100 - Number(percentageUpdatedOverall)
            ).toFixed(2)}% (${notUpdatedNonMc})</span> not updated Modrinth,
            <span class="compat-mc-stat-skip">${uncheckedProportionPercentage}% (${uncheckedModsCount})</span> skipped
            ]
        </div>
        ${
            notUpdatedMods.length > 0
                ? `
        <details class="compat-modrinth-details">
            <summary>Not updated Modrinth mods (${notUpdatedMods.length})</summary>
            <div class="compat-modrinth-scroll-list">
                <ul>
                    ${notUpdatedMods
                        .map((m) => {
                            const pid = this.escapeHtml(m.projectId ?? "");
                            const ldr = this.escapeHtml(m.modLoader ?? "fabric");
                            return `<li class="compat-not-updated-modrinth-li"><a href="${this.escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(m.name)}</a><button type="button" class="compat-not-updated-modrinth-info" title="Click to fetch the current version" aria-label="Fetch latest Modrinth version for this loader" data-project-id="${pid}" data-mod-loader="${ldr}">🛈</button><span class="compat-not-updated-modrinth-version" aria-live="polite"></span></li>`;
                        })
                        .join("")}
                </ul>
            </div>
        </details>`
                : ""
        }
        ${
            notCheckedMods.length > 0
                ? `
        <details class="compat-modrinth-details">
            <summary>Skipped / not checked (${notCheckedMods.length})</summary>
            <div class="compat-modrinth-scroll-list">
                <ul>
                    ${notCheckedMods
                        .map((m) =>
                            m.url
                                ? `<li><a href="${this.escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(m.name)}</a></li>`
                                : `<li>${this.escapeHtml(m.name)}</li>`,
                        )
                        .join("")}
                </ul>
            </div>
        </details>`
                : ""
        }
    `;
    }

    escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    downloadBlobFile(blob, filename) {
        const name =
            filename != null && String(filename).trim() !== ""
                ? String(filename).split(/[/\\]/).pop()
                : "download";
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 800);
    }

    safeHttpUrl(url) {
        if (url == null || String(url).trim() === "") return null;
        try {
            const u = new URL(String(url).trim(), window.location.href);
            if (u.protocol === "http:" || u.protocol === "https:")
                return u.href;
        } catch (_) {
            /* ignore */
        }
        return null;
    }

    buildSkippedNotCheckedEntries(listing) {
        if (!listing || !Array.isArray(listing.sources)) return [];
        const out = [];
        for (const mod of listing.sources) {
            if (!mod) continue;
            if (this.sourceIsCountedAsModrinthForCheck(mod)) continue;
            const name =
                mod.filename != null && String(mod.filename).trim() !== ""
                    ? String(mod.filename)
                    : mod.type != null && String(mod.type).trim() !== ""
                        ? `(unnamed — ${mod.type})`
                        : "(unnamed entry)";
            const rawUrl = mod.url != null ? String(mod.url).trim() : "";
            const url = rawUrl ? this.safeHttpUrl(rawUrl) : null;
            out.push({ name, url });
        }
        return out;
    }

    findZipPathForModFile(zip, filenameHint) {
        if (!zip || filenameHint == null) return null;
        const base = this.normalizeZipPath(String(filenameHint))
            .split("/")
            .filter(Boolean)
            .pop();
        if (!base) return null;
        let found = null;
        zip.forEach((relPath, entry) => {
            if (entry.dir) return;
            const p = this.normalizeZipPath(relPath);
            const leaf = p.split("/").filter(Boolean).pop();
            if (leaf === base) {
                if (!found || p.length < found.length) {
                    found = relPath;
                }
            }
        });
        return found;
    }

    async populateListingModsUl(ul, sources, zipBuffer) {
        if (!ul || !Array.isArray(sources)) return;
        let zip = null;
        if (zipBuffer) {
            try {
                zip = await JSZip.loadAsync(zipBuffer);
            } catch (err) {
                console.warn(
                    "Could not open mlisting zip for embedded file links:",
                    err,
                );
            }
        }
        for (const mod of sources) {
            if (!mod || typeof mod !== "object") continue;
            const li = document.createElement("li");
            const label =
                mod.filename != null && String(mod.filename).trim() !== ""
                    ? String(mod.filename)
                    : "(unnamed entry)";
            const type =
                mod.type != null && String(mod.type).trim() !== ""
                    ? String(mod.type)
                    : "";

            if (
                type === "customB64" ||
                type === "customArchiveB64"
            ) {
                const b64 = mod.base64;
                if (typeof b64 === "string" && b64.replace(/\s/g, "") !== "") {
                    const a = document.createElement("a");
                    a.href = "#";
                    a.textContent = label;
                    a.addEventListener("click", (e) => {
                        e.preventDefault();
                        try {
                            const bytes = this.base64ToUint8Array(b64);
                            const blob = new Blob([bytes], {
                                type: "application/octet-stream",
                            });
                            this.downloadBlobFile(blob, label);
                        } catch (err) {
                            console.error(
                                "Embedded mod download failed:",
                                err,
                            );
                        }
                    });
                    li.appendChild(a);
                } else {
                    li.textContent = `${label} (${type}, no data)`;
                }
                ul.appendChild(li);
                continue;
            }

            const rawUrl = mod.url != null ? String(mod.url).trim() : "";
            const safe = rawUrl ? this.safeHttpUrl(rawUrl) : null;
            if (safe) {
                const a = document.createElement("a");
                a.href = safe;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                a.textContent = label;
                li.appendChild(a);
                ul.appendChild(li);
                continue;
            }

            if (zip) {
                const zp = this.findZipPathForModFile(zip, label);
                if (zp) {
                    const zpath = zp;
                    const a = document.createElement("a");
                    a.href = "#";
                    a.textContent = label;
                    const zipRef = zip;
                    a.addEventListener("click", async (e) => {
                        e.preventDefault();
                        try {
                            const entry = zipRef.file(zpath);
                            if (!entry || entry.dir) return;
                            const blob = await entry.async("blob");
                            this.downloadBlobFile(blob, label);
                        } catch (err) {
                            console.error("Zip mod download failed:", err);
                        }
                    });
                    li.appendChild(a);
                    ul.appendChild(li);
                    continue;
                }
            }

            li.textContent = type ? `${label} (${type})` : label;
            ul.appendChild(li);
        }
    }

    uint8ViewToArrayBuffer(u8) {
        if (!u8 || !u8.byteLength) {
            return new ArrayBuffer(0);
        }
        return u8.buffer.slice(
            u8.byteOffset,
            u8.byteOffset + u8.byteLength,
        );
    }

    async populateLegacyModsUl(ul, modFilenames, zipBuffer) {
        if (!ul || !Array.isArray(modFilenames)) return;
        let zip = null;
        if (zipBuffer && zipBuffer.byteLength > 0) {
            try {
                zip = await JSZip.loadAsync(zipBuffer);
            } catch (err) {
                console.warn(
                    "Could not open legacy archive for mod downloads:",
                    err,
                );
            }
        }
        for (const name of modFilenames) {
            const li = document.createElement("li");
            const label =
                name != null && String(name).trim() !== ""
                    ? String(name)
                    : "(unnamed)";
            if (zip) {
                const zpath = this.findZipPathForModFile(zip, label);
                if (zpath) {
                    const pathHeld = zpath;
                    const a = document.createElement("a");
                    a.href = "#";
                    a.textContent = label;
                    const zipRef = zip;
                    a.addEventListener("click", async (e) => {
                        e.preventDefault();
                        try {
                            const entry = zipRef.file(pathHeld);
                            if (!entry || entry.dir) return;
                            const blob = await entry.async("blob");
                            this.downloadBlobFile(blob, label);
                        } catch (err) {
                            console.error("Legacy mod download failed:", err);
                        }
                    });
                    li.appendChild(a);
                    ul.appendChild(li);
                    continue;
                }
            }
            li.textContent = label;
            ul.appendChild(li);
        }
    }

    async loadAndLogModpackSource(flavor) {
        const sourceType = flavor.sourceType;
        const source = flavor.source;

        switch (sourceType) {
            case "included": {
                this.clearCompatProgress();
                const root = this.compatProgressHost();
                let bar = null;
                if (root && typeof ProgressLoader !== "undefined") {
                    const loader = new ProgressLoader(root);
                    bar = loader.createProgressBar(
                        "Reading listing...",
                        true,
                        0,
                        100,
                    );
                    bar.update(35);
                }
                const listing =
                    typeof source === "string" ? JSON.parse(source) : source;
                if (bar) bar.update(90);
                if (bar) {
                    bar.complete();
                    bar.cleanUp();
                }
                return { mode: "v2", listing };
            }
            case "mlisting": {
                const url = String(source).trim();
                if (!url) throw new Error("mlisting source URL is empty");
                const buf = await this.compatFetchArrayBuffer(
                    url,
                    "Fetching mlisting...",
                );
                const listing = await this.compatLoadZipAndRun(buf, (z) =>
                    this.parseMlistingFromZip(z),
                );
                return { mode: "v2", listing, mlistingZipBuffer: buf };
            }
            case "urlListing": {
                const urlListing = String(source).trim();
                if (!urlListing) {
                    throw new Error("urlListing source URL is empty");
                }
                const buf = await this.compatFetchArrayBuffer(
                    urlListing,
                    "Fetching listing...",
                );
                const listing = await this.logListingFromFetchedBuffer(buf);
                return { mode: "v2", listing };
            }
            case "legacy": {
                const url =
                    source && source.url != null
                        ? String(source.url).trim()
                        : "";
                if (!url) throw new Error("legacy source.url is empty");
                const buf = await this.compatFetchArrayBuffer(
                    url,
                    "Fetching legacy archive...",
                );
                const files = await this.logLegacyArchiveZip(buf);
                return {
                    mode: "legacy",
                    files,
                    legacyZipBuffer: buf,
                };
            }
            case "legacyB64": {
                this.clearCompatProgress();
                const root = this.compatProgressHost();
                let b64Bar = null;
                if (root && typeof ProgressLoader !== "undefined") {
                    const loader = new ProgressLoader(root);
                    b64Bar = loader.createProgressBar(
                        "Loading legacy base64 archive...",
                        true,
                        0,
                        100,
                    );
                    b64Bar.update(28);
                }
                const b64 =
                    source && source.base64 != null
                        ? String(source.base64)
                        : "";
                if (!b64) throw new Error("legacyB64 base64 is empty");
                const bytes = this.base64ToUint8Array(b64);
                if (b64Bar) {
                    b64Bar.update(95);
                    b64Bar.complete();
                    b64Bar.cleanUp();
                }
                const files = await this.logLegacyArchiveZip(bytes);
                return {
                    mode: "legacy",
                    files,
                    legacyZipBuffer: this.uint8ViewToArrayBuffer(bytes),
                };
            }
            default:
                console.warn("Unknown sourceType:", sourceType);
                this.clearCompatProgress();
                {
                    const root = this.compatProgressHost();
                    if (root && typeof ProgressLoader !== "undefined") {
                        const loader = new ProgressLoader(root);
                        const bar = loader.createProgressBar(
                            "Unknown source type.",
                            true,
                            0,
                            100,
                        );
                        bar.complete();
                        bar.cleanUp();
                    }
                }
                return { mode: "unknown" };
        }
    }
}
