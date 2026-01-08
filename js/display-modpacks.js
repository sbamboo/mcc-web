// Utility function to trigger file download
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Function to fetch the JSON data from the given URL
async function fetchRepoData(repoUrl) {
    try {
        const response = await fetch(repoUrl);
        const data = await response.json();
        return data.flavors;
    } catch (error) {
        console.error("Error fetching data:", error);
        return [];
    }
}

// Function to generate the links
function generateLinks(name, source, parentUrl) {
    const bundleLink = `${parentUrl}/Packages/${name}/bundle.zip`;
    const buildSrcLink = `${parentUrl}/Packages/${name}/build_source.zip`;
    const qiWinX86Link = `${parentUrl}/Packages/${name}/build-win_x86/QuickInstaller.exe`;
    const modpackLink = source;

    return { bundleLink, buildSrcLink, qiWinX86Link, modpackLink };
}

function makeQueryStringSafe(inputString) {
    // Define a regular expression pattern that matches non-query-valid characters
    const regex = /[^a-zA-Z0-9\-_]/g;
    // Replace non-query-valid characters with underscores
    const safeString = inputString.replace(regex, "_");
    return safeString;
}

function compareMcVer(version1, version2, textPlacement = "last") {
    const parseVersion = (version) => {
        // Extract text placeholder and base version
        const textMatch = version.match(/^(.*?)([a-zA-Z_]+)?$/);
        const baseVersion = textMatch[1];
        const textPlaceholder = textMatch[2] || "";

        // Extract snapshot information
        const snapshotMatch = baseVersion.match(/(\d{2}w\d{2}[a-z]?)(_text)?$/);
        const snapshot = snapshotMatch ? snapshotMatch[0] : "";
        const baseVersionWithoutSnapshot = baseVersion.replace(snapshot, "");

        // Split base version into parts and parse as integers
        const baseParts = baseVersionWithoutSnapshot
            .split(/[\.\-_]/)
            .map((part) => (isNaN(part) ? 0 : parseInt(part, 10)));

        // Fill in any missing parts with zeroes
        while (baseParts.length < 5) {
            baseParts.push(0);
        }

        return { baseParts, snapshot, textPlaceholder };
    };

    const {
        baseParts: baseParts1,
        snapshot: snapshot1,
        textPlaceholder: text1,
    } = parseVersion(version1);
    const {
        baseParts: baseParts2,
        snapshot: snapshot2,
        textPlaceholder: text2,
    } = parseVersion(version2);

    const compareBaseVersions = () => {
        for (let i = 0; i < baseParts1.length; i++) {
            if (baseParts1[i] > baseParts2[i]) return 1;
            if (baseParts1[i] < baseParts2[i]) return -1;
        }
        return 0;
    };

    const compareSnapshots = () => {
        if (snapshot1 && !snapshot2) return 1; // Snapshot1 is newer
        if (!snapshot1 && snapshot2) return -1; // Snapshot2 is newer
        if (snapshot1 && snapshot2) {
            return snapshot1.localeCompare(snapshot2); // Compare snapshots
        }
        return 0;
    };

    const compareTextPlaceholders = () => {
        if (textPlacement === "last") {
            // For 'last', versions with text placeholders should come after
            if (text1 && !text2) return 1;
            if (!text1 && text2) return -1;
            if (text1 && text2) return text1.localeCompare(text2);
        } else {
            // textPlacement === 'first'
            // For 'first', versions with text placeholders should come before
            if (text1 && !text2) return -1;
            if (!text1 && text2) return 1;
            if (text1 && text2) return text1.localeCompare(text2);
        }
        return 0;
    };

    // First, compare base versions
    const baseComparison = compareBaseVersions();
    if (baseComparison !== 0) {
        return baseComparison;
    }

    // Ensure snapshots come after main versions
    if (snapshot1 && !snapshot2) return 1;
    if (!snapshot1 && snapshot2) return -1;

    // Compare snapshots if both versions have them
    if (snapshot1 && snapshot2) {
        const snapshotComparison = compareSnapshots();
        if (snapshotComparison !== 0) return snapshotComparison;
    }

    // Finally, compare text placeholders
    return compareTextPlaceholders();
}

