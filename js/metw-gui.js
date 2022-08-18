metw.gui = {
    post(post) {
        let _post = d.createElement('li')
        _post.innerHTML = `
                <div class='user'>
                    <img src="${post.user.avatarURL}" />
                    <span>${post.user.displayName}</span>
                </div>
                <hr class='bd'>
                <div class="content"></div>
                <div class="date"></div>
                <div class="icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="like"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path></svg>
                    <span class="like_count">${post.likeCount}</span>&nbsp;
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clip-rule="evenodd"></path></svg>
                    <span>${post.commentCount}</span>&nbsp;
                </div>
                `
        _post.className = 'bd bg-1'
        _post.children[0].onclick = () => redirect(`/@${post.user.name}`)
        _post.children[2].innerText = post.content
        _post.children[2].onclick = _post.querySelector('div:last-of-type > span:last-of-type').onclick = _post.querySelector('div:last-of-type > svg:last-of-type').onclick = async () => await redirect(`/gönderi/${post.id}`)
        _post.children[3].innerText = timeSince(post.sentOn)
        _post.querySelector('.like').style.fill = post.liked ? '#EF4444' : ''
        if (session.logged)
            _post.querySelector('.like').onclick = async () => {
                await withLoading(async () => {
                    await post.like(!post.liked)
                })
                _post.querySelector('.like').style.fill = post.liked ? '#EF4444' : ''
                _post.querySelector('.like_count').innerText = post.likeCount
            }
        return _post
    },
    comment(comment) {
        var _replies = []
        if (comment.replyCount > 0) _replies = comment.replies.map(reply => this.comment(reply))
        var _comment = d.createElement('div')
        _comment.className = 'comment-group'
        _comment.innerHTML = `
            <div class="comment bd bg-1">
                <div class="user">
                    <img src="${comment.user.avatarURL}" />
                    <span>${comment.user.displayName}</span>
                </div>
                <hr class="bd" />
                <div class="content">${timeSince(new Date(comment.sentOn))}</div>
                <span class="date"></span>
                <div class="footer">
                    <span class="icon reply">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                        </svg>&nbsp;
                        <b>yanıtla</b>
                    </span>
                </div>
            </div>
            <div class="write-reply" style="display: none">
                <textarea rows=5 class="bd bg-1" placeholder="yazmaya başla..." oninput="filteredInput(event, false, 512)"></textarea>
                <button class="send-reply">gönder</button>
            </div>
            </div><div class="replies">
                <button class="load-more">devamını yükle</button>
            </div>`
        _comment.querySelector('.content').innerText = comment.content
        _comment.querySelector('.date').innerText = timeSince(comment.sentOn)
        _comment.querySelector('.user').onclick = () => redirect(`/@${comment.user.name}`)

        var replies = _comment.querySelector('.replies')
        var loadMore = _comment.querySelector('.load-more')

        loadMore.style.display = ['none', 'block'][+(_replies.length < comment.replyCount)]
        loadMore.onclick = async () => {
            for (reply of await (await comment.get('replies', comment.replies.slice(-1)[0]?.id)).map(comment => this.comment(comment))) replies.insertBefore(reply, loadMore)
            loadMore.style.display = ['none', 'block'][+(comment.replies.length < comment.replyCount)]
        }

        var replyState = false, replyButton = _comment.querySelector('.reply'), writeReply = _comment.querySelector('.write-reply')
        if (session.logged)
            replyButton.onclick = () => {
                replyState = !replyState
                replyButton.querySelector('b').innerText = ['yanılta', 'iptal'][+replyState]
                writeReply.style.display = ['none', 'block'][+replyState]
            }
        else replyButton.remove()
        _comment.querySelector('.send-reply').onclick = async () => {
            var content = _comment.querySelector('.write-reply textarea')
            if (!content.value || content.value.match(/\S+/g).join('').length < 4) return alert.error('Yanıt 4 karakterden kısa olamaz')
            var response = await withLoading(async () => comment.reply(content.value))
            if (response) {
                var commentData = new Comment({ id: response, user: session.user, parent_id: comment.id, top_parent_id: (comment.type == 2 ? comment.topParentId : comment.parentId), content: content.value, sendOn: new Date(), flags: null, replyCount: 0, type: 2 }, session)
                replies.insertBefore(this.comment(commentData), replies.firstChild)
                comment.replies.push(commentData)
                content.value = '', writeReply.style.display = 'none', replyState = false, replyButton.querySelector('b').innerText = 'yanılta'
            }
            else alert.error('Çok hızlı yanıt gönderiyorsunuz! Lütfen birazdan tekrar deneyin.')
        }
        _replies.reverse().forEach(reply => replies.insertBefore(reply, replies.firstChild))
        return _comment
    },
    async comments(service) {
        var comments = await service.get('comments')
        _comments = d.createElement('div')
        _comments.innerHTML = `
            <b>yorumlar</b>
            <textarea class="bd bg-1" rows="5" placeholder="yazmaya başla..." oninput="filteredInput(event, false, 512)"></textarea>
            <button>gönder</button>
            <div class="comments-list"><button class="load-more">devamını yükle</button><br /></div><br />`
        _comments.className = 'comments'
        var loadMore = _comments.querySelector('.load-more'),
            list = _comments.querySelector('.comments-list')
        loadMore.style.display = ['none', 'block'][+(service.commentCount > service.comments.length)]
        loadMore.onclick = async() => {
            for (comment of (await service.get('comments', service.comments.slice(-1)[0].id)).map(comment => this.comment(comment))) list.insertBefore(comment, loadMore)
            loadMore.style.display = ['none', 'block'][+(service.comments.length < service.commentCount)]
        }
        _comments.querySelector('button').onclick = async () => {
            var content = _comments.querySelector('textarea')
            if (!content.value || content.value.match(/\S+/g).join('').length < 4) return alert.error('Yorum 4 karakterden kısa olamaz')
            var response = await withLoading(async () => service.comment(content.value))
            if (response) {
                var commentData = new Comment({ id: response, user: session.user, parent_id: service.id, content: content.value, sendOn: new Date(), flags: null, replyCount: 0, type: 1 }, session)
                list.insertBefore(this.comment(commentData), list.firstChild)
                service.comments.push(commentData)
                content.value = ''
            }
            else alert.error('Çok hızlı yorum gönderiyorsunuz! Lütfen birazdan tekrar deneyin.')
        }
        for (comment of comments.map(comment => this.comment(comment, service))) list.insertBefore(comment, loadMore)
        if (!session.logged) { _comments.querySelector('textarea').style.display = _comments.querySelector('button').style.display = 'none' }
        return _comments
    }
}