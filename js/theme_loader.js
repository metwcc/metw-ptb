function loadTheme() {
    theme = window.localStorage.getItem("theme")
    if (["light", "dark"].includes(theme)) {
        let themeLinkElemet = document.createElement("link")
        themeLinkElemet.href = `/css/${theme}-theme.css`, themeLinkElemet.rel = "stylesheet", themeLinkElemet.type = "text/css"
        document.head.appendChild(themeLinkElemet)
    } else { window.localStorage.setItem("theme", "dark"); loadTheme() }
}; loadTheme()