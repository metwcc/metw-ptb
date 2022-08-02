const backEndUrl = 'https://api.metw.cc/ptb/', cdnUrl = 'https://cdn.metw.cc/', url = window.location.origin + '/'
var iframe = document.getElementById('main')
var pageData = {}, pathname, search
var token, isLogged = false, loggedUserData = {}
var loggedUser = new Proxy(loggedUserData, { set: function (target, key, value) { target[key] = value; localStorage.loggedUser = JSON.stringify(loggedUserData); return true } })


//#region GENERAL PURPOSE FUNCTIONS
const by = {
    id: id => document.getElementById(id),
    class: className => document.getElementsByClassName(className),
    selector: selector => document.querySelector(selector),
    selectorAll: selectorAll => document.querySelectorAll(selectorAll)
}
const clearListeners = selector => {
    let oldElement = by.selector(selector), newElement = oldElement.cloneNode(true)
    oldElement.parentNode.replaceChild(newElement, oldElement)
    oldElement.remove(); return newElement
}
const loader = state => by.id('loader').style.display = ['none', 'flex'][+state] 
const customInput = ({ srcElement }, length, regex) => { if (srcElement && srcElement.value) srcElement.value = srcElement.value.replace(regex ? regex : '', '').substring(0, length) }
const fetchJSON = (input, ...init) => {
    var ok, conf = { showLoader: !!init.find(v => typeof v === 'boolean'), fetchInit: init.find(v => typeof v != 'boolean') }; if (conf.showLoader) loader(true);
    if (conf.fetchInit && conf.fetchInit.method && conf.fetchInit.method.toLowerCase() == 'post' && conf.fetchInit.body && Object.getPrototypeOf(conf.fetchInit.body).toString() != '[object FormData]' )
        conf.fetchInit.headers = conf.fetchInit.headers ? { 'Content-Type': 'application/json', ...conf.fetchInit.headers } : { 'Content-Type': 'application/json' },
            conf.fetchInit.body = JSON.stringify(conf.fetchInit.body)
    return fetch(input, conf.fetchInit).then(response => { if (conf.showLoader) loader(false); ok = response.ok; return response.json() })
        .then(json => [json, ok]).catch(error => { if (conf.showLoader) window.location.reload() })
}
const fileToBase64 = async file => new Promise((resolve) => {
    let reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(file)
})
const filedialog = async (allowedMimes, toBase64) => {
    var filedialog = document.createElement('input'); filedialog.type = 'file'
    return await new Promise(async (resolve) => {
        filedialog.accept = typeof allowedMimes == 'string' ? allowedMimes : allowedMimes.join(',')
        filedialog.oninput = async (e) => toBase64 ? resolve(await fileToBase64(filedialog.files[0])) : resolve(filedialog.files[0])
        filedialog.click()
    })
}
const upload = async (data, name, type) => {
    return await new Promise(async (resolve, reject) => {
        var [json, ok] = await fetchJSON(backEndUrl + `upload?${type ? 'type=' + type : 'type=attachment'}&${name ? 'name=' + name : ''}`, { headers: { auth: token } }, true)
        if (ok) {
            if (typeof data == 'string') var body = { base64: data }
            else { var body = new FormData(); body.append("file", data) }
            var [json2, ok2] = await fetchJSON(backEndUrl + `upload?key=${Object.keys(json)[0]}&type=${typeof data == 'string' ? 'base64' : 'form'}`, { method: 'post', body: body, headers: { auth: token } }, true)
            if (ok) resolve([json2, ok2])
            else resolve([json2, ok2])
        } else resolve([json, ok])
    })
}
const avatarUrl = (id, avatar) => cdnUrl + (avatar.length > 3 ? `usercontent/${id}/${avatar}` : `avatars/default${avatar}`)
const getFlag = (num, flag) => ((num >> ['staff', 'mod', 'partner', 'bugHunter', 'premium'].indexOf(flag)) % 2 != 0)
alert.error = error => alert(typeof error == 'object' ? error[0] : error) //reserved for future usage
alert.success = text => alert(text) //reserved for future usage
//#endregion


