//modpack-parsing.js

/**
 * Generates a random string of a specified length.
 * Used for Modrinth API User-Agent.
 * @param {number} length The desired length of the string.
 * @returns {string} A random alphanumeric string.
 */
function generateRandomString(length) {
    const charset =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        result += charset[randomIndex];
    }
    return result;
}

/**
 * Creates a safe ID string for HTML elements from a given string.
 * Replaces non-alphanumeric characters with underscores and ensures it starts with a letter.
 * @param {string} str The string to make safe.
 * @returns {string} The safe ID string.
 */
function makeIdSafe(str) {
    let safeStr = str.replace(/[^\w:.-]/g, "_");
    if (!/^[A-Za-z]/.test(safeStr)) {
        safeStr = "id_" + safeStr;
    }
    return safeStr;
}

/**
 * Represents a single parsed mod from a modpack.
 */
class ParsedMod {
    /**
     * @param {object} params - The parameters for the mod.
     * @param {string} params.filename - The name of the mod file.
     * @param {string} params.type - The type of mod source (e.g., 'modrinth', 'curseforge', 'custom', 'customB64', 'legacy').
     * @param {string} [params.downloadUrl] - The direct download URL for the mod.
     * @param {string} [params.projectPageUrl] - The URL to the mod's project page.
     * @param {string} [params.iconUrl] - The URL to the mod's icon.
     * @param {string} [params.sourceId] - The ID used for API lookups (e.g., Modrinth Project ID, CurseForge Mod ID).
     * @param {string} [params.modloader] - The modloader (e.g., 'fabric', 'forge').
     * @param {Blob} [params.blob] - A Blob object for customB64/legacy mods.
     * @param {boolean} [params.isDisabled=false] - Whether the mod is disabled (for legacy packs).
     */
    constructor({
        filename,
        type,
        downloadUrl,
        projectPageUrl,
        iconUrl,
        sourceId,
        modloader,
        blob,
        isDisabled = false,
    }) {
        this.filename = filename;
        this.type = type;
        this.downloadUrl = downloadUrl;
        this.projectPageUrl = projectPageUrl;
        this.iconUrl = iconUrl;
        this.sourceId = sourceId;
        this.modloader = modloader;
        this.blob = blob;
        this.isDisabled = isDisabled;
    }
}

/**
 * Represents a parsed modpack with its metadata and a list of mods.
 */
class ParsedModpack {
    /**
     * @param {object} metadata - Metadata about the modpack.
     * @param {string} metadata.name - Modpack name.
     * @param {string} metadata.author - Modpack author.
     * @param {string} metadata.minecraftVersion - Minecraft version.
     * @param {string} metadata.modloader - Modloader type.
     * @param {string} metadata.modloaderVersion - Modloader version.
     * @param {string} metadata.format - Listing format.
     * @param {string} metadata.archiveType - Archive type (for legacy).
     * @param {string} metadata.repoUrl - The URL of the repository JSON.
     * @param {string} metadata.repoUrlFormatted - The formatted URL of the repository JSON.
     * @param {ParsedMod[]} mods - An array of ParsedMod instances.
     * @param {Object.<string, Blob>} [otherFiles={}] - An object where keys are filenames and values are Blobs for other files.
     * @param {string} [listingJsonContent=null] - The raw content of listing.json if applicable.
     */
    constructor(metadata, mods, otherFiles = {}, listingJsonContent = null) {
        this.metadata = metadata;
        this.mods = mods;
        this.otherFiles = otherFiles;
        this.listingJsonContent = listingJsonContent;
    }

    /**
     * Gets the list of mods in the modpack.
     * @returns {ParsedMod[]} An array of ParsedMod instances.
     */
    getMods() {
        return this.mods;
    }

    /**
     * Gets the metadata of the modpack.
     * @returns {object} Metadata about the modpack.
     */
    getMetadata() {
        return this.metadata;
    }

