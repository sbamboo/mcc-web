// Function to fetch the JSON data from the given URL
async function fetchRepoData() {
    try {
      const response = await fetch("https://raw.githubusercontent.com/sbamboo/MinecraftCustomClient/main/v2/Repo/repo.json");
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

// Function to create the modpack div elements
function createModpackDiv(name, desc, author, id, links) {
    const container = document.getElementById("modpack-link-container");
    const div = document.createElement("div");
    div.id = makeQueryStringSafe(name);
    div.className = "modpack-down";
    div.innerHTML = `
      <b>${name}</b>
      <p>${desc}</p>
      <div class="modpack-info sideflex">
          <p class="modpack-author">By: ${author}</p>
          <p class="modpack-id inline">[MdpkId:${id}]</p>
      </div>
      <a class="button os-down" href="${links.qiWinX86Link}">Installer - Windows (exe)</a>
      <a class="button os-down" href="${links.bundleLink}">Installer - Others (zip)</a>
      <a class="button os-down-alt" href="${links.modpackLink}">Modpack/listing</a>
      <a class="legacy-link" href="${links.buildSrcLink}">BuildSource (zip)</a>
    `;
    container.appendChild(div);
}
  
// Main function to fetch data and create modpack divs
async function main() {
    const repoData = await fetchRepoData();
    const parentUrl = "https://raw.githubusercontent.com/sbamboo/MinecraftCustomClient/main/v2/Repo";
  
    repoData.forEach(({ name, source, desc, author, hidden, id }) => {
      if (hidden != true) {
        const links = generateLinks(name, source, parentUrl);
        createModpackDiv(name, desc, author, id, links);
      }
    });
}
  
// Call the main function to initiate the process
main();