//#region CAPTCHA
var captchaKey, captchaCallback
function captcha(callback, state = 0) {
    switch (state) {
        case 0:
            fetchJSON(backEndUrl + 'captcha', true).then(([json, ok]) => {
                if (ok) {
                    by.id('captcha').style.display = 'flex', by.id('captcha-image').src = json[0], captchaKey = json[1], captchaCallback = callback ? callback : captchaCallback
                    const captchaKey_ = captchaKey; setTimeout(() => { if (captchaKey_ == captchaKey) { alert.error('Captcha kullanım süresi doldu!'); captcha(0) }}, 50000)
                } else alert.error(json)
            }); break
        case 1:
            if (by.id('captcha-input').value.length != 4) return alert.error('Captcha geçersiz')
            fetchJSON(backEndUrl + `captcha/validate?key=${captchaKey}&value=${by.id('captcha-input').value}`, true).then(([json, ok]) => { if (ok) { captchaKey = json, by.id('captcha').style.display = 'none'; captchaCallback() } else alert.error(json) }); break
        case 2: by.id('captcha').style.display = 'none', captchaKey = false; by.id('captcha-input').value = ''; break
    }
}
//#endregion


//#region PAGE
function formatUri() {
    let [pathname, ...search_] = ((window.location.pathname == '/' && window.location.search.startsWith('?/')) ? decodeURI(window.location.search).substring(1) : `${decodeURI(window.location.pathname)}&${decodeURI(window.location.search.substring(1))}`).split('&'), search = { 'args': [], 'kwargs': {} }
    pathname = pathname.split('/').filter(function (e) { return e != ''; }); for (let x = 0; x < search_.length; x++) { let a = search_[x].split('='); if (a.length == 1) { search.args.push(a[0]) } else { search.kwargs[a[0]] = a[1] } }; delete search_
    if (window.location.search.startsWith('?/')) window.history.pushState(null, '', window.location.search.substring(2).replace('&', '?')); return [pathname, search]
}
function renderPage(name) {
    if (Object.keys(pageData).includes(name)) {
        scripts = '', cleaned = pageData[name].replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (...args) => { scripts += args[1] + '\n'; return '' });
        iframe.innerHTML = pageData[name]; let scriptElement = document.createElement('script'); scriptElement.innerHTML = scripts; iframe.appendChild(scriptElement)
    } else { loader(true); fetch(`/pages/${name}.html`).then(function (response) { response.text().then(function (text) { pageData[name] = text; loader(false); renderPage(name) }) }); }
}
const redirect = (path, title) => { window.history.pushState(null, title, path); document.title = (title ? (title == '404' ? 'Sayfa Bulunamadı' : title) + ' • metw.cc' : 'metw.cc'); loadPage() }
async function loadPage() {
    [pathname, search] = formatUri()
    if (pathname.length == 0) { renderPage('homepage'); return }
    switch (pathname[0]) {
        case 'giriş': renderPage('login'); return
        case 'kaydol': renderPage('signup'); return
        case 'ev': session(window.location.href.endsWith('?')); renderPage('home'); return
        case 'upload': session(); renderPage('upload'); return
    }
    if (pathname[0].startsWith('@')) { session(); renderPage('profile'); return }
    renderPage('404')
}
//#endregion

//#region PROFILE
function profile(username) { redirect(`@${username}`, username) }
//#endregion 

//#region SESSION
function logged(state) {
    for (element of by.class('logged')) element.style.display = ['none', ''][+state]
    for (element of by.class('non-logged')) element.style.display = ['', 'none'][+state]
    localStorage.setItem('logged', state)
    if (state) {
        token = localStorage.getItem('token')
        if (localStorage.loggedUser) Object.assign(loggedUser, JSON.parse(localStorage.loggedUser))
        if (loggedUser) {
            if (loggedUser.username) by.id('logged-user-username').innerText = loggedUser.username
            if (loggedUser.avatarUrl) by.id('logged-user-profile-photo').src = loggedUser.avatarUrl
        }
    }
    else localStorage.removeItem('token')
}
function logout() { logged(false); redirect('/') }
function session(detailed) {
    token = localStorage.getItem('token'); if (!token) return
    return new Promise(async resolve => {
        var [json, ok] = await fetchJSON(backEndUrl + 'session', { headers: { auth: token } })
        if (ok) {
            Object.assign(loggedUser, json); logged(true)
            resolve(detailed ?
                (async () => {
                    var [details, ok2] = await fetchJSON(backEndUrl + `users/:${json.id}`)
                    Object.assign(loggedUser, details); loggedUser.avatarUrl = avatarUrl(details.id, details.avatar)
                    logged(true); return details
                })() : json)
        }
        else logged(false)
    })
}
//#endregion


logged(localStorage.getItem('logged') == 'true')
window.onpopstate = loadPage; session(true); loadPage(); loader(false)
if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/serviceWorker.js') }) }