    /**
     * Gets other files from the modpack (non-mod files).
     * The structure and content depend on the modpack format:
     * - 'mlisting' or 'urlListing': Returns an object where keys are filenames and values are Blobs.
     *   This includes the 'listing.json' file itself.
     * - 'legacy' or 'legacyB64': Returns an object where keys are filenames and values are Blobs
     *   for all files NOT in the 'mods/' directory.
     * - 'included': Returns an empty object as all relevant data is directly in the JSON.
     * @returns {Object.<string, Blob>} An object mapping filenames to Blob objects.
     */
    getFiles() {
        return this.otherFiles;
    }

    /**
     * Gets the raw content of the 'listing.json' file for 'mlisting'/'urlListing' modpacks.
     * @returns {string|null} The content of listing.json, or null if not applicable.
     */
    getListingJsonContent() {
        return this.listingJsonContent;
    }
}

/**
 * Parses modpack data from a given repository URL.
 */
class ModpackParser {
    /**
     * @param {string} repoUrl - The URL to the repository JSON (e.g., 'https://raw.githubusercontent.com/sbamboo/MinecraftCustomClient/main/v2/Repo/repo.json').
     */
    constructor(repoUrl) {
        this.repoUrl = repoUrl;
        this.repoData = null;
        this.modrinthApiRequestOptions = {
            headers: {
                "User-Agent": `minecraftcustomclient-website@${generateRandomString(
                    8,
                )}`,
            },
        };
        console.log(
            "Set modrinth-api-fetch user to:",
            this.modrinthApiRequestOptions.headers["User-Agent"],
        );
    }

    /**
     * Fetches and parses the main repository data.
     * @returns {Promise<object>} The parsed repository data.
     * @throws {Error} If fetching or parsing fails.
     */
    async fetchRepoData() {
        if (this.repoData) {
            return this.repoData;
        }
        const response = await fetch(this.repoUrl);
        if (!response.ok) {
            throw new Error(
                `Network response was not ok: ${response.statusText}`,
            );
        }
        this.repoData = await response.json();
        return this.repoData;
    }

