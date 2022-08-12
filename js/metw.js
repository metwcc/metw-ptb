/* headers = { }
 * method = 'get'
 * body
 * token
 * hostname = url.backend
 * path 
 */

function request(options) {
    var headers = {}, body = null
    if (options.headers) headers = { ...headers, ...options.headers }
    if (options.json) body = JSON.stringify(options.json), headers['content-type']  = 'application/json'
    if (options.auth) headers.auth = options.auth
    const request = new XMLHttpRequest();
    request.open(options.method || 'get', url.backend + options.path, false)
    for (var header of Object.keys(headers)) request.setRequestHeader(header, headers[header])
    try { request.send(body) } catch { metw.errorHandler() }
    return [JSON.parse(request.responseText), request.status === 200]
}
async function asyncRequest(options) {
    var headers = {}, body
    if (options.headers) headers = { ...headers, ...options.headers }
    if (options.json) body = JSON.stringify(options.json), headers['content-type'] = 'application/json'
    if (options.auth) headers.auth = options.auth
    var raw, ok
    return await fetch(url.backend + options.path, { method: options.method || 'get', headers: headers, body: body }).then(res => { ok = res.ok, raw = res; return res.json() }).then(json => [json, ok, raw]).catch(error => metw.errorHandler())
}

class Session {
    constructor(token) {
        this.logged = false
        this.token = token
        if (this.token) {
            var [json, ok] = request({ path: 'session', auth: this.token })
            if (ok) {
                this.username = json.username, this.id = json.id, this.permissions = json.permissions
                this.user = new User({ ...json, session: this })
                this.logged = true
            }
            else this.logged = false
        }
        this.indexed = { users: [], posts: [] }
    }
    async getUser(selector, profile) {
        var _selector = Number.isInteger(selector) ? ':' + selector : selector,
            indexed = this.indexed.users.find(user => (Number.isInteger(selector) ? user.id : user.username) == selector)
        if (this.user && selector == (Number.isInteger(selector) ? this.user.id : this.user.username)) return this.user
        if (indexed) return indexed
        var [data, ok] = await asyncRequest({ path: `users/${_selector}${profile ? '/profile' : ''}${this.logged ? '?id=' + this.id : ''}` })
        return ok ? (() => { var user = new User({ ...data, profile: profile ? data : false, session: this }); this.indexed.users.push(user); return user })() : false
    }
    async getUsers(ids) {
        var idsToFetch = ids.filter(id => !this.indexed.users.some(indexedUser => indexedUser.id == id)).filter((id, index, array) => array.indexOf(id) == index)
        if (idsToFetch.length == 0) var [data, ok] = [[], true]
        else var [data, ok] = await asyncRequest({ path: `users/profiles?id=${this.logged ? this.id : 0}`, json: idsToFetch, method: 'post' })
        if (ok) this.indexed.users.push(...data.map(user => new User({ ...user, profile: user, session: this })))
        return ok ? (() => { return ids.map(id => this.indexed.users.find(user => user.id == id)) })() : false
    }
    async getPost(id) {
        var [post, ok] = await asyncRequest({ path: `posts/${id}?id=${this.id}` })
        if (!ok) return false
        return new Post({ ...post, session: this, user: (await this.getUser(post.user_id)) })
    }
    async explore() {
        var [data, ok] = await asyncRequest({ path: `explore?id=${this.logged ? this.id : 0}` })
        return ok ? data : false
    }
    async homepage(offset) {
        var [data, ok] = await asyncRequest({ path: `homepage?id=${this.logged ? this.id : 0}&offset=${offset}` })
        return ok ? data : false
    }
    async settings(actions) {
        var [responses, ok] = await asyncRequest({ path: 'settings', json: actions, method: 'post', auth: this.token })
        var resp = {}
        for (var response of Object.keys(responses))
            switch (response) {
                case 'remove_avatar': if (this.user._profile) this.user._profile.avatar = 0; break
                case 'remove_banner': if (this.user._profile) this.user._profile.banner = 0; break
                case 'update_bio': if (this.user._profile) this.user._profile.bio = actions.find(action => action.name == 'update_bio').content; break
                case 'change_password':
                    if (responses['change_password'][1]) this.token = responses['change_password'][0]
                    resp['change_password'] = responses['change_password'][1]
                    break
            }
        return resp
    }
    async post(content, type, parentId) {
        var [resposne, ok] = await asyncRequest({ path: 'posts', json: { content: content, parent_id: parentId != undefined ? parentId : 0, type: type != undefined ? type : 0 }, method: 'post', auth: this.token  })
        return ok ? (() => {
            if (!type) {
                this.user.indexed.posts = []
                this.user.profile.post_cout++
            }
            return resposne
        })() : false
    }
    async changeAvatar(base64) {
        var [newAvatar, ok] = await asyncRequest({ path: 'upload/avatar', method: 'post', auth: token, json: { base64: base64 } })
        if (ok) this.user._profile.avatar = newAvatar
        return ok ? newAvatar : ok
    }
    async changeBanner(base64) {
        var [newBanner, ok] = await asyncRequest({ path: 'upload/banner', method: 'post', auth: token, json: { base64: base64 } })
        if (ok) this.user._profile.banner = newBanner
        return ok ? newBanner : ok
    }
}

