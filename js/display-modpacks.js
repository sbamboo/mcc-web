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
    const safeString = inputString.replace(regex, '_');
    return safeString;
}

// Function to make an id safe
function makeIdSafe(str) {
    // Replace invalid characters with underscores
    var safeStr = str.replace(/[^\w:.-]/g, '_');
    // Ensure the string starts with a letter
    if (!/^[A-Za-z]/.test(safeStr)) {
        safeStr = 'id_' + safeStr; // Prefix with 'id_' if it doesn't start with a letter
    }
    return safeStr;
}

// Function to create the modpack div elements
function createModpackDiv(name, desc, author, id, links, supported, icon, iconMapping) {
    const container = document.getElementById("modpack-link-container");
    const div = document.createElement("div");
    div.id = makeQueryStringSafe(name);
    if (supported != true) {
        desc = `<p>${desc}</p>` + '<p class="modpack-down-nosup-badge"> [NoSupport]<p>'
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
        // Fetch source and read listing for launchericon then resolve it, if fails fallback to def
    } else {
        div.innerHTML = `
            <div class="modpack-wrapper-outer">
                <div class="modpack-icon-wrapper">
                    <img class="modpack-icon" src="${icon}" alt="Modpack Icon">
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
                    <a class="button os-down-alt modpack-os-down-alt" href="${links.modpackLink}">Modpack/listing</a>
                    <a class="button modviewer" href="./modview.html?modpack=${urlSafename}"><div class="modview-button-wrapper"><img src="./images/modview/modviewer.png" alt="Modview icon"><p>Open in modviewer</div></a>
                    <a class="legacy-link" href="${links.buildSrcLink}">BuildSource (zip)</a>
                </div>
            </div>
        `;
        container.appendChild(div);
    }
}
  
// Main function to fetch data and create modpack divs
async function main() {
    const parentUrl = "https://raw.githubusercontent.com/sbamboo/MinecraftCustomClient/main/v2/Repo";
    const repoUrl = parentUrl+"/repo.json"
    const repoData = await fetchRepoData(repoUrl);
    const urlParams = new URLSearchParams(window.location.search);
    const showHidden_param = urlParams.get("showHidden");
    var showHidden = false;
    if (showHidden_param) {
        if (showHidden_param === true || showHidden_param.toLowerCase() === "true" || showHidden_param == 1) {
            	showHidden = true
        }
    }
  
    fetch("https://raw.githubusercontent.com/sbamboo/mcc-web/main/images/icons/icons_b64map.json")
        .then(response => response.json())
        .then(iconMapping => {
            repoData.forEach(({ name, source, desc, author, hidden, supported, icon, id }) => {
                if (hidden != true || showHidden == true) {
                    const links = generateLinks(name, source, parentUrl);
                    createModpackDiv(name, desc, author, id, links, supported, icon, iconMapping);
                }
            });
        });
}
  
// Call the main function to initiate the process
main();