// Function to create the modpack div elements
function createModpackDiv(
    name,
    desc,
    author,
    id,
    links,
    supported,
    icon,
    iconMapping,
    container,
    frontend_icon_rendering = null,
    use_v1_presentation = false,
) {
    const div = document.createElement("div");
    div.id = makeQueryStringSafe(name);
    if (supported != true) {
        desc = `<p>${desc}</p>` + '<p class="modpack-down-nosup-badge"> [NoSupport]<p>';
    }
    div.className = "modpack-down";
    urlSafename = encodeURIComponent(name);
    if (icon == null || icon == "" || icon == undefined) {
        icon = "./images/modpack_default.png";
    }
    for (var key in iconMapping) {
        if (iconMapping.hasOwnProperty(key)) {
            if (icon == key) {
                icon = iconMapping[key];
            }
        }
    }
    if (icon == "lis:launcherico") {
        //MARK: Fetch source and read listing for launchericon then resolve it, if fails fallback to def
    }
    modpack_icon_options = "";
    if (frontend_icon_rendering == "pixelated") {
        modpack_icon_options = ` style="image-rendering: pixelated;"`;
    }

    // V2 Presentation
    if (!use_v1_presentation) {
        div.innerHTML = `
            <div class="modpack-wrapper-outer">
                <div class="modpack-icon-wrapper">
                    <img class="modpack-icon" src="${icon}" alt="Modpack Icon"${modpack_icon_options}>
                </div>
                <div class="modpack-wrapper">
                    <b>${name}</b>
                    <div class="oneline-wrapper">${desc}</div>
                    <div class="modpack-info sideflex">
                        <p class="modpack-author">By: ${author}</p>
                        <p class="modpack-id inline">[MdpkId:${id}]</p>
                    </div>

                    <a class="button modviewer" href="./modview.html?modpack=${urlSafename}"><div class="icon-button-wrapper"><img src="./images/modview/modviewer.png" alt="Modview icon"><p>Open in modviewer</div></a>
                    <a class="button os-down-alt modpack-os-down-zipgen" data-modpack-id="${name}">Modpack (zip)</a>

                    <b class="collapsible collapsible-collapsed">Additional:</b>
                    <div class="collapsible-content vflex">
                        <div class="hflex">
                            <a class="button os-down modpack-os-down modpack-os-down-sb" href="${links.qiWinX86Link}">
                                <div class="icon-button-wrapper">
                                    <img src="./images/win_icon-icons.com.svg" alt="Windows (exe)">
                                    <p>Installer - Win</p>
                                </div>
                            </a>
                            <a class="button os-down modpack-os-down modpack-os-down-sb" href="${links.bundleLink}">
                                <div class="icon-button-wrapper">
                                    <img src="./images/zip_icon-icons.com.svg" alt="Any (zip)">
                                    <p>Installer - Any</p>
                                </div>
                            </a>
                        </div>
                        <div class="hflex">
                            <a class="legacy-link link-ul" href="${links.modpackLink}">Modpack/listing</a>
                            <a class="legacy-link" href="${links.buildSrcLink}">BuildSource (zip)</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        [...div.getElementsByClassName("collapsible")].forEach((elem) => {
            elem.addEventListener("click", function () {
                this.classList.toggle("collapsible-collapsed");
            });
        });
    
    } else {
        // V1 presentation
        div.innerHTML = `
            <div class="modpack-wrapper-outer">
                <div class="modpack-icon-wrapper">
                    <img class="modpack-icon" src="${icon}" alt="Modpack Icon"${modpack_icon_options}>
                </div>
                <div class="modpack-wrapper">
                    <b>${name}</b>
                    <div class="oneline-wrapper">${desc}</div>
                    <div class="modpack-info sideflex">
                        <p class="modpack-author">By: ${author}</p>
                        <p class="modpack-id inline">[MdpkId:${id}]</p>
                    </div>
                    <a class="button os-down modpack-os-down" href="${links.qiWinX86Link}">Installer - Windows (exe)</a>
                    <a class="button os-down modpack-os-down" href="${links.bundleLink}">Installer - Others (zip)</a>
                    <a class="button os-down-alt modpack-os-down-zipgen" data-modpack-id="${name}">Modpack (zip)</a>
                    <a class="button modviewer" href="./modview.html?modpack=${urlSafename}"><div class="icon-button-wrapper"><img src="./images/modview/modviewer.png" alt="Modview icon"><p>Open in modviewer</div></a>
                    <a class="legacy-link link-ul" href="${links.modpackLink}">Modpack/listing</a>
                    <a class="legacy-link" href="${links.buildSrcLink}">BuildSource (zip)</a>
                </div>
            </div>
        `;
    }
    container.appendChild(div);
    return div;
}

const zipgenPopup = document.getElementById("zipgen-popup");
const zipgenStatus = document.getElementById("zipgen-status");
const zipgenProgress = document.getElementById("zipgen-progress");
const zipgenCurrentFile = document.getElementById("zipgen-current-file");
const zipgenCloseButton = zipgenPopup.querySelector(".close-button");

zipgenCloseButton.addEventListener("click", () => {
    zipgenPopup.classList.remove("show");
    zipgenStatus.textContent = "Initializing...";
    zipgenProgress.value = 0;
    zipgenCurrentFile.textContent = "";
});

let modpackParser = null;
const parentUrl = "https://raw.githubusercontent.com/sbamboo/MinecraftCustomClient/main/v2/Repo";
const repoUrl = parentUrl + "/repo.json";

function splitModpackVariant(name) {
    // Order matters: more specific first
    const rules = [
        {
            type: "DOT",
            regex: /^(.*)\.(E|C)$/,
            normalize: (base) => base,
        },
        {
            type: "PR",
            regex: /^(.*)_(E|C)_PR$/,
            normalize: (base) => base,
        },
        {
            type: "SPACE",
            regex: /^(.*)\s(E|C)$/,
            normalize: (base) => base,
        },
    ];

    for (const rule of rules) {
        const match = name.match(rule.regex);
        if (match) {
            return {
                base: rule.normalize(match[1]),
                variant: match[2],      // "E" or "C"
                groupType: rule.type,   // DOT | PR | SPACE
            };
        }
    }

    return {
        base: name,
        variant: null,
        groupType: null,
    };
}

// Main function to fetch data and create modpack divs
async function main() {
    modpackParser = new ModpackParser(repoUrl);

    const baseContainer = document.getElementById("modpack-link-container");
    const repoData = await fetchRepoData(repoUrl);
    const urlParams = new URLSearchParams(window.location.search);

    const showHidden_param = urlParams.get("showHidden");
    var showHidden = false;
    if (showHidden_param) {
        if (
            showHidden_param === true ||
            showHidden_param.toLowerCase() === "true" ||
            showHidden_param == 1
        ) {
            showHidden = true;
        }
    }

    const mediaQuery = window.matchMedia("(max-width: 768px)");

    function applyOldViewIfNeeded(e) {
        const url = new URL(window.location.href);

        // Respect explicit user choice
        if (url.searchParams.has("oldView")) return;

        if (e.matches) {
            url.searchParams.set("oldView", "true");
            window.location.replace(url.toString());
        }
    }

    // Run once on load
    applyOldViewIfNeeded(mediaQuery);

    // Watch for changes (rotation, resize, foldables)
    mediaQuery.addEventListener("change", applyOldViewIfNeeded);

    const oldView_param = urlParams.get("oldView");
    var oldView = false;
    if (oldView_param) {
        if (
            oldView_param === true ||
            oldView_param.toLowerCase() === "true" ||
            oldView_param == 1
        ) {
            oldView = true;
        }
    }

    const group_param = urlParams.get("group");
    var groupPacks = false;
    var groupCollapseMode = "none";

    groupPacks = true; // ENABLE GROUP BY DEFAULT

    if (group_param) {
        if (
            group_param === true ||
            group_param.toLowerCase() === "true" ||
            group_param == 1
        ) {
            groupPacks = true;
        } else if (group_param === "collapsed" || group_param == 2) {
            groupPacks = true;
            groupCollapseMode = "all";
        } else if (group_param === "hidden" || group_param == 3) {
            groupPacks = true;
            groupCollapseMode = "hidden";
        } else {
            groupPacks = false;
        }
    }
    var groups_tree = {};

    fetch("https://raw.githubusercontent.com/sbamboo/mcc-web/main/images/icons/icons_b64map.json")
        .then((response) => response.json())
        .then((iconMapping) => {
            const hgroupRegistry = new WeakMap();
            repoData.forEach(
                ({
                    name,
                    source,
                    desc,
                    author,
                    hidden,
                    supported,
                    icon,
                    id,
                    group,
                    mcver,
                    frontend_icon_rendering,
                }) => {
                    container = baseContainer;
                    if (hidden != true || showHidden == true) {
                        const links = generateLinks(name, source, parentUrl);

                        if (groupPacks == true) {
                            if (group && group != "") {
                                if (groups_tree[group]) {
                                    container = groups_tree[group]["container"];
                                } else {
                                    const group_elem_root = document.createElement("div");
                                    group_elem_root.classList.add("category-flavour");
                                    const group_elem_root_title = document.createElement("h2");
                                    group_elem_root_title.classList.add("category-flavour-title");
                                    group_elem_root_title.classList.add("collapsible");
                                    group_elem_root_title.classList.add("collapsible-collapsed");
                                    group_elem_root_title.innerText = group;
                                    group_elem_root_title.addEventListener("click", function () {
                                        this.classList.toggle("collapsible-collapsed");
                                    });
                                    const group_elem_root_container = document.createElement("div");
                                    group_elem_root_container.classList.add("collapsible-content");
                                    group_elem_root.appendChild(group_elem_root_title);
                                    group_elem_root.appendChild(group_elem_root_container);
                                    groups_tree[group] = {
                                        container: group_elem_root_container,
                                        title: group_elem_root_title,
                                        branches: {},
                                    };
                                    container = group_elem_root_container;
                                    baseContainer.appendChild(group_elem_root);
                                }
                            } else {
                                group = "Ungrouped";
                            }
                            if (mcver && mcver != "") {
                                if (groups_tree[group]["branches"][mcver]) {
                                    container =
                                        groups_tree[group]["branches"][mcver]["container"];
                                    groups_tree[group]["branches"][mcver]["leaves"].push(name);
                                } else {
                                    const group_elem_branch = document.createElement("div");
                                    group_elem_branch.classList.add("category-versions");
                                    const group_elem_branch_title = document.createElement("h3");
                                    group_elem_branch_title.classList.add("category-versions-title");
                                    group_elem_branch_title.classList.add("collapsible");
                                    group_elem_branch_title.innerText = mcver;
                                    if (groupCollapseMode === "all") {
                                        group_elem_branch_title.classList.add("collapsible-collapsed");
                                    } else if (groupCollapseMode === "hidden" && hidden == true) {
                                        group_elem_branch_title.classList.add("collapsible-collapsed");
                                    } else {
                                        groups_tree[group]["title"].classList.remove(
                                            "collapsible-collapsed",
                                        );
                                    }
                                    group_elem_branch_title.addEventListener("click", function () {
                                        this.classList.toggle("collapsible-collapsed");
                                    });
                                    const group_elem_branch_container =
                                        document.createElement("div");
                                    group_elem_branch_container.classList.add("collapsible-content");
                                    group_elem_branch.appendChild(group_elem_branch_title);
                                    group_elem_branch.appendChild(group_elem_branch_container);
                                    groups_tree[group]["branches"][mcver] = {
                                        container: group_elem_branch_container,
                                        leaves: Array(),
                                    };
                                    container = group_elem_branch_container;
                                    //groups_tree[group]["container"].appendChild(group_elem_branch)
                                    lastChild = groups_tree[group]["container"].lastElementChild;
                                    if (lastChild) {
                                        lastVersion = lastChild.getElementsByClassName(
                                            "category-versions-title",
                                        )[0].innerText;
                                        compareNum = compareMcVer(lastVersion, mcver);
                                        if (compareNum == 1) {
                                            console.log(
                                                `Inserted ${mcver} after ${lastVersion}  (${group})`,
                                            );
                                            groups_tree[group]["container"].appendChild(
                                                group_elem_branch,
                                            );
                                        } else {
                                            console.log(
                                                `Inserted ${mcver} before ${lastVersion} (${group})`,
                                            );
                                            groups_tree[group]["container"].insertBefore(
                                                group_elem_branch,
                                                lastChild,
                                            );
                                        }
                                    } else {
                                        console.log(
                                            `Inserted ${mcver} as first child        (${group})`,
                                        );
                                        groups_tree[group]["container"].appendChild(
                                            group_elem_branch,
                                        );
                                    }
                                }
                            }
                        }

                        const { base, variant } = splitModpackVariant(name);

                        const outer = createModpackDiv(
                            name,
                            desc,
                            author,
                            id,
                            links,
                            supported,
                            icon,
                            iconMapping,
                            document.createElement("div"), // TEMP container
                            frontend_icon_rendering,
                            oldView
                        );
                        
                        if (!oldView) {
                            // --- H-GROUP LOGIC ---
                            if (!hgroupRegistry.has(container)) {
                                hgroupRegistry.set(container, new Map());
                            }
                            
                            const groupMap = hgroupRegistry.get(container);
                            
                            if (variant) {
                                let hgroup = groupMap.get(base);
                            
                                if (!hgroup) {
                                    hgroup = document.createElement("div");
                                    hgroup.classList.add("modpack-hgroup");
                                    groupMap.set(base, hgroup);
                                    container.appendChild(hgroup);
                                }
                            
                                hgroup.appendChild(outer);
                            } else {
                                // Non .E / .C modpacks behave normally
                                container.appendChild(outer);
                            }
                        } else {
                            container.appendChild(outer);
                        }
                    }
                },
            );

            // Add event listeners for the new "Modpack (zip)" buttons after they are created
            document.querySelectorAll(".modpack-os-down-zipgen").forEach((button) => {
                button.addEventListener("click", async (event) => {
                    const modpackId = event.target.dataset.modpackId;
                    if (modpackId) {
                        await generateModpackZip(modpackId);
                    }
                });
            });
        });
}

async function generateModpackZip(modpackId) {
    zipgenPopup.classList.add("show");
    zipgenStatus.textContent = `Starting zip generation for ${modpackId}...`;
    zipgenProgress.value = 0;
    zipgenCurrentFile.textContent = "";

    try {
        if (!modpackParser) {
            throw new Error("ModpackParser not initialized.");
        }

        const parsedModpack = await modpackParser.fetchAndParseModpack(modpackId);

        if (!parsedModpack) {
            throw new Error(`Modpack with ID '${modpackId}' not found.`);
        }

        const zip = new JSZip();
        const mods = parsedModpack.getMods();
        const otherFiles = parsedModpack.getFiles();
        const modpackName = parsedModpack.getMetadata().name;
        const totalFiles = mods.length + Object.keys(otherFiles).length;
        let processedFiles = 0;

        zipgenStatus.textContent = `Fetching ${totalFiles} files for '${modpackName}'...`;

        // Add mods to zip
        for (const mod of mods) {
            const modFilename = mod.filename;
            zipgenCurrentFile.textContent = `Fetching mod: ${modFilename}`;
            let blob;

            if (mod.blob) {
                // For customB64/legacy types, blob is already available
                blob = mod.blob;
            } else if (mod.downloadUrl) {
                try {
                    const response = await modpackParser.fetchData(mod.downloadUrl);
                    blob = await response.blob();
                } catch (error) {
                    console.warn(`Failed to fetch mod ${modFilename}:`, error);
                    zipgenCurrentFile.textContent = `Warning: Could not fetch ${modFilename}. Skipping.`;
                    processedFiles++;
                    zipgenProgress.value = (processedFiles / totalFiles) * 100;
                    continue; // Skip this mod but continue with others
                }
            } else {
                console.warn(`Mod ${modFilename} has no download URL or blob. Skipping.`);
                processedFiles++;
                zipgenProgress.value = (processedFiles / totalFiles) * 100;
                continue;
            }

            // Add to 'mods/' directory if it's a mod file
            const pathInZip = mod.isDisabled ? `mods/${modFilename}.dis` : `mods/${modFilename}`;
            zip.file(pathInZip, blob);
            processedFiles++;
            zipgenProgress.value = (processedFiles / totalFiles) * 100;
        }

        // Add other files to zip (e.g., config files, listing.json)
        for (const filename in otherFiles) {
            zipgenCurrentFile.textContent = `Adding file: ${filename}`;
            zip.file(filename, otherFiles[filename]);
            processedFiles++;
            zipgenProgress.value = (processedFiles / totalFiles) * 100;
        }

        zipgenStatus.textContent = `Compressing '${modpackName}.zip'...`;
        zipgenCurrentFile.textContent = "This may take a moment.";

        const zipBlob = await zip.generateAsync(
            {
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: {
                    level: 9
                }
            },
            function updateCallback(metadata) {
                zipgenStatus.textContent = `Compressing: ${metadata.percent.toFixed(2)}%`;
                zipgenProgress.value = metadata.percent;
                if (metadata.currentFile) {
                    zipgenCurrentFile.textContent = `Adding: ${metadata.currentFile}`;
                }
            }
        );

        zipgenStatus.textContent = `Download ready!`;
        zipgenCurrentFile.textContent = "";
        zipgenProgress.value = 100;

        downloadBlob(zipBlob, `${modpackName}.zip`);

        // Give a brief moment before closing to allow user to see "Download ready"
        setTimeout(() => {
            zipgenPopup.classList.remove("show");
        }, 3000);

    } catch (error) {
        console.error("Error generating modpack zip:", error);
        zipgenStatus.textContent = "Error during zip generation!";
        zipgenCurrentFile.textContent = error.message;
        zipgenProgress.value = 0; // Reset progress on error
        // Keep popup open on error for user to see message
    }
}

// Call the main function to initiate the process
main();