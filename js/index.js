const url = { backend: 'https://api.metw.cc/ptb/', cdn: 'https://cdn.metw.cc/' }
const d = document, w = window
const pageData = {}
var pathname, search
var p, page
var session, token

const AsyncFunction = (async function () { }).constructor;
const mouse = {
    enabled: true,
    enable() { mouse.enabled = true; d.getElementById('disable-mouse').style.display = 'none' },
    disable() { mouse.enabled = false; d.getElementById('disable-mouse').style.display = 'block' }
}
const progressBar = (percentage) => {
    var bar = d.getElementById('progress-bar'); mouse.disable()
    if (percentage == 0) bar.style.transition = '0'; else bar.style.transition = '.05s'
    if (percentage == 100) { setTimeout(() => bar.style.height = '0', 300); setTimeout(() => { bar.style.width = 0; mouse.enable() }, 600) }
    else bar.style.height = '2px'
    bar.style.width = percentage + '%'
}
const withLoading = async (cb) => { loadingBar(true); var r = (await cb()); loadingBar(false); return r }
const loadingBar = (state) => {
    var bar = d.getElementById('loading-bar')
    bar.style.animation = null
    bar.offsetHeight
    bar.style.animation = 'loading-bar 1s ease-in-out infinite'
    bar.style.height = +state * 2 + 'px'
    bar.style.display = ['none', 'block'][+state]
    if (state) mouse.disable()
    else mouse.enable()
}
const filteredInput = ({ target }, pattern, length) => { target.value = (pattern != false ? target.value.match(pattern).join('') : target.value).substring(0, length - 1); return true }
const timeSince = (date) => {
    var seconds = Math.floor((new Date() - date) / 1000), response = '', c = 0
    var interval = seconds / 31536000; if (c < 2 && interval > 1) { response += Math.floor(interval) + ' yıl '; c++ }
    interval = seconds / 2592000; if (c < 2 && interval % 12 > 1) { response += Math.floor(interval % 12) + ' ay '; c++ }
    interval = seconds / 86400; if (c < 2 && interval % 30 > 1) { response += Math.floor(interval % 30) + ' gün '; c++ }
    interval = seconds / 3600; if (c < 2 && interval % 24 > 1) { response += Math.floor(interval % 24) + ' saat '; c++ }
    interval = seconds / 60; if (c < 2 && interval % 60 > 1) { response += Math.floor(interval % 60) + ' dakika '; c++ }
    return !response ? 'şimdi' : response + ' önce'
}
const filedialog = (mime) => {
    return new Promise(resolve => {
        var input = d.createElement('input'); input.type = 'file', input.accept = mime
        input.click(); input.oninput = () => resolve(input)
    })
}
const toBase64 = (file) => {
    return new Promise(resolve => {
        var reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve(reader.result)
    })
}


fetch.stream = async (url, progress, fetchInit) =>
    await fetch(url, fetchInit).then((res) => {
        var contentLenght = res.headers.get('content-length'), downloadLength = 0; progress(0)
        const reader = res.body.getReader()
        return new ReadableStream({
            start(controller) {
                return pump()
                function pump() {
                    return reader.read().then(({ done, value }) => {
                        if (done) { controller.close(); return }
                        controller.enqueue(value); downloadLength += value.length
                        progress(parseInt(downloadLength / contentLenght * 100))
                        return pump()
                    })
        } } }) }).then(stream => new Response(stream))
fetch.json = (input, fetchInit) => {
    var init = fetchInit, ok, raw
    if (init.body) init.headers = { 'Content-Type': 'application/json', ...(init.headers ? init.headers : {}) }, init.body = JSON.stringify(init.body)
    return fetch(input, init).then(res => { ok = res.ok; raw = res; return res.json() }).then(json => [json, ok, raw])
}
alert.error = (error) => alert(error)
alert.success = (success) => alert(success)


