/**
 * @param {string} [modpack="*latest"]  → mccmp
 * @param {string} [mcver="*latest"]     → mcver
 * @param {boolean} [nonReleases=false]   → mccnonrel (presence)
 * @param {boolean} [autoRun=false]     → mccauto (presence)
 * @param {boolean} [showAll=false]     → mccshowall=true
 * @param {string|null} [homeurl=null]  → homeurl; default "https://sbamboo.github.io/mcc-web/"
 * @param {string|null} [backurl=null]  → backurl; default current page href
 * @param {boolean} [uiNoHidden ] → ui.mccnohidden=true
 * @param {boolean} [uiNoSnapshots] → ui.mccnosnap=true
 * @param {string} [pageUrl]  full URL of ismpupdated.html if not same-origin
 */
function getVerCheckUrl(
    modpack = "*latest",
    mcver = "*latest",
    nonReleases = false,
    autoRun = false,
    showAll = false,
    homeurl = null,
    backurl = null,
    uiNoHidden = true,
    uiNoSnapshots = false
) {
    const showHidden = new URLSearchParams(location.search).get("showHidden") === "true";
    if (showHidden) {
        uiNoHidden = false;
        showAll = true;
    }

    const pageUrl = new URL("./ismpupdated.html", window.location.href).href;

    const params = new URLSearchParams();

    if (modpack != null && String(modpack).trim() !== "") {
        params.set("mccmp", String(modpack).trim());
    }
    if (mcver != null && String(mcver).trim() !== "") {
        params.set("mcver", String(mcver).trim());
    }
    if (nonReleases) {
        params.set("mccnonrel", ""); // presence; empty value is fine with has("mccnonrel")
    }
    if (autoRun) {
        params.set("mccauto", "");
    }
    if (showAll) {
        params.set("mccshowall", "true");
    }

    const home =
        homeurl != null && String(homeurl).trim() !== ""
            ? String(homeurl).trim()
            : "https://sbamboo.github.io/mcc-web/";
    params.set("homeurl", home);

    const back =
        backurl != null && String(backurl).trim() !== ""
            ? String(backurl).trim()
            : window.location.href;
    params.set("backurl", back);

    if (uiNoHidden) {
        params.set("ui.mccnohidden", "true");
    }
    if (uiNoSnapshots) {
        params.set("ui.mccnosnap", "true");
    }

    return `${pageUrl.split("#")[0]}${params.toString() ? `?${params.toString()}` : ""}`;
}