    /**
     * Fetches data from a given URL.
     * @param {string} url - The URL to fetch.
     * @param {RequestInit} [options] - Fetch options.
     * @returns {Promise<Response>} The fetch Response object.
     * @throws {Error} If the network response is not ok.
     */
    async fetchData(url, options = {}) {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(
                `Network response was not ok: ${response.statusText} for ${url}`,
            );
        }
        return response;
    }

    /**
     * Parses a 'mlisting' or 'urlListing' modpack.
     * @param {object} dataOfModpack - The modpack data from the main repository.
     * @returns {Promise<ParsedModpack>} A ParsedModpack instance.
     */
    async parseMListing(dataOfModpack) {
        const zipBlobResponse = await this.fetchData(dataOfModpack.source);
        const zipBlob = await zipBlobResponse.blob();
        const zip = await JSZip.loadAsync(zipBlob);

        if (!zip.files["listing.json"]) {
            throw new Error("listing.json not found in the zip archive.");
        }

        const content = await zip.files["listing.json"].async("text");
        const jsonData = JSON.parse(content);

        const mods = [];
        const modProcessingPromises = [];
        const otherFiles = {};
        let listingJsonContent = null;

        // Collect other files and listing.json content
        for (const relativePath in zip.files) {
            const file = zip.files[relativePath];
            if (!file.dir) {
                if (relativePath === "listing.json") {
                    listingJsonContent = await file.async("text");
                    otherFiles[relativePath] = new Blob([listingJsonContent], {
                        type: "application/json",
                    });
                } else {
                    otherFiles[relativePath] = await file.async("blob");
                }
            }
        }

        jsonData.sources.forEach((mod) => {
            const modType = mod.type;
            const filename = mod.filename;
            let currentMod = null;

            if (modType === "modrinth") {
                const modrinthId = mod.url
                    .split("/versions/")[0]
                    .split("/")
                    .slice(-1)[0];
                const icon = mod.modrinthIcon
                    ? mod.modrinthIcon.startsWith("proj:")
                        ? "./images/modview/missing-mod-icon.png" // Fallback if proj: is not handled
                        : mod.modrinthIcon
                    : mod.url.split("/versions/")[0].concat("/icon.png");

                currentMod = new ParsedMod({
                    filename: filename,
                    type: "modrinth",
                    downloadUrl: mod.url,
                    projectPageUrl: `https://modrinth.com/mod/${modrinthId}`,
                    iconUrl: icon,
                    sourceId: modrinthId,
                    modloader: jsonData.modloader,
                });
                mods.push(currentMod);
            } else if (modType === "curseforgeManifest") {
                const curseforgeProjId = mod.curseforgeProjId;
                const promise = (async () => {
                    let iconUrl = "./images/modview/missing-mod-icon.png";
                    let projectPageUrl = `https://www.curseforge.com/minecraft/search?page=1&pageSize=20&sortBy=relevancy&class=mc-mods&search=${encodeURIComponent(
                        filename,
                    )}`; // Fallback search URL

                    if (curseforgeProjId) {
                        try {
                            const response = await this.fetchData(
                                `https://api.curse.tools/v1/cf/mods/${curseforgeProjId}`,
                            );
                            const data = await response.json();
                            if (data.data) {
                                iconUrl =
                                    data.data.logo?.thumbnailUrl || iconUrl;
                                projectPageUrl =
                                    data.data.links?.websiteUrl ||
                                    projectPageUrl;
                            }
                        } catch (error) {
                            console.warn(
                                `Failed to fetch CurseForge data for ID ${curseforgeProjId}:`,
                                error,
                            );
                            // Keep default icon and search URL on error
                        }
                    }

                    mods.push(
                        new ParsedMod({
                            filename: filename,
                            type: "curseforge",
                            downloadUrl: mod.url,
                            projectPageUrl: projectPageUrl,
                            iconUrl: iconUrl,
                            sourceId: curseforgeProjId,
                        }),
                    );
                })();
                modProcessingPromises.push(promise);
            } else if (modType === "custom" || modType === "customArchive") {
                const hostname = new URL(mod.url).hostname;
                currentMod = new ParsedMod({
                    filename: filename,
                    type: modType,
                    downloadUrl: mod.url,
                    projectPageUrl: mod.url, // For custom, the download is the project page essentially
                    iconUrl: "./images/modview/missing-mod-icon.png",
                    sourceId: hostname,
                });
                mods.push(currentMod);
            } else if (modType === "customB64" || modType === "customArchiveB64") {
                const uint8Array = Uint8Array.from(
                    atob(mod.base64),
                    (c) => c.charCodeAt(0),
                );
                const blob = new Blob([uint8Array], {
                    type: "application/octet-stream",
                });
                currentMod = new ParsedMod({
                    filename: filename,
                    type: modType,
                    downloadUrl: URL.createObjectURL(blob), // Create temporary URL for blob download
                    projectPageUrl: null, // No project page for direct blob
                    iconUrl: "./images/modview/missing-mod-icon.png",
                    sourceId: null,
                    blob: blob,
                });
                mods.push(currentMod);
            }
        });

        await Promise.allSettled(modProcessingPromises); // Wait for all async mod fetches

        const metadata = {
            name: jsonData.name,
            author: dataOfModpack.author,
            minecraftVersion: jsonData.minecraftVer,
            modloader: jsonData.modloader,
            modloaderVersion: jsonData.modloaderVer,
            format: jsonData.format,
            repoUrl: this.repoUrl,
            repoUrlFormatted: `https://sbamboo.github.io/websa/jsonview/?decorate-expanded=true&altsym=true$cut-links-at=480&return-url=history-back&url=${encodeURIComponent(
                this.repoUrl,
            )}`,
        };

        return new ParsedModpack(metadata, mods, otherFiles, listingJsonContent);
    }

    /**
     * Parses a 'legacy' or 'legacyB64' modpack.
     * @param {object} dataOfModpack - The modpack data from the main repository.
     * @returns {Promise<ParsedModpack>} A ParsedModpack instance.
     */
    async parseLegacy(dataOfModpack) {
        let zipBlob;
        if (dataOfModpack.sourceType === "legacy") {
            const response = await this.fetchData(dataOfModpack.source.url);
            zipBlob = await response.blob();
        } else {
            // legacyB64
            const uint8Array = Uint8Array.from(
                atob(dataOfModpack.source.base64),
                (c) => c.charCodeAt(0),
            );
            zipBlob = new Blob([uint8Array], {
                type: "application/octet-stream",
            });
        }

        const zip = await JSZip.loadAsync(zipBlob);
        const mods = [];
        const modProcessingPromises = [];
        const otherFiles = {};

        zip.forEach((relativePath, file) => {
            if (!file.dir) {
                if (relativePath.startsWith("mods/")) {
                    const filename = relativePath.split("/").slice(-1)[0];
                    const isDisabled = filename.endsWith(".dis");

                    const promise = (async () => {
                        const uint8array = await file.async("uint8array");
                        const blob = new Blob([uint8array], {
                            type: "application/octet-stream",
                        });

                        mods.push(
                            new ParsedMod({
                                filename: filename,
                                type: "legacy",
                                downloadUrl: URL.createObjectURL(blob),
                                projectPageUrl: null,
                                iconUrl: "./images/modview/legacy.png",
                                sourceId: null,
                                blob: blob,
                                isDisabled: isDisabled,
                            }),
                        );
                    })();
                    modProcessingPromises.push(promise);
                } else {
                    // Include all files not in the 'mods/' directory
                    const promise = (async () => {
                        otherFiles[relativePath] = await file.async("blob");
                    })();
                    modProcessingPromises.push(promise);
                }
            }
        });

        await Promise.allSettled(modProcessingPromises);

        const metadata = {
            name: dataOfModpack.name,
            author: dataOfModpack.author,
            minecraftVersion: dataOfModpack.source.minecraftVer,
            modloader: dataOfModpack.source.modLoader,
            modloaderVersion: dataOfModpack.source.modLoaderVer,
            format: "None, Legacy",
            archiveType: dataOfModpack.source.archiveType,
            repoUrl: this.repoUrl,
            repoUrlFormatted: `https://sbamboo.github.io/websa/jsonview/?decorate-expanded=true&altsym=true$cut-links-at=480&return-url=history-back&url=${encodeURIComponent(
                this.repoUrl,
            )}`,
        };

        return new ParsedModpack(metadata, mods, otherFiles);
    }

    /**
     * Parses an 'included' modpack.
     * @param {object} dataOfModpack - The modpack data from the main repository.
     * @returns {Promise<ParsedModpack>} A ParsedModpack instance.
     */
    async parseIncluded(dataOfModpack) {
        const jsonData = dataOfModpack.source;
        const mods = [];
        const modProcessingPromises = [];
        const otherFiles = {}; // For 'included', this will be empty as all relevant data is in JSON

        jsonData.sources.forEach((mod) => {
            const modType = mod.type;
            const filename = mod.filename;
            let currentMod = null;

            if (modType === "modrinth") {
                const modrinthId = mod.url
                    .split("/versions/")[0]
                    .split("/")
                    .slice(-1)[0];
                const icon = mod.modrinthIcon
                    ? mod.modrinthIcon.startsWith("proj:")
                        ? "./images/modview/missing-mod-icon.png"
                        : mod.modrinthIcon
                    : mod.url.split("/versions/")[0].concat("/icon.png");

                currentMod = new ParsedMod({
                    filename: filename,
                    type: "modrinth",
                    downloadUrl: mod.url,
                    projectPageUrl: `https://modrinth.com/mod/${modrinthId}`,
                    iconUrl: icon,
                    sourceId: modrinthId,
                    modloader: jsonData.modloader,
                });
                mods.push(currentMod);
            } else if (modType === "curseforgeManifest") {
                const curseforgeProjId = mod.curseforgeProjId;
                const promise = (async () => {
                    let iconUrl = "./images/modview/missing-mod-icon.png";
                    let projectPageUrl = `https://www.curseforge.com/minecraft/search?page=1&pageSize=20&sortBy=relevancy&class=mc-mods&search=${encodeURIComponent(
                        filename,
                    )}`;

                    if (curseforgeProjId) {
                        try {
                            const response = await this.fetchData(
                                `https://api.curse.tools/v1/cf/mods/${curseforgeProjId}`,
                            );
                            const data = await response.json();
                            if (data.data) {
                                iconUrl =
                                    data.data.logo?.thumbnailUrl || iconUrl;
                                projectPageUrl =
                                    data.data.links?.websiteUrl ||
                                    projectPageUrl;
                            }
                        } catch (error) {
                            console.warn(
                                `Failed to fetch CurseForge data for ID ${curseforgeProjId}:`,
                                error,
                            );
                        }
                    }

                    mods.push(
                        new ParsedMod({
                            filename: filename,
                            type: "curseforge",
                            downloadUrl: mod.url,
                            projectPageUrl: projectPageUrl,
                            iconUrl: iconUrl,
                            sourceId: curseforgeProjId,
                        }),
                    );
                })();
                modProcessingPromises.push(promise);
            } else if (modType === "custom" || modType === "customArchive") {
                const hostname = new URL(mod.url).hostname;
                currentMod = new ParsedMod({
                    filename: filename,
                    type: modType,
                    downloadUrl: mod.url,
                    projectPageUrl: mod.url,
                    iconUrl: "./images/modview/missing-mod-icon.png",
                    sourceId: hostname,
                });
                mods.push(currentMod);
            } else if (modType === "customB64" || modType === "customArchiveB64") {
                const uint8Array = Uint8Array.from(
                    atob(mod.base64),
                    (c) => c.charCodeAt(0),
                );
                const blob = new Blob([uint8Array], {
                    type: "application/octet-stream",
                });
                currentMod = new ParsedMod({
                    filename: filename,
                    type: modType,
                    downloadUrl: URL.createObjectURL(blob),
                    projectPageUrl: null,
                    iconUrl: "./images/modview/missing-mod-icon.png",
                    sourceId: null,
                    blob: blob,
                });
                mods.push(currentMod);
            }
        });

        await Promise.allSettled(modProcessingPromises);

        const metadata = {
            name: jsonData.name,
            author: dataOfModpack.author,
            minecraftVersion: jsonData.minecraftVer,
            modloader: jsonData.modloader,
            modloaderVersion: jsonData.modloaderVer,
            format: jsonData.format,
            repoUrl: this.repoUrl,
            repoUrlFormatted: `https://sbamboo.github.io/websa/jsonview/?decorate-expanded=true&altsym=true$cut-links-at=480&return-url=history-back&url=${encodeURIComponent(
                this.repoUrl,
            )}`,
        };

        return new ParsedModpack(metadata, mods, otherFiles);
    }

    /**
     * Fetches and parses a specific modpack by its ID.
     * @param {string} modpackId - The name/ID of the modpack to fetch.
     * @returns {Promise<ParsedModpack|null>} A ParsedModpack instance if found, otherwise null.
     * @throws {Error} If fetching repo data fails or an unsupported modpack type is encountered.
     */
    async fetchAndParseModpack(modpackId) {
        await this.fetchRepoData(); // Ensure repo data is loaded

        const flavors = this.repoData.flavors;
        const dataOfModpack = flavors.find(
            (flavor) => flavor.name === modpackId,
        );

        if (!dataOfModpack) {
            return null; // Modpack not found
        }

        switch (dataOfModpack.sourceType) {
            case "mlisting":
            case "urlListing":
                return await this.parseMListing(dataOfModpack);
            case "legacy":
            case "legacyB64":
                return await this.parseLegacy(dataOfModpack);
            case "included":
                return await this.parseIncluded(dataOfModpack);
            default:
                throw new Error(
                    `Unsupported modpack source type: ${dataOfModpack.sourceType}`,
                );
        }
    }
}

// Export the classes for use in other scripts
window.ModpackParser = ModpackParser;
window.ParsedMod = ParsedMod;
window.ParsedModpack = ParsedModpack;
window.makeIdSafe = makeIdSafe; // Export utility for modview.html to use