//#region PAGE 
const uri = {
    format() {
        let [pathname, ...search_] = ((window.location.pathname == '/' && window.location.search.startsWith('?/')) ? decodeURI(window.location.search).substring(1) : `${decodeURI(window.location.pathname)}&${decodeURI(window.location.search.substring(1))}`).split('&'), search = { 'args': [], 'kwargs': {} }
        pathname = pathname.split('/').filter(function (e) { return e != ''; }); for (let x = 0; x < search_.length; x++) { let a = search_[x].split('='); if (a.length == 1) { search.args.push(a[0]) } else { search.kwargs[a[0]] = a[1] } }; delete search_
        if (window.location.search.startsWith('?/')) window.history.pushState(null, '', window.location.search.substring(2).replace('&', '?')); return [pathname, search]
    },
    async render(name) {
        if (Object.keys(pageData).includes(name)) {
            mouse.disable()
            var scripts = [[], []]
            p = page = d.createElement('div'), page.className = 'page p mx-auto'
            pageData[name].replace(/<script([^>]*?)>([\s\S]*?)<\/script>/g, (raw, attributes, innerHTML) => { scripts[+!attributes.split(' ').includes('init')].push([attributes.split(' '), innerHTML]); return '' })
            await withLoading(async () => { for (script of scripts[0]) await new Promise(resolve => { eval(`(async resolve => { ${script[1]} })`)(resolve) }) })
            var style = [...pageData[name].matchAll(/<style[^>]*?>([\s\S]*?)<\/style>/g)][0]
            page.innerHTML = [...pageData[name].matchAll(/<body[^>]*?>([\s\S]*?)<\/body>/g)][0][1] + (style ? style[0] : '')
            for (let script of scripts[1])
                page.appendChild((() => {
                    let elem = d.createElement('script')
                    for (let attribute of script[0]) { elem[attribute.split('=')[0]] = attribute.split('=')[1] ? attribute.split('=')[1].replace(/["']*/g, '') : attribute.split('=')[0] }
                    elem.innerHTML = script[1]
                    return elem
                })())
            d.getElementById('page').parentNode.replaceChild(p, d.getElementById('page')); page.id = 'page'
            mouse.enable()
        } else { pageData[name] = await fetch.stream(`/pages/${name}`, progressBar).then(res => res.text()); this.render(name) }
    },
    async load() {
        [pathname, search] = this.format()
        if (pathname.length == 0) return await this.render('homepage.html')
        if (['giriş', 'katıl'].includes(pathname[0])) return await this.render('gateway.html')
        if (pathname[0] == 'keşfet') return await this.render('explore.html')
        if (pathname[0] == 'gönderi') return await this.render('post.html')
        if (pathname[0] == 'ayarlar') return await this.render('settings.html')
        if (pathname[0].startsWith('@'))
            switch (pathname[1]) {
                case 'duvar': return await this.render('wall.html')
                case undefined: return await this.render('profile.html')
            }
        return await this.render('404.html')
    }
}
const redirect = async (path, title) => { w.history.pushState(null, title ? title : 'metw.cc', path); await uri.load() }
//#endregion


//#region SESSION
const logout = () => {
    session = new Session(false)
    localStorage.removeItem('token')
    Array.from(d.getElementsByClassName('logged')).forEach(i => i.style.display = 'none')
    Array.from(d.getElementsByClassName('non-logged')).forEach(i => i.style.display = 'flex')
}
const login = () => {
    session = new Session(token)
    if (session.logged) {
        Array.from(d.getElementsByClassName('logged')).forEach(i => i.style.display = 'flex')
        Array.from(d.getElementsByClassName('non-logged')).forEach(i => i.style.display = 'none')
        d.getElementById('user-photo').src = session.user.profile.avatarURL
        d.getElementById('username').innerHTML = session.username + '&nbsp;'
    }
    else logout()
}
//#endregion


//#region USER
d.getElementById('compose').onclick = () => {
    d.getElementById('compose-popup').style.display = 'block'
    d.querySelector('#compose-popup textarea').value = ''
    d.querySelector('#compose-popup textarea').focus()
}
d.querySelector('#compose-popup .cancel').onclick = () => d.getElementById('compose-popup').style.display = 'none'
d.querySelector('#compose-popup .send').onclick = async () => {
    var content = d.querySelector('#compose-popup textarea').value
    if (!content || content.match(/\S+/g).join('').length < 4) return alert.error('Gönderi içeriği 4 karakterden kısa olamaz')
    if (await withLoading(async () => await session.post(content))) {
        d.getElementById('compose-popup').style.display = 'none'
        try { await p.posts.render(0) } catch { }
    }
    else alert.error('Çok hızlı gönderi gönderiyorsunuz! Birazdan tekrar deneyin.')
}
async function changeAvatar() {
    var avatar = await crop.start('1:1', '128x128')
    await withLoading(async () => await session.changeAvatar(avatar))
    d.getElementById('user-photo').src = session.user.profile.avatarURL
    return session.user.profile.avatarURL
}
async function changeBanner() {
    var banner = await crop.start('16:9', '640x360')
    await withLoading(async () => await session.changeBanner(banner))
    return session.user.profile.bannerURL
}
async function removeAvatar() {
    await withLoading(async () => session.settings([{ name: 'remove_avatar' }]))
    d.getElementById('user-photo').src = session.user.profile.avatarURL
    return session.user.profile.avatarURL
}
async function removeBanner() {
    await withLoading(async () => session.settings([{ name: 'remove_banner' }]))
    return session.user.profile.bannerURL
}
//#endregion


//#region IMAGE CROP
const crop = d.querySelector('#image-crop')
Object.assign(crop, {
    frame: crop.querySelector('.frame'), active: false,
    div: crop.querySelector('.main'), img: crop.querySelector('img'),
    zoom: crop.querySelector('input'),
    cancel: crop.querySelector('.cancel'), ok: crop.querySelector('.ok')
})
crop.start = async (ratio, resolution) => {
    return new Promise(async resolve => {
        [crop.rawRatio, crop.resolution] = [ratio.split(':'), resolution.split('x')].map(i => i.map(i => parseInt(i)))
        crop.landspace = crop.rawRatio[0] > crop.rawRatio[1]
        crop.ratio = crop.rawRatio[0] / crop.rawRatio[1]
        var image = await filedialog('image/*')
        if (image.files[0]) crop.img.src = await toBase64(image.files[0])
        crop.ok.onclick = () => {
            var canvas = d.createElement('canvas')
            canvas.width = crop.resolution[0], canvas.height = crop.resolution[1]
            var ctx = canvas.getContext('2d'), scales = [crop.img.naturalWidth / crop.img.offsetWidth, crop.img.naturalHeight / crop.img.offsetHeight]
            ctx.drawImage(crop.img, (crop.img.meta.sx < 0 ? 0 : crop.img.meta.sx + crop.frame.offsetWidth > crop.img.offsetWidth ? crop.img.offsetWidth - crop.frame.offsetWidth : crop.img.meta.sx) * scales[0], 
                (crop.img.meta.sy < 0 ? 0 : crop.img.meta.sy + crop.frame.offsetHeight > crop.img.offsetHeight ? crop.img.offsetHeight - crop.frame.offsetHeight : crop.img.meta.sy) * scales[1],
                crop.frame.offsetWidth * scales[0], crop.frame.offsetHeight * scales[1], 0, 0, ...crop.resolution)
            resolve(canvas.toDataURL('image/png'))
            crop.style.display = 'none'
        }
    })
}
crop.reflow = (reset) => {
    var _p = crop.div.offsetWidth / crop.div.offsetHeight < crop.ratio
    crop.frame.style.width = _p ? crop.div.offsetWidth * .9 + 'px' : null, crop.frame.style.height = _p ? null : crop.div.offsetHeight * .9 + 'px'
    if (reset == true) crop.img.meta = { x: 0, y: 0, landspace: crop.img.offsetWidth > crop.img.offsetHeight, sx: 0, sy: 0, ratio: crop.img.offsetWidth / crop.img.offsetHeight, fixScale: 1 }
    for (let i of ['width', 'height']) crop.img.removeAttribute(i)
    eval(`crop.img.${(crop.img.meta.landspace ? 'width' : 'height')} = (crop.landspace ? crop.frame.offsetWidth : crop.frame.offsetHeight) * crop.zoom.value / 100 * crop.img.meta.fixScale`)
    crop.img.meta.fixScale *= crop.img.offsetHeight < crop.frame.offsetHeight ? crop.frame.offsetHeight / crop.img.offsetHeight : crop.img.offsetWidth < crop.frame.offsetWidth ? crop.img.meta.fixScale *= crop.frame.offsetWidth / crop.img.offsetWidth : 1
    crop.img.meta.sx = crop.img.offsetWidth / 2 - (crop.frame.offsetWidth / 2 - crop.img.meta.x), crop.img.meta.sy = crop.img.offsetHeight / 2 - (crop.frame.offsetHeight / 2 - crop.img.meta.y)
    crop.img.meta.x = crop.img.meta.sx < 0 ? -crop.img.offsetWidth / 2 + crop.frame.offsetWidth / 2 : crop.img.meta.sx + crop.frame.offsetWidth > crop.img.offsetWidth ? crop.img.offsetWidth / 2 - crop.frame.offsetWidth / 2 : crop.img.meta.x
    crop.img.meta.y = crop.img.meta.sy < 0 ? -crop.img.offsetHeight / 2 + crop.frame.offsetHeight / 2 : crop.img.meta.sy + crop.frame.offsetHeight > crop.img.offsetHeight ? crop.img.offsetHeight / 2 - crop.frame.offsetHeight / 2 : crop.img.meta.y
    crop.img.style.left = `calc(50% - ${crop.img.meta.x}px)`, crop.img.style.top = `calc(50% - ${crop.img.meta.y}px)`
    if (reset == true) crop.reflow()
}
crop.img.onmousedown = crop.frame.onmousedown = () => crop.click = true
crop.zoom.oninput = crop.reflow
crop.onmouseup = crop.mouseout = () => crop.click = false
crop.div.onmousemove = ({ target }) => { if (!crop.click || !['DIV', 'IMG'].includes(target.tagName)) return; crop.img.meta.x -= event.movementX, crop.img.meta.y -= event.movementY; crop.reflow() }
crop.img.onload = () => {
    crop.active = true, crop.click = false, crop.zoom.value = 100
    crop.frame.style.aspectRatio = `${crop.rawRatio[0]} / ${crop.rawRatio[1]}`
    crop.style.display = 'block'
    crop.reflow(true)
}
crop.ontouchstart = ({ touches: [{ screenX, screenY }] }) => crop.touch = [screenX, screenY]
crop.ontouchmove = ({ target, touches: [{ screenX, screenY }] }) => { if (!['DIV', 'IMG'].includes(target.tagName)) return; crop.img.meta.x -= screenX - crop.touch[0], crop.img.meta.y -= screenY - crop.touch[1]; crop.touch = [screenX, screenY]; crop.reflow() }
crop.cancel.onclick = () => crop.style.display = 'none'
//#endregion


w.onresize = () => {
    if (crop.active) crop.reflow()
}
w.onpopstate = () => uri.load()
w.onload = (async () => {
    token = localStorage.getItem('token')
    metw.errorHandler = () => true //window.location.replace('/hata')
    if (token) login()
    else logout()
    await uri.load()
    setTimeout(() => {
        var loadingScreen = {
            a: d.querySelector('#inital-load-animation a'),
            bar: d.querySelector('#inital-load-animation .loading-bar'),
            main: d.getElementById('inital-load-animation')
        }
        loadingScreen.a.style.transition = loadingScreen.bar.style.transition = '.3s'
        loadingScreen.main.style.transition = '.6s'
        loadingScreen.a.style.transform = 'translate(-50%, -90%)'
        loadingScreen.main.style.opacity = loadingScreen.a.style.opacity = loadingScreen.bar.style.opacity = '0'
        loadingScreen.bar.style.width = '0'
        setTimeout(() => loadingScreen.main.remove(), 600)
    }, 100)
})
if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/serviceWorker.js') }) }