class User {
    constructor(data) {
        this.username = data.username, this.id = data.id
        this.permissions = data.permissions
        this._session = data.session
        this._profile = data.profile ? data.profile : false
        this.indexed = { posts: { } }
    }
    get profile() {
        return {
            ...(this._profile != false ? this._profile : this._profile = request({ path: `users/:${this.id}/profile?id=${this._session ? this._session.id : ''}` })[0]),
            get avatarURL() { return url.cdn + `${this.avatar == 0 ? 'assets/avatars/1' : 'usercontent/' + this.id + '/0' + this.avatar}` },
            get bannerURL() { return this.banner == 0 ? 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' : url.cdn + 'usercontent/' + this.id + '/1' + this.banner }
        }
    }
    get fullUsername() {
        return '@' + this.username
    }
    async follow() {
        var follow = (await asyncRequest({ path: `users/:${this.id}/follow`, auth: this._session.token }))[0]
        if (!follow) return false
        if (!!this._profile) { this._profile.follower_count++; this._profile.followed = true }
        if (!!this._session.user._profile) this._session.user._profile.following_count++
        return true
    }
    async unfollow() {
        var unfollow = (await asyncRequest({ path: `users/:${this.id}/unfollow`, auth: this._session.token }))[0]
        if (!unfollow) return false
        if (!!this._profile) { this._profile.follower_count--; this._profile.followed = false }
        if (!!this._session.user._profile) this._session.user._profile.following_count--
        return true
    }
    async getFollowers(limit, offset) {
        var [followers, ok] = (await asyncRequest({ path: `users/:${this.id}/followers?limit=${limit}&offset=${offset}` }))
        if (!ok) return false
        return await this._session.getUsers(followers)
    }
    async getFollowings(limit, offset) {
        var [followings, ok] = (await asyncRequest({ path: `users/:${this.id}/followings?limit=${limit}&offset=${offset}` }))
        if (!ok) return false
        return await this._session.getUsers(followings)
    }
    async getPosts(page) {
        if (this.indexed.posts[page + '']) return this.indexed.posts[page + '']
        var [posts, ok] = await asyncRequest({ path: `users/:${this.id}/posts?limit=15&offset=${page * 15}&id=${this._session.id}` })
        if (!ok) return false
        return this.indexed.posts[page + ''] = posts.map(post => new Post({ ...post, user: this, session: this._session }))
    }
    async getComments(offset, count) {
        var [comments, ok] = await asyncRequest({ path: `comments?offset=${offset == undefined ? 0 : offset}&id=${this.id}&type=0&deep=true&count=${!!count}` })
        if (count) this._profile.comment_count = comments[1], comments = comments[0], this.indexed.comments = []
        if (!ok) return false
        await this._session.getUsers(comments.map(comment => comment.user_id))
        for (let _comment = 0; _comment < comments.length; _comment++) {
            let comment = comments[_comment], user = await this._session.getUser(comment.user_id, true)
            comments[_comment] = new Comment({ ...comment, reply_count: parseInt(comment.reply_count), session: this._session, user: user })
        }
        for (let depth = 1; depth < 3; depth++)
            comments.forEach((comment) => {
                if (comment.depth == depth) comments.find((parent_comment) => comment.parent_id == parent_comment.id).replies.push(comment)
            })
        comments = comments.filter(comment => comment.depth == 0)
        this.indexed.comments.push(...comments)
        return comments
    }
    async comment(content) {
        var [response, ok] = await asyncRequest({ path: 'comments', auth: this._session.token, method: 'post', json: { content: content, parent_id: this.id, type: 0 } })
        return ok ? response : ok
    }
}

class Comment {
    constructor(data) {
        this.id = data.id
        this.user = data.user
        this.parent_id = data.parent_id
        this.content = data.content
        this.date = data.date
        this.flags = data.flags
        this.reply_count = data.reply_count
        this.type = data.type
        this.depth = data.depth
        this.replies = []
        this._session = data.session
        this.comment_count = 0
        this.comments = []
    }
    async reply(content) {
        var [response, ok] = await asyncRequest({ path: 'comments', auth: this._session.token, method: 'post', json: { content: content, parent_id: this.id, type: 2 } })
        return ok ? response : ok
    }
    async getReplies(offset) {
        var [replies, ok] = await asyncRequest({ path: `comments?offset=${offset == undefined ? 0 : offset}&id=${this.id}&type=2&deep=true` })
        if (!ok) return false
        await this._session.getUsers(replies.map(reply => reply.user_id))
        for (let _reply = 0; _reply < replies.length; _reply++) {
            let reply = replies[_reply], user = await this._session.getUser(reply.user_id, true)
            replies[_reply] = new Comment({ ...reply, reply_count: parseInt(reply.reply_count), session: this._session, user: user })
        }
        for (let depth = 1; depth < 3; depth++)
            replies.forEach((reply) => {
                if (reply.depth == depth) replies.find((parent_reply) => reply.parent_id == parent_reply.id).replies.push(reply)
            })
        replies = replies.filter(reply => reply.depth == 0)
        this.replies.push(...replies)
        return replies
    }
}

class Post {
    constructor(data) {
        this.id = data.id
        this.user = data.user
        this.content = data.content
        this.date = new Date(data.date)
        this.flags = data.flags
        this.type = data.type
        this.loved = data.loved
        this.love_count = parseInt(data.love_count)
        this.comment_count = parseInt(data.comment_count)
        this.indexed = { comments: [] }
        this._session = data.session ? data.session : false
    }
    async getComments(offset, count) {
        var [comments, ok] = await asyncRequest({ path: `comments?offset=${offset == undefined ? 0 : offset}&id=${this.id}&type=1&deep=true&count=${!!count}` })
        if (count) comments = comments[0], this.indexed.comments = []
        if (!ok) return false
        await this._session.getUsers(comments.map(comment => comment.user_id))
        for (let _comment = 0; _comment < comments.length; _comment++) {
            let comment = comments[_comment], user = await this._session.getUser(comment.user_id, true)
            comments[_comment] = new Comment({ ...comment, reply_count: parseInt(comment.reply_count), session: this._session, user: user })
        }
        for (let depth = 1; depth < 3; depth++)
            comments.forEach((comment) => {
                if (comment.depth == depth) comments.find((parent_comment) => comment.parent_id == parent_comment.id).replies.push(comment)
            })
        comments = comments.filter(comment => comment.depth == 0)
        this.indexed.comments.push(...comments)
        return comments
    }
    async love() {
        if (this.loved) return false
        var [love, ok] = (await asyncRequest({ path: `posts/${this.id}/love`, auth: this._session.token }))
        return ok && love ? (() => { this.love_count++; this.loved = true; return true })(): false
    }
    async unlove() {
        if (!this.loved) return false
        var [love, ok] = (await asyncRequest({ path: `posts/${this.id}/unlove`, auth: this._session.token }))
        return ok && love ? (() => { this.love_count--; this.loved = false; return true })(): false
    }
    async comment(content) {
        var [response, ok] = await asyncRequest({ path: 'comments', auth: this._session.token, method: 'post', json: { content: content, parent_id: this.id, type: 1 } })
        return ok ? response : ok
    }
}

metw = { Post: Post, User: User, Session: Session }