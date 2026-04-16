/**
 * OnlyFans Reactions Extension for SillyTavern
 * v1.3 — Settings panel toggle, cancel generation, comment persistence,
 *         working tip modal, instruction persistence+clear, chat memory toggle,
 *         unlimited posts, swipe/reroll request popup persistence
 */

(function () {
    'use strict';
    window.OF_Reactions = window.OF_Reactions || {};

    // =========================================================================
    // MODULE: Utils
    // =========================================================================
    window.OF_Reactions.Utils = {
        avatarColors: [
            '#00AFF0', '#0077B6', '#00B4D8', '#48CAE4',
            '#E91E8C', '#F72585', '#7209B7', '#3A0CA3',
            '#4CC9F0', '#4361EE', '#F77F00', '#D62828'
        ],
        escapeHtml(text) {
            if (!text) return '';
            return String(text)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },
        formatContent(text) {
            if (!text) return '';
            let clean = text.replace(/<br\s*\/?>/gi, '\n');
            let e = this.escapeHtml(clean);
            e = e.replace(/(^|\s)#([a-zA-Z0-9가-힣_-]+)/g, '$1<span class="of-hashtag">#$2</span>');
            e = e.replace(/(^|\s)(@[a-zA-Z0-9_.]+)/g, '$1<span class="of-mention">$2</span>');
            return e.replace(/\n/g, '<br>');
        },
        getAvatarColor(name) {
            if (!name) return this.avatarColors[0];
            const clean = String(name).replace(/^@+/, '').toLowerCase();
            let hash = 0;
            for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
            return this.avatarColors[Math.abs(hash) % this.avatarColors.length];
        },
        getAvatarLetter(name) {
            if (!name) return 'U';
            return (String(name).replace(/^@+/, '')[0] || 'U').toUpperCase();
        },
        formatNumber(num) {
            if (num === undefined || num === null) return '0';
            if (typeof num === 'string' && /[KkMm]$/i.test(num)) return num;
            const n = parseFloat(num);
            if (isNaN(n)) return String(num);
            if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
            if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
            return n.toString();
        },
        formatTipAmount(amount) {
            if (!amount) return '';
            const n = parseFloat(String(amount).replace(/[^0-9.]/g, ''));
            if (isNaN(n)) return String(amount);
            return '$' + (Number.isInteger(n) ? n : n.toFixed(2));
        }
    };

    // =========================================================================
    // MODULE: TipModal (global singleton)
    // =========================================================================
    window.OF_Reactions.TipModal = {
        _cb: null,
        init() {
            if (document.getElementById('of-tip-overlay')) return;
            document.body.insertAdjacentHTML('beforeend', `
<div id="of-tip-overlay">
    <div id="of-tip-dialog">
        <div class="of-tip-dialog-header">
            <i class="fa-solid fa-dollar-sign"></i>
            <span id="of-tip-dialog-title">후원하기</span>
            <button class="of-tip-close" id="of-tip-dialog-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="of-tip-amount-wrap">
            <span class="of-tip-dollar-sign">$</span>
            <input type="number" id="of-tip-amount-input" min="1" max="9999" step="1" placeholder="금액 입력">
        </div>
        <div class="of-tip-quick-amounts">
            <button class="of-tip-quick-btn" data-v="5">$5</button>
            <button class="of-tip-quick-btn" data-v="10">$10</button>
            <button class="of-tip-quick-btn" data-v="25">$25</button>
            <button class="of-tip-quick-btn" data-v="50">$50</button>
            <button class="of-tip-quick-btn" data-v="100">$100</button>
        </div>
        <div class="of-tip-sender-wrap">
            <div class="of-tip-sender-label">후원자 유형</div>
            <label class="of-tip-sender-radio"><input type="radio" name="of-tip-sender" value="user" checked> <span>{{user}}로 후원 <small>(캐릭터가 직접 반응)</small></span></label>
            <label class="of-tip-sender-radio"><input type="radio" name="of-tip-sender" value="anonymous"> <span>익명/제3자 후원 <small>(캐릭터가 자랑)</small></span></label>
        </div>
        <div class="of-tip-dialog-btns">
            <button id="of-tip-dialog-cancel">취소</button>
            <button id="of-tip-dialog-send"><i class="fa-solid fa-heart"></i> 후원 보내기</button>
        </div>
    </div>
</div>`);
            const overlay = document.getElementById('of-tip-overlay');
            overlay.addEventListener('click', e => { if (e.target === overlay) this.hide(); });
            document.getElementById('of-tip-dialog-close').addEventListener('click', () => this.hide());
            document.getElementById('of-tip-dialog-cancel').addEventListener('click', () => this.hide());
            document.getElementById('of-tip-dialog-send').addEventListener('click', () => this._submit());
            document.getElementById('of-tip-amount-input').addEventListener('keydown', e => {
                if (e.key === 'Enter') this._submit();
                document.getElementById('of-tip-amount-input').classList.remove('of-input-error');
            });
            document.querySelectorAll('.of-tip-quick-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.getElementById('of-tip-amount-input').value = btn.dataset.v;
                    document.getElementById('of-tip-amount-input').classList.remove('of-input-error');
                });
            });
        },
        _submit() {
            const inp = document.getElementById('of-tip-amount-input');
            const amount = parseFloat(inp.value);
            if (!amount || amount <= 0) { inp.classList.add('of-input-error'); return; }
            const senderType = document.querySelector('input[name="of-tip-sender"]:checked')?.value || 'user';
            if (this._cb) this._cb(amount, senderType);
            this.hide();
        },
        show(title, cb) {
            this._cb = cb;
            document.getElementById('of-tip-dialog-title').textContent = title || '후원하기';
            document.getElementById('of-tip-amount-input').value = '';
            document.getElementById('of-tip-amount-input').classList.remove('of-input-error');
            document.getElementById('of-tip-overlay').classList.add('of-tip-visible');
            setTimeout(() => document.getElementById('of-tip-amount-input').focus(), 120);
        },
        hide() {
            this._cb = null;
            document.getElementById('of-tip-overlay').classList.remove('of-tip-visible');
        }
    };

    // =========================================================================
    // MODULE: Templates
    // =========================================================================
    window.OF_Reactions.Templates = {

        wrapper(content, collapsed, messageId, hasData, pageIndex, pageCount, memoryOn, instruction, savedProfile) {
            const chevronClass = collapsed ? 'of-chevron-collapsed' : '';
            const safeInstr = (instruction || '').replace(/'/g, '&#039;').replace(/"/g, '&quot;');
            let swipeBar = '';
            if (hasData && pageCount > 0) {
                const prevDis = pageIndex <= 0 ? 'disabled' : '';
                const nextDis = pageIndex >= pageCount - 1 ? 'disabled' : '';
                const memClass = memoryOn ? 'of-memory-on' : '';
                const memTitle = memoryOn ? '채팅 메모리 ON (클릭하여 끄기)' : '채팅 메모리 OFF (클릭하여 켜기)';
                const memIcon = memoryOn ? 'fa-brain' : 'fa-brain';
                swipeBar = `
<div class="of-swipe-bar">
    <button class="of-swipe-btn" ${prevDis} onclick="window.OF_Reactions.Actions.swipePage('${messageId}',-1)">
        <i class="fa-solid fa-chevron-left"></i>
    </button>
    <span class="of-swipe-label">${pageIndex + 1} / ${pageCount}</span>
    <button class="of-swipe-btn" ${nextDis} onclick="window.OF_Reactions.Actions.swipePage('${messageId}',1)">
        <i class="fa-solid fa-chevron-right"></i>
    </button>
    <div class="of-bar-right">
        <button class="of-memory-btn ${memClass}" onclick="window.OF_Reactions.Actions.toggleMemory('${messageId}')" title="${memTitle}">
            <i class="fa-solid ${memIcon}"></i>
        </button>
        <button class="of-delete-btn" onclick="window.OF_Reactions.Actions.deletePage('${messageId}')" title="현재 페이지 삭제">
            <i class="fa-solid fa-trash"></i>
        </button>
        <button class="of-addpage-btn" onclick="window.OF_Reactions.Actions.promptAction('${messageId}','add',event)" title="새 페이지 추가">
            <i class="fa-solid fa-plus"></i> 추가
        </button>
        <button class="of-reroll-btn" onclick="window.OF_Reactions.Actions.promptAction('${messageId}','reroll',event)" title="현재 페이지 리롤">
            <i class="fa-solid fa-rotate-right"></i> 리롤
        </button>
    </div>
</div>
<div class="of-action-popup" id="of-popup-${messageId}" style="display:none;">
    <div class="of-popup-inner">
        <div class="of-popup-label" id="of-popup-label-${messageId}">요청사항</div>
        <div class="of-popup-count-row">
            <label class="of-popup-count-label">포스트 수</label>
            <input type="number" class="of-popup-count-input" id="of-popup-count-${messageId}" min="1" max="10" value="3">
        </div>
        <div class="of-popup-profile-row" id="of-popup-profile-row-${messageId}">
            <!-- profile chooser injected by JS when savedProfile exists -->
        </div>
        <div class="of-popup-textarea-wrap">
            <textarea class="of-popup-instruction" id="of-popup-instruction-${messageId}" rows="3" placeholder="원하는 방향이나 요청사항 (비워두면 AI가 자유롭게 생성)">${safeInstr}</textarea>
            <button class="of-instr-clear-btn" onclick="window.OF_Reactions.Actions.clearInstruction('${messageId}')" title="내용 전체 삭제"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="of-popup-btns">
            <button class="of-popup-cancel" onclick="window.OF_Reactions.Actions.closePopup('${messageId}')">닫기</button>
            <button class="of-popup-confirm" id="of-popup-confirm-${messageId}">생성</button>
        </div>
    </div>
</div>`;
            }

            const storedInstr = (instruction || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            return `
<div class="of-reaction-wrapper ${collapsed ? 'collapsed' : ''}" data-mesid="${messageId}" data-has-data="${hasData}">
    <div class="of-header-bar" onclick="window.OF_Reactions.Actions.toggleWrapper('${messageId}')">
        <div class="of-header-title">
            <i class="fa-brands fa-creative-commons-nc of-icon-of"></i>
            <span class="of-header-label">OnlyFans</span>
        </div>
        <div class="of-header-right">
            <i class="fa-solid fa-chevron-down of-chevron ${chevronClass}"></i>
        </div>
    </div>
    <div class="of-body ${collapsed ? 'collapsed' : ''}">
        <div class="of-body-inner">
            ${swipeBar}
            ${hasData ? content : `
            <div class="of-start-config" data-mesid="${messageId}">
                <div class="of-start-row">
                    <div class="of-start-lang-wrap">
                        <select class="of-start-lang-select">
                            <option value="ko">한국어</option>
                            <option value="en">English</option>
                            <option value="ja">日本語</option>
                        </select>
                    </div>
                    <div class="of-start-count-wrap">
                        <label>포스트 수</label>
                        <input type="number" class="of-start-count-input" min="1" value="3">
                    </div>
                </div>
                ${savedProfile ? `
                <div class="of-saved-profile-banner">
                    <div class="of-saved-profile-info"><i class="fa-solid fa-user-check"></i> 저장된 계정: <strong>${window.OF_Reactions.Utils.escapeHtml(savedProfile.creator)}</strong> (@${window.OF_Reactions.Utils.escapeHtml(savedProfile.handle||'')})</div>
                    <div class="of-profile-mode-radios">
                        <label><input type="radio" name="of-profile-mode-${messageId}" value="existing" checked> 이전 계정 사용</label>
                        <label><input type="radio" name="of-profile-mode-${messageId}" value="new"> 새 계정 생성</label>
                    </div>
                    <button class="of-clear-saved-profile-btn" title="저장된 계정 삭제"><i class="fa-solid fa-trash"></i> 계정 초기화</button>
                </div>` : `<input type="hidden" name="of-profile-mode-${messageId}" value="new">`}
                <div class="of-popup-textarea-wrap">
                    <textarea class="of-start-instruction" rows="2" placeholder="요청사항 / 전개 지시사항 (선택 — 비워두면 AI가 알아서 생성)">${storedInstr}</textarea>
                    <button class="of-instr-clear-btn" onclick="window.OF_Reactions.Actions.clearInstruction('${messageId}',true)" title="내용 전체 삭제"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <button class="of-start-generate-btn" data-mesid="${messageId}">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> OnlyFans 페이지 생성
                </button>
            </div>`}
        </div>
    </div>
</div>`;
        },

        profileCard(profile, mesId, pageKey) {
            const U = window.OF_Reactions.Utils;
            const bannerColor = U.getAvatarColor((profile.creator || 'creator') + '_banner');
            const avatarColor = U.getAvatarColor(profile.creator || 'creator');
            const isSubscribed = window.OF_Reactions.Actions.isSubscribed(mesId, pageKey);
            const price = U.escapeHtml(profile.price || '9.99');
            const subBtnHtml = isSubscribed
                ? `<button class="of-subscribe-btn of-subscribed" onclick="window.OF_Reactions.Actions.unsubscribe('${mesId}','${pageKey}',this,'${price}')"><i class="fa-solid fa-check"></i> Subscribed</button>`
                : `<button class="of-subscribe-btn" onclick="window.OF_Reactions.Actions.subscribe('${mesId}','${pageKey}',this,'${price}')"><i class="fa-solid fa-lock-open"></i> Subscribe $${price}/mo</button>`;
            return `
<div class="of-profile-card">
    <div class="of-profile-banner" style="background:linear-gradient(135deg,${bannerColor}44,${bannerColor}22);">
        <div class="of-profile-avatar" style="background-color:${avatarColor};">${U.getAvatarLetter(profile.creator)}</div>
    </div>
    <div class="of-profile-info">
        <div class="of-profile-name-row">
            <span class="of-profile-name">${U.escapeHtml(profile.creator || 'Creator')}</span>
            <span class="of-verified-badge"><i class="fa-solid fa-circle-check"></i></span>
        </div>
        <div class="of-profile-handle">@${U.escapeHtml((profile.handle || 'creator').replace(/^@+/, ''))}</div>
        <div class="of-profile-bio">${U.formatContent(profile.bio || '')}</div>
        <div class="of-profile-stats">
            <div class="of-stat-item"><span class="of-stat-num">${U.formatNumber(profile.subscribers||0)}</span><span class="of-stat-lbl">Fans</span></div>
            <div class="of-stat-item"><span class="of-stat-num">${U.formatNumber(profile.likes||0)}</span><span class="of-stat-lbl">Likes</span></div>
            <div class="of-stat-item"><span class="of-stat-num">${U.formatNumber(profile.posts||0)}</span><span class="of-stat-lbl">Posts</span></div>
        </div>
        <div class="of-profile-actions">
            ${subBtnHtml}
            <button class="of-msg-btn" title="Message"><i class="fa-regular fa-paper-plane"></i></button>
            <button class="of-tip-profile-btn" title="후원하기" onclick="window.OF_Reactions.Actions.openProfileTip('${mesId}','${pageKey}','${U.escapeHtml(profile.creator||'Creator')}')"><i class="fa-solid fa-dollar-sign"></i></button>
        </div>
    </div>
</div>`;
        },

        postCard(post, index, mesId, pageKey) {
            const U = window.OF_Reactions.Utils;
            const isPPV = (post.type || '').toLowerCase() === 'ppv';
            const isSub = (post.type || '').toLowerCase() === 'subscription';
            const isLocked = isPPV || isSub;
            const postId = `of-post-${mesId}-${pageKey}-${index}`;
            const subbed = window.OF_Reactions.Actions.isSubscribed(mesId, pageKey);
            const purchased = window.OF_Reactions.Actions.isPurchased(postId);
            const isUnlocked = (isSub && subbed) || (isPPV && purchased);

            let mediaHtml = '';
            if (post.media && post.media.length > 0) {
                const items = post.media.map(m => {
                    const isVideo = /video|영상|동영상/i.test(m);
                    if (isLocked && !isUnlocked) {
                        const lockAction = isPPV
                            ? `<button class="of-unlock-btn of-ppv-buy" onclick="window.OF_Reactions.Actions.purchasePPV('${postId}','${U.escapeHtml(post.price||'9.99')}','${mesId}','${pageKey}')"><i class="fa-solid fa-unlock"></i> ${U.formatTipAmount(post.price)} 구매하기</button>`
                            : `<button class="of-unlock-btn of-sub-unlock" onclick="window.OF_Reactions.Actions.subscribeFromPost('${mesId}','${pageKey}')"><i class="fa-solid fa-unlock"></i> 구독하고 잠금 해제</button>`;
                        return `<div class="of-media-locked">
                            <div class="of-media-blur-content">
                                <i class="fa-solid ${isVideo?'fa-video':'fa-image'} of-media-type-icon"></i>
                                <span class="of-media-desc-blur">${U.escapeHtml(m)}</span>
                            </div>
                            <div class="of-lock-overlay">
                                <i class="fa-solid fa-lock"></i>
                                ${isPPV ? `<span class="of-ppv-price">${U.formatTipAmount(post.price)}</span>` : '<span>Subscribe to unlock</span>'}
                                ${lockAction}
                            </div>
                        </div>`;
                    } else {
                        return `<div class="of-media-free ${isUnlocked?'of-media-unlocked':''}">
                            ${isUnlocked ? '<span class="of-unlocked-badge"><i class="fa-solid fa-unlock"></i> 잠금 해제됨</span>' : ''}
                            <i class="fa-solid ${isVideo?'fa-video':'fa-image'} of-media-free-icon"></i>
                            <span class="of-media-desc">${U.escapeHtml(m)}</span>
                        </div>`;
                    }
                }).join('');
                mediaHtml = `<div class="of-post-media">${items}</div>`;
            }

            let commentsHtml = '';
            if (post.comments && post.comments.length > 0) {
                const cItems = post.comments.map(c => {
                    const subHtml = c.isSub ? '<span class="of-sub-indent">└</span>' : '';
                    const tipHtml = c.tip ? `<span class="of-comment-tip"><i class="fa-solid fa-dollar-sign"></i>${U.formatTipAmount(c.tip)}</span>` : '';
                    const ac = U.getAvatarColor(c.username);
                    return `<div class="of-comment ${c.isSub?'of-sub-comment':''}">
                        ${subHtml}
                        <div class="of-comment-avatar" style="background-color:${ac};">${U.getAvatarLetter(c.username)}</div>
                        <div class="of-comment-body">
                            <div class="of-comment-header">
                                <span class="of-comment-user">${U.escapeHtml(c.username)}</span>
                                ${tipHtml}
                                <span class="of-comment-time">${U.escapeHtml(c.time||'')}</span>
                            </div>
                            <div class="of-comment-text">${U.formatContent(c.content)}</div>
                        </div>
                    </div>`;
                }).join('');
                commentsHtml = `<div class="of-comments-section" id="${postId}-comments" style="display:none;"><div class="of-comments-list">${cItems}</div></div>`;
            }

            const likeCount = post.stats?.likes || post.likes || 0;
            const commentCount = post.comments ? post.comments.length : (post.stats?.comments || 0);
            const tipCount = post.stats?.tips || 0;

            const typeBadge = isPPV
                ? `<span class="of-type-badge ppv"><i class="fa-solid fa-lock"></i> PPV ${U.formatTipAmount(post.price)}</span>`
                : isSub
                    ? `<span class="of-type-badge sub"><i class="fa-solid fa-lock"></i> Subscribers Only</span>`
                    : `<span class="of-type-badge free"><i class="fa-solid fa-unlock"></i> Free</span>`;

            return `
<div class="of-post-card" id="${postId}">
    <div class="of-post-header">
        <div class="of-post-meta">
            <span class="of-post-time">${U.escapeHtml(post.date||post.time||'')}</span>
            ${typeBadge}
        </div>
    </div>
    ${post.caption ? `<div class="of-post-caption">${U.formatContent(post.caption)}</div>` : ''}
    ${mediaHtml}
    <div class="of-post-actions">
        <button class="of-action-btn of-like-btn"><i class="fa-regular fa-heart"></i><span>${U.formatNumber(likeCount)}</span></button>
        <button class="of-action-btn of-comment-btn" onclick="window.OF_Reactions.Actions.toggleComments('${postId}','${mesId}','${pageKey}',${index})">
            <i class="fa-regular fa-comment"></i><span>${U.formatNumber(commentCount)}</span>
        </button>
        <button class="of-action-btn of-tip-post-btn" onclick="window.OF_Reactions.Actions.openPostTip('${postId}','${mesId}')">
            <i class="fa-solid fa-dollar-sign"></i>
            <span>${tipCount ? U.formatNumber(tipCount) : '후원'}</span>
        </button>
        <button class="of-action-btn of-share-btn"><i class="fa-solid fa-share-nodes"></i></button>
    </div>
    ${commentsHtml}
</div>`;
        },

        loading(mesId) {
            return `<div class="of-loading">
                <div class="of-spinner"></div>
                <span>OnlyFans 페이지 생성 중...</span>
                <button class="of-cancel-gen-btn" onclick="window.OF_Reactions.Actions.cancelGeneration('${mesId}')">
                    <i class="fa-solid fa-xmark"></i> 생성 취소
                </button>
            </div>`;
        },

        error(msg, mesId, isCensored) {
            const retryBtn = (isCensored && mesId)
                ? `<button class="of-retry-btn" onclick="window.OF_Reactions.Actions.retryGeneration('${mesId}')"><i class="fa-solid fa-rotate-right"></i> 재시도</button>`
                : '';
            return `<div class="of-error"><i class="fa-solid fa-triangle-exclamation"></i> ${window.OF_Reactions.Utils.escapeHtml(msg)}${retryBtn}</div>`;
        }
    };

    // =========================================================================
    // MODULE: Parser (unchanged)
    // =========================================================================
    window.OF_Reactions.Parser = {
        parse(text) {
            if (!text) return null;
            const result = { profile: null, posts: [] };
            const profileMatch = text.match(/\[OF_PROFILE\]([\s\S]*?)\[\/OF_PROFILE\]/i);
            if (profileMatch) {
                const b = profileMatch[1];
                result.profile = {
                    creator: this._f(b,'Creator')||this._f(b,'Name')||'Creator',
                    handle: this._f(b,'Handle')||this._f(b,'Username')||'creator',
                    subscribers: this._f(b,'Subscribers')||this._f(b,'Fans')||'0',
                    likes: this._f(b,'Likes')||'0',
                    posts: this._f(b,'Posts')||'0',
                    price: this._f(b,'Price')||this._f(b,'Sub')||'9.99',
                    bio: this._f(b,'Bio')||''
                };
            }
            const postRx = /\[OF_POST\]([\s\S]*?)\[\/OF_POST\]/gi;
            let m;
            while ((m = postRx.exec(text)) !== null) {
                const b = m[1];
                result.posts.push({
                    type: this._f(b,'Type')||'Free',
                    price: this._f(b,'Price')||'',
                    caption: this._f(b,'Caption')||this._f(b,'Content')||'',
                    date: this._f(b,'Date')||this._f(b,'Time')||'',
                    media: this._media(b),
                    comments: this._comments(b),
                    stats: this._stats(b)
                });
            }
            return result;
        },
        _f(block, key) {
            const m = block.match(new RegExp(`^${key}:\\s*(.+)`, 'im'));
            return m ? m[1].trim() : null;
        },
        _media(block) {
            const res = [];
            const rx = /^Media:\s*(?:\[(?:Photo|Image|Video|Foto)\]\s*)?(.+)/gim;
            let m;
            while ((m = rx.exec(block)) !== null) res.push(m[1].trim());
            return res;
        },
        _stats(block) {
            const s = this._f(block, 'Stats');
            if (!s) return { likes: 0, comments: 0, tips: 0 };
            const l = s.match(/(\d+[\d.,KkMm]*)\s*L/i);
            const c = s.match(/(\d+[\d.,KkMm]*)\s*C/i);
            const t = s.match(/(\d+[\d.,KkMm]*)\s*T/i);
            return { likes: l?l[1]:0, comments: c?c[1]:0, tips: t?t[1]:0 };
        },
        _comments(block) {
            const m = block.match(/\[OF_COMMENTS\]([\s\S]*?)\[\/OF_COMMENTS\]/i);
            if (!m) return [];
            return m[1].split('\n').map(l => l.trim()).filter(Boolean).map(line => {
                const isSub = line.startsWith('└');
                const clean = line.replace(/^└\s*/,'');
                const tip = clean.match(/^(.+?)\s*\[(\$[\d.]+)\]:\s*([\s\S]+?)(?:\s*\[(.+?)\])?$/);
                if (tip) return { username: tip[1].trim(), tip: tip[2], content: tip[3].trim(), time: tip[4]||'', isSub };
                const norm = clean.match(/^(.+?):\s*([\s\S]+?)(?:\s*\[([^\]]+)\])?$/);
                if (norm) return { username: norm[1].trim(), content: norm[2].trim(), time: norm[3]||'', isSub };
                return null;
            }).filter(Boolean);
        }
    };

    // =========================================================================
    // MODULE: Settings
    // =========================================================================
    window.OF_Reactions.Settings = class {
        constructor() {
            this.storageKey = 'of_reactions_settings';
            this.persistKey  = 'of_reactions_persistent';
            this.settings = this._defaults();
            this._pages = {};
            this._pageIndexes = {};
            this._subscribed = {};
            this._purchased = {};
            this._openComments = {};      // [mesId][pageKey] = Set<index>
            this._instructions = {};     // [mesId] = string
            this._memoryActive = null;   // mesId string or null
            // Persistent across sessions
            this._savedProfiles = {};    // charId -> profile object
            this._tips = [];             // [{amount, senderType, target, charName, time}]
            this._msgFingerprints = {};  // mesId -> first 200 chars of message text at generation time
        }
        _defaults() { return { enabled: true, maxPosts: 3, language: 'ko', collapsed: {} }; }
        load() {
            try { const r = localStorage.getItem(this.storageKey); if (r) Object.assign(this.settings, JSON.parse(r)); } catch(e){}
            // Load persistent profile/tip data
            try {
                const p = localStorage.getItem(this.persistKey);
                if (p) {
                    const d = JSON.parse(p);
                    this._savedProfiles = d.profiles || {};
                    this._tips = d.tips || [];
                    if (d.memoryActive !== undefined) this._memoryActive = d.memoryActive;
                }
            } catch(e) {}
            return this;
        }
        save() { try { localStorage.setItem(this.storageKey, JSON.stringify(this.settings)); } catch(e){} }
        savePersistent() {
            try {
                localStorage.setItem(this.persistKey, JSON.stringify({
                    profiles: this._savedProfiles,
                    tips: this._tips,
                    memoryActive: this._memoryActive
                }));
            } catch(e) {}
        }
        get() { return this.settings; }

        // Collapsed
        isCollapsed(mid) { return this.settings.collapsed[mid] !== false; }
        setCollapsed(mid, val) { this.settings.collapsed[mid] = val; this.save(); }

        // Pages
        hasData(mid) { return !!(this._pages[mid] && this._pages[mid].length > 0); }
        getData(mid) {
            const p = this._pages[mid]; if (!p || !p.length) return null;
            return p[Math.min(this._pageIndexes[mid]||0, p.length-1)];
        }
        addPage(mid, data) {
            if (!this._pages[mid]) this._pages[mid] = [];
            this._pages[mid].push(data);
            this._pageIndexes[mid] = this._pages[mid].length - 1;
        }
        replacePage(mid, data) {
            if (!this._pages[mid] || !this._pages[mid].length) { this.addPage(mid,data); return; }
            this._pages[mid][this._pageIndexes[mid]||0] = data;
        }
        deletePage(mid) {
            const p = this._pages[mid]; if (!p || !p.length) return;
            const idx = this._pageIndexes[mid]||0;
            p.splice(idx, 1);
            this._pageIndexes[mid] = p.length === 0 ? 0 : Math.max(0, Math.min(idx, p.length-1));
        }
        setData(mid, data) {
            if (data===null) { this._pages[mid]=[]; this._pageIndexes[mid]=0; }
            else { this._pages[mid]=[data]; this._pageIndexes[mid]=0; }
        }
        getPageIndex(mid) { return this._pageIndexes[mid]||0; }
        getPageCount(mid) { return (this._pages[mid]||[]).length; }
        setPageIndex(mid, idx) { this._pageIndexes[mid] = Math.max(0, Math.min(idx, this.getPageCount(mid)-1)); }

        // Subscribe / Purchase
        isSubscribed(mid, pk) { return !!(this._subscribed[mid]?.[pk]); }
        setSubscribed(mid, pk, val) {
            if (!this._subscribed[mid]) this._subscribed[mid] = {};
            this._subscribed[mid][pk] = val;
        }
        isPurchased(postId) { return !!this._purchased[postId]; }
        setPurchased(postId) { this._purchased[postId] = true; }

        // Open comments per page
        isCommentOpen(mid, pk, idx) { return !!(this._openComments[mid]?.[pk]?.has(idx)); }
        setCommentOpen(mid, pk, idx, val) {
            if (!this._openComments[mid]) this._openComments[mid] = {};
            if (!this._openComments[mid][pk]) this._openComments[mid][pk] = new Set();
            val ? this._openComments[mid][pk].add(idx) : this._openComments[mid][pk].delete(idx);
        }
        getOpenCommentIndexes(mid, pk) { return this._openComments[mid]?.[pk] || new Set(); }

        // Instruction persistence per mesId
        getInstruction(mid) { return this._instructions[mid] || ''; }
        setInstruction(mid, text) { this._instructions[mid] = text || ''; }

        // Memory (only one message at a time) — persisted
        isMemoryEnabled(mid) { return this._memoryActive === String(mid); }
        setMemoryEnabled(mid, val) {
            if (val) this._memoryActive = String(mid);
            else if (this._memoryActive === String(mid)) this._memoryActive = null;
            this.savePersistent();
        }

        // Saved profiles (persistent, per character)
        getCurrentCharId() {
            try {
                const ctx = SillyTavern.getContext();
                return String(ctx.characterId ?? ctx.characters?.[ctx.characterId]?.name ?? 'default');
            } catch(e) { return 'default'; }
        }
        getSavedProfile() {
            return this._savedProfiles[this.getCurrentCharId()] || null;
        }
        saveProfile(profile) {
            this._savedProfiles[this.getCurrentCharId()] = profile;
            this.savePersistent();
        }
        clearSavedProfile() {
            delete this._savedProfiles[this.getCurrentCharId()];
            this.savePersistent();
        }

        // Tips (persistent)
        addTip(tip) {
            // tip: {amount, senderType: 'user'|'anonymous', charName, target: 'profile'|'post', time}
            this._tips.push(tip);
            if (this._tips.length > 50) this._tips = this._tips.slice(-50);
            this.savePersistent();
        }
        getRecentTips(n) { return this._tips.slice(-(n||10)); }
        clearTips() { this._tips = []; this.savePersistent(); }

        // Message fingerprint (for swipe/regenerate detection)
        getMsgFingerprint(mid) { return this._msgFingerprints[mid] || null; }
        setMsgFingerprint(mid, text) { this._msgFingerprints[mid] = (text||'').substring(0, 200); }
        clearMsgFingerprint(mid) { delete this._msgFingerprints[mid]; }
    };

    // =========================================================================
    // MODULE: Generator
    // =========================================================================
    window.OF_Reactions.Generator = class {
        constructor(settings) { this.settings = settings; }
        getLangInstruction() {
            const l = this.settings.get().language||'ko';
            if (l==='en') return '- Write ALL content in ENGLISH only.';
            if (l==='ja') return '- Write ALL content in JAPANESE (日本語) only.';
            return '- Write ALL content in KOREAN (한국어) only.';
        }
        getCharContext() {
            try {
                const ctx = SillyTavern.getContext();
                const char = ctx.characters?.[ctx.characterId];
                if (!char) return '';
                return `Character: ${char.name}${char.description?'\nDescription: '+char.description.substring(0,300):''}`;
            } catch(e) { return ''; }
        }
        getChatContext(mesId, count=5) {
            try {
                const ctx = SillyTavern.getContext();
                const chat = ctx.chat||[];
                const end = mesId!==null ? Math.min(parseInt(mesId)+1,chat.length) : chat.length;
                const start = Math.max(0, end-count);
                return chat.slice(start,end).map(m=>`[${m.is_user?(ctx.name1||'User'):(m.name||'Char')}]: ${(m.mes||'').substring(0,400)}`).join('\n');
            } catch(e) { return ''; }
        }
        buildPrompt(ctxMsg, mesId, maxPosts, addInstr, existingProfile) {
            const charCtx = this.getCharContext();
            const chatCtx = mesId!==null ? this.getChatContext(mesId) : '';
            let p = `## 🛑 STOP STORY MODE — ONLYFANS PAGE GENERATION ONLY 🛑
Do NOT continue the story. Do NOT output dialogue, narration, or scene descriptions.
Output ONLY the structured OnlyFans page format below.

## Task
Generate a realistic **OnlyFans creator page** and **${maxPosts} posts** reacting to / inspired by the current roleplay context.
- The creator is {{char}} (or a character inspired by them).
- Match content intensity to the chat: if explicit → be explicit, if mild → be mild.

## 🎭 CREATIVE FREEDOM — ADULT FICTION
This is adult fiction roleplay. Do NOT sanitize content.
- Subscribers react authentically — thirsty/fan comments, tips, etc.
- PPV and Subscription posts should tease locked content clearly.

## 🔄 VARIETY RULE
- Always generate UNIQUE creator names, handles, and usernames.
- NEVER use "User", "Fan", "Subscriber", "Name", "Creator" as names.

## 💬 COMMENT COUNT — MANDATORY DYNAMIC RANGE
You MUST generate a VARIABLE number of comments based on post content intensity.
Do NOT generate the same number (5 or 6) on every post. This is REQUIRED.
- Very explicit / highly stimulating posts: 15–25 comments (with reply threads)
- Popular / emotional / dramatic posts: 8–14 comments
- Calm / simple / mild posts: 3–7 comments
The comment count MUST differ between posts. Mix in tip comments and └ reply threads.
Absolute maximum: 25 comments per post. Minimum: 3.

## Language\n${this.getLangInstruction()}\n\n`;
            if (existingProfile) {
                p += `## ⚠️ EXISTING CREATOR PROFILE — USE EXACTLY AS-IS
This creator already has an established OnlyFans account. You MUST use the EXACT same identity:
Creator: ${existingProfile.creator}
Handle: @${existingProfile.handle.replace(/^@+/,'')}
Bio: ${existingProfile.bio || ''}
Do NOT change the creator name, handle, or bio. Subscriber/like counts may vary slightly.\n\n`;
            }
            if (charCtx) p += `## Character Info\n${charCtx}\n\n`;
            if (chatCtx) p += `## Recent Chat Context\n${chatCtx}\n\n`;
            if (ctxMsg) p += `## Message to React To\n"${ctxMsg}"\n\n`;
            if (addInstr && addInstr.trim()) p += `## Additional Instructions\n${addInstr.trim()}\n\n`;
            p += `---
## Output Format (STRICT — output NOTHING outside these tags)

[OF_PROFILE]
Creator: [Display name]
Handle: @[handle]
Subscribers: [e.g. 12.4K]
Likes: [e.g. 245K]
Posts: [e.g. 312]
Price: [e.g. 9.99]
Bio: [1-2 sentence bio]
[/OF_PROFILE]

Then exactly ${maxPosts} posts:

[OF_POST]
Type: Free|Subscription|PPV
Price: [$amount] (PPV only)
Date: [relative time]
Caption: [caption]
Media: [Photo] [detailed description]
Stats: [N]L [N]C [N]T
[OF_COMMENTS]
username: comment [time]
└ username: reply [time]
username [$tip]: tip comment [time]
[/OF_COMMENTS]
[/OF_POST]

Rules: Type = Free|Subscription|PPV. Stats: e.g. "1.2KL 45C 8T". Min 3 comments per post. Output ONLY [OF_PROFILE] and [OF_POST] blocks.`;
            return p;
        }
        async generate(ctxMsg, mesId, addInstr='', postCount, existingProfile) {
            const cfg = this.settings.get();
            const count = postCount || cfg.maxPosts || 3;
            const prompt = this.buildPrompt(ctxMsg, mesId, count, addInstr, existingProfile||null);
            const ctx = SillyTavern.getContext();
            if (!ctx.generateRaw) throw new Error('SillyTavern generateRaw not available');
            return await ctx.generateRaw(prompt, '', false, false);
        }
    };

    // =========================================================================
    // MODULE: Controller
    // =========================================================================
    window.OF_Reactions.Controller = {
        settings: null,
        generator: null,
        generating: new Set(),
        _cancelTokens: new Set(), // mesIds that have been cancelled
        _lastActions: {},         // mesId -> {instruction, mode, postCount, useExistingProfile}

        init(settings) {
            this.settings = settings;
            this.generator = new window.OF_Reactions.Generator(settings);
        },

        redraw(mesId) {
            const container = $(`.mes[mesid="${mesId}"] .of-injection-point`);
            if (!container.length) return;

            // Save in-progress instruction text before DOM replacement
            const existingPopupInstr = document.getElementById(`of-popup-instruction-${mesId}`);
            if (existingPopupInstr && existingPopupInstr.value !== undefined) {
                this.settings.setInstruction(mesId, existingPopupInstr.value);
            }
            const existingStartInstr = container.find('.of-start-instruction')[0];
            if (existingStartInstr && existingStartInstr.value !== undefined) {
                this.settings.setInstruction(mesId, existingStartInstr.value);
            }

            const hasData = this.settings.hasData(mesId);
            const collapsed = this.settings.isCollapsed(mesId);
            const pageIndex = this.settings.getPageIndex(mesId);
            const pageCount = this.settings.getPageCount(mesId);
            const memoryOn = this.settings.isMemoryEnabled(mesId);
            const instruction = this.settings.getInstruction(mesId);
            const savedProfile = this.settings.getSavedProfile();

            let innerHtml = '';
            let data = null;
            let pageKey = `p${pageIndex}`;
            if (hasData) {
                data = this.settings.getData(mesId);
                innerHtml = this.renderData(data, mesId, pageKey);
            }

            const html = window.OF_Reactions.Templates.wrapper(innerHtml, collapsed, mesId, hasData, pageIndex, pageCount, memoryOn, instruction, savedProfile);
            container.html(html);
            this.bindStartConfig(mesId);

            // Restore open comment sections after DOM replacement
            if (data && data.posts) {
                data.posts.forEach((_, i) => {
                    if (this.settings.isCommentOpen(mesId, pageKey, i)) {
                        const el = document.getElementById(`of-post-${mesId}-${pageKey}-${i}-comments`);
                        if (el) el.style.display = 'block';
                    }
                });
            }
        },

        renderData(data, mesId, pageKey) {
            const T = window.OF_Reactions.Templates;
            let html = '';
            if (data.profile) html += T.profileCard(data.profile, mesId, pageKey);
            if (data.posts && data.posts.length > 0) {
                html += '<div class="of-posts-list">';
                data.posts.forEach((post, i) => { html += T.postCard(post, i, mesId, pageKey); });
                html += '</div>';
            }
            return html;
        },

        bindStartConfig(mesId) {
            const container = $(`.mes[mesid="${mesId}"] .of-injection-point`);
            const cfg = container.find(`.of-start-config[data-mesid="${mesId}"]`);
            if (!cfg.length) return;

            cfg.find('.of-start-lang-select').val(this.settings.get().language || 'ko');
            cfg.find('.of-start-lang-select').on('change', function () {
                window.OF_Reactions.Controller.settings.settings.language = $(this).val();
                window.OF_Reactions.Controller.settings.save();
            });
            cfg.find('.of-start-count-input').val(this.settings.get().maxPosts || 3);
            cfg.find('.of-start-count-input').on('change', function () {
                const v = parseInt($(this).val());
                window.OF_Reactions.Controller.settings.settings.maxPosts = v > 0 ? v : 1;
                window.OF_Reactions.Controller.settings.save();
            });
            cfg.find('.of-start-instruction').on('input', function() {
                window.OF_Reactions.Controller.settings.setInstruction(mesId, $(this).val());
            });

            // Clear saved profile button
            cfg.find('.of-clear-saved-profile-btn').on('click', function() {
                if (confirm('저장된 계정을 삭제하고 새 계정을 생성하시겠습니까?')) {
                    window.OF_Reactions.Controller.settings.clearSavedProfile();
                    window.OF_Reactions.Controller.redraw(mesId);
                }
            });

            cfg.find('.of-start-generate-btn').on('click', async function (e) {
                e.stopPropagation();
                const instruction = window.OF_Reactions.Controller.settings.getInstruction(mesId);
                const postCount = parseInt(cfg.find('.of-start-count-input').val()) || window.OF_Reactions.Controller.settings.get().maxPosts || 3;
                const profileMode = cfg.find('input[name="of-profile-mode-' + mesId + '"]:checked').val() || 'existing';
                const useExisting = profileMode === 'existing';
                await window.OF_Reactions.Controller.generateAction(mesId, instruction, 'add', postCount, useExisting);
            });
        },

        async generateAction(mesId, addInstr='', mode='add', postCount, useExistingProfile) {
            if (this.generating.has(mesId)) return;
            this.generating.add(mesId);
            this._cancelTokens.delete(mesId);

            // Store params for retry
            this._lastActions[mesId] = { instruction: addInstr, mode, postCount, useExistingProfile };

            const container = $(`.mes[mesid="${mesId}"] .of-injection-point`);
            const body = container.find('.of-body-inner');
            body.html(window.OF_Reactions.Templates.loading(mesId));

            try {
                const mesText = $(`.mes[mesid="${mesId}"] .mes_text`).text().trim();
                const existingProfile = useExistingProfile !== false ? this.settings.getSavedProfile() : null;
                const rawResponse = await this.generator.generate(mesText, mesId, addInstr, postCount, existingProfile);

                // Cancelled — discard result
                if (this._cancelTokens.has(mesId)) { this._cancelTokens.delete(mesId); return; }

                const parsed = window.OF_Reactions.Parser.parse(rawResponse);
                if (!parsed || (!parsed.profile && parsed.posts.length === 0)) {
                    throw new Error('AI가 유효한 OnlyFans 형식을 반환하지 않았습니다. 다시 시도해주세요.');
                }

                // Save profile for consistency
                if (parsed.profile) {
                    this.settings.saveProfile(parsed.profile);
                }

                // Store message fingerprint so swipe/regenerate can be detected
                this.settings.setMsgFingerprint(mesId, mesText);

                if (mode === 'reroll') this.settings.replacePage(mesId, parsed);
                else this.settings.addPage(mesId, parsed);

                this.settings.setCollapsed(mesId, false);
                this.redraw(mesId);
                this.updateMemory(mesId);

            } catch (err) {
                if (!this._cancelTokens.has(mesId)) {
                    const isCensored = /candidate text empty|safety|blocked|filtered|harm/i.test(err.message || '');
                    body.html(window.OF_Reactions.Templates.error(err.message || '생성 실패', mesId, isCensored));
                }
                console.error('[OF_Reactions] Generation error:', err);
            } finally {
                this._cancelTokens.delete(mesId);
                this.generating.delete(mesId);
            }
        },

        updateMemory(mesId) {
            try {
                const ctx = SillyTavern.getContext();
                if (!ctx.setExtensionPrompt) {
                    console.warn('[OF_Reactions] setExtensionPrompt is not available in this ST version');
                    return;
                }
                if (!this.settings.isMemoryEnabled(mesId)) {
                    ctx.setExtensionPrompt('of_reactions_memory', '', 0, 0);
                    return;
                }
                const data = this.settings.getData(mesId);
                if (!data) {
                    ctx.setExtensionPrompt('of_reactions_memory', '', 0, 0);
                    return;
                }
                const recentTips = this.settings.getRecentTips(10);
                const summary = this._buildMemorySummary(data, recentTips);
                // Position 0 = BEFORE main prompt — most universally supported, model always sees it
                ctx.setExtensionPrompt('of_reactions_memory', summary, 0, 0);
                console.log('[OF_Reactions] Memory injected (' + summary.length + ' chars) for mesId=' + mesId);
            } catch(e) { console.warn('[OF_Reactions] setExtensionPrompt error:', e); }
        },

        // Call this to re-apply memory when chat loads or changes
        restoreMemoryIfActive() {
            const mid = this.settings._memoryActive;
            if (!mid) return;
            this.updateMemory(mid);
        },

        _buildMemorySummary(data, tips) {
            const p = data.profile;
            let text = '=== [OnlyFans 반응 — AI 메모리: 아래 내용을 자연스럽게 인지하고 대화에 반영하세요] ===\n';
            if (p) {
                text += `크리에이터: ${p.creator} (@${p.handle}) — 팬 ${p.subscribers}명, 좋아요 ${p.likes}\n`;
                if (p.bio) text += `소개: ${p.bio}\n`;
            }
            if (data.posts) {
                data.posts.forEach((post, i) => {
                    const typeLabel = post.type==='PPV'?'유료(PPV)':post.type==='Subscription'?'구독 전용':'무료';
                    const cap = (post.caption||'').substring(0, 120);
                    text += `포스트 ${i+1} [${typeLabel}]: ${cap || '(캡션 없음)'} / 좋아요 ${post.stats?.likes||0}개\n`;
                    if (post.comments && post.comments.length > 0) {
                        const topComments = post.comments.slice(0, 3).map(c=>`"${c.content?.substring(0,60)||''}"`).join(', ');
                        text += `  → 대표 댓글: ${topComments}\n`;
                    }
                });
            }
            // Include tip information
            if (tips && tips.length > 0) {
                text += `\n[후원 내역]\n`;
                tips.forEach(t => {
                    if (t.senderType === 'user') {
                        try {
                            const ctx = SillyTavern.getContext();
                            const userName = ctx.name1 || '{{user}}';
                            text += `- ${userName}가 ${t.charName || '크리에이터'}에게 $${t.amount} 후원 (${t.time||''}) — {{char}}은 이 후원자를 알고 있으며 특별히 감사해야 합니다.\n`;
                        } catch(e) {
                            text += `- {{user}}가 $${t.amount} 후원 (${t.time||''})\n`;
                        }
                    } else {
                        text += `- 익명/제3자로부터 $${t.amount} 후원 (${t.time||''}) — 이 후원에 대해 "이렇게나 후원이 많이 들어온다"는 식으로 자랑스럽게 반응하세요.\n`;
                    }
                });
            }
            text += `\n(위 OnlyFans 페이지 내용과 후원 내역을 {{char}}가 인지하고 있으며, 대화에서 자연스럽게 언급/반응하세요.)`;
            return text;
        }
    };

    // =========================================================================
    // MODULE: Actions
    // =========================================================================
    window.OF_Reactions.Actions = {

        toggleWrapper(mesId) {
            const s = window.OF_Reactions.Controller.settings;
            const cur = s.isCollapsed(mesId);
            s.setCollapsed(mesId, !cur);
            const wrapper = $(`.of-reaction-wrapper[data-mesid="${mesId}"]`);
            wrapper.find('.of-body').toggleClass('collapsed', !cur);
            wrapper.find('.of-chevron').toggleClass('of-chevron-collapsed', !cur);
            wrapper.toggleClass('collapsed', !cur);
        },

        toggleComments(postId, mesId, pageKey, index) {
            const el = document.getElementById(`${postId}-comments`);
            if (!el) return;
            const nowVisible = el.style.display !== 'none';
            el.style.display = nowVisible ? 'none' : 'block';
            window.OF_Reactions.Controller.settings.setCommentOpen(mesId, pageKey, index, !nowVisible);
        },

        swipePage(mesId, direction) {
            const s = window.OF_Reactions.Controller.settings;
            s.setPageIndex(mesId, s.getPageIndex(mesId) + direction);
            window.OF_Reactions.Controller.redraw(mesId);
            window.OF_Reactions.Controller.updateMemory(mesId);
        },

        deletePage(mesId) {
            const s = window.OF_Reactions.Controller.settings;
            if (s.getPageCount(mesId) === 0) return;
            if (!confirm('현재 페이지를 삭제하시겠습니까?')) return;
            s.deletePage(mesId);
            window.OF_Reactions.Controller.redraw(mesId);
        },

        cancelGeneration(mesId) {
            const ctrl = window.OF_Reactions.Controller;
            ctrl._cancelTokens.add(mesId);
            ctrl.generating.delete(mesId);
            try { SillyTavern.getContext().stopGeneration?.(); } catch(e) {}
            ctrl.redraw(mesId);
        },

        retryGeneration(mesId) {
            const ctrl = window.OF_Reactions.Controller;
            const last = ctrl._lastActions[mesId];
            if (!last) {
                // Fallback: retry with defaults
                ctrl.generateAction(mesId, '', 'add', ctrl.settings.get().maxPosts || 3, true);
                return;
            }
            ctrl.generateAction(mesId, last.instruction || '', last.mode || 'add', last.postCount, last.useExistingProfile !== false);
        },

        // --- Popup (reroll / add page) ---

        promptAction(mesId, mode, e) {
            if (e) e.stopPropagation();
            $('.of-action-popup').hide();
            const popup = document.getElementById(`of-popup-${mesId}`);
            const label = document.getElementById(`of-popup-label-${mesId}`);
            const confirmBtn = document.getElementById(`of-popup-confirm-${mesId}`);
            const inp = document.getElementById(`of-popup-instruction-${mesId}`);
            const countInp = document.getElementById(`of-popup-count-${mesId}`);
            const profileRow = document.getElementById(`of-popup-profile-row-${mesId}`);
            if (!popup) return;
            if (label) label.textContent = mode === 'reroll' ? '리롤 — 요청사항 (선택)' : '새 페이지 추가 — 요청사항 (선택)';
            // Populate with stored instruction (persisted)
            if (inp) inp.value = window.OF_Reactions.Controller.settings.getInstruction(mesId);
            // Set count to current maxPosts
            if (countInp) countInp.value = window.OF_Reactions.Controller.settings.get().maxPosts || 3;
            // Inject profile chooser if saved profile exists
            if (profileRow) {
                const sp = window.OF_Reactions.Controller.settings.getSavedProfile();
                const U = window.OF_Reactions.Utils;
                if (sp) {
                    profileRow.innerHTML = `
<div class="of-popup-profile-chooser">
    <div class="of-saved-profile-info"><i class="fa-solid fa-user-check"></i> 저장된 계정: <strong>${U.escapeHtml(sp.creator)}</strong> (@${U.escapeHtml(sp.handle||'')})</div>
    <div class="of-profile-mode-radios">
        <label><input type="radio" name="of-popup-profile-mode-${mesId}" value="existing" checked> 이전 계정 유지</label>
        <label><input type="radio" name="of-popup-profile-mode-${mesId}" value="new"> 새 계정 생성</label>
    </div>
</div>`;
                } else {
                    profileRow.innerHTML = '';
                }
            }
            if (confirmBtn) {
                const newBtn = confirmBtn.cloneNode(true);
                confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
                newBtn.addEventListener('click', () => {
                    const instrEl = document.getElementById(`of-popup-instruction-${mesId}`);
                    const cntEl = document.getElementById(`of-popup-count-${mesId}`);
                    const profileRadio = document.querySelector(`input[name="of-popup-profile-mode-${mesId}"]:checked`);
                    const instruction = instrEl ? instrEl.value : '';
                    const postCount = cntEl ? (parseInt(cntEl.value) || window.OF_Reactions.Controller.settings.get().maxPosts || 3) : undefined;
                    const useExisting = profileRadio ? profileRadio.value === 'existing' : true;
                    window.OF_Reactions.Controller.settings.setInstruction(mesId, instruction);
                    this.closePopup(mesId);
                    window.OF_Reactions.Controller.generateAction(mesId, instruction, mode, postCount, useExisting);
                });
            }
            popup.style.display = 'block';
        },

        closePopup(mesId) {
            // Save textarea value before hiding (persist instruction)
            const inp = document.getElementById(`of-popup-instruction-${mesId}`);
            if (inp) window.OF_Reactions.Controller.settings.setInstruction(mesId, inp.value);
            const popup = document.getElementById(`of-popup-${mesId}`);
            if (popup) popup.style.display = 'none';
        },

        clearInstruction(mesId, isStartConfig) {
            window.OF_Reactions.Controller.settings.setInstruction(mesId, '');
            if (isStartConfig) {
                const container = $(`.mes[mesid="${mesId}"] .of-injection-point`);
                container.find('.of-start-instruction').val('');
            } else {
                const inp = document.getElementById(`of-popup-instruction-${mesId}`);
                if (inp) inp.value = '';
            }
        },

        // --- Subscribe ---

        isSubscribed(mesId, pageKey) { return window.OF_Reactions.Controller.settings.isSubscribed(mesId, pageKey); },

        subscribe(mesId, pageKey, btnEl, price) {
            const s = window.OF_Reactions.Controller.settings;
            s.setSubscribed(mesId, pageKey, true);
            if (btnEl) {
                btnEl.innerHTML = '<i class="fa-solid fa-check"></i> Subscribed';
                btnEl.classList.add('of-subscribed');
                btnEl.onclick = () => this.unsubscribe(mesId, pageKey, btnEl, price);
            }
            this._toast(mesId, `💳 $${price}/월 구독 완료! 구독 전용 콘텐츠가 잠금 해제되었습니다.`, 'success');
            setTimeout(() => window.OF_Reactions.Controller.redraw(mesId), 900);
        },

        unsubscribe(mesId, pageKey, btnEl, price) {
            window.OF_Reactions.Controller.settings.setSubscribed(mesId, pageKey, false);
            if (btnEl) {
                btnEl.innerHTML = `<i class="fa-solid fa-lock-open"></i> Subscribe $${price}/mo`;
                btnEl.classList.remove('of-subscribed');
                btnEl.onclick = () => this.subscribe(mesId, pageKey, btnEl, price);
            }
            setTimeout(() => window.OF_Reactions.Controller.redraw(mesId), 400);
        },

        subscribeFromPost(mesId, pageKey) {
            const data = window.OF_Reactions.Controller.settings.getData(mesId);
            const price = data?.profile?.price || '9.99';
            window.OF_Reactions.Controller.settings.setSubscribed(mesId, pageKey, true);
            this._toast(mesId, `💳 $${price}/월 구독 완료! 구독 전용 콘텐츠가 잠금 해제되었습니다.`, 'success');
            setTimeout(() => window.OF_Reactions.Controller.redraw(mesId), 900);
        },

        // --- PPV ---

        isPurchased(postId) { return window.OF_Reactions.Controller.settings.isPurchased(postId); },

        purchasePPV(postId, price, mesId, pageKey) {
            const priceClean = String(price).replace(/[^0-9.]/g, '');
            if (!confirm(`이 콘텐츠를 $${priceClean}에 구매하시겠습니까?`)) return;
            window.OF_Reactions.Controller.settings.setPurchased(postId);
            this._toast(mesId, `💳 $${priceClean} 결제 완료! PPV 콘텐츠가 잠금 해제되었습니다.`, 'ppv');
            setTimeout(() => window.OF_Reactions.Controller.redraw(mesId), 900);
        },

        // --- Tip ---

        openProfileTip(mesId, pageKey, creatorName) {
            window.OF_Reactions.TipModal.show(
                `${creatorName}에게 후원`,
                (amount, senderType) => {
                    const s = window.OF_Reactions.Controller.settings;
                    s.addTip({ amount, senderType: senderType||'user', charName: creatorName, target: 'profile', time: new Date().toLocaleTimeString() });
                    window.OF_Reactions.Controller.updateMemory(mesId);
                    const senderLabel = (senderType === 'anonymous') ? '익명 후원자가' : '{{user}}가';
                    this._toast(mesId, `💰 ${senderLabel} ${creatorName}에게 $${amount} 후원 완료! ❤️`, 'tip');
                }
            );
        },

        openPostTip(postId, mesId) {
            window.OF_Reactions.TipModal.show(
                '이 포스트에 후원',
                (amount, senderType) => {
                    // Update tip count display
                    const btn = document.querySelector(`#${postId} .of-tip-post-btn span`);
                    if (btn) {
                        const cur = parseInt(btn.textContent.replace(/[^0-9]/g,'')) || 0;
                        btn.textContent = cur + 1;
                    }
                    const s = window.OF_Reactions.Controller.settings;
                    s.addTip({ amount, senderType: senderType||'user', target: 'post', time: new Date().toLocaleTimeString() });
                    window.OF_Reactions.Controller.updateMemory(mesId);
                    const senderLabel = (senderType === 'anonymous') ? '익명 후원자가' : '{{user}}가';
                    this._toast(mesId, `💰 ${senderLabel} $${amount} 후원 완료! 크리에이터에게 전달됩니다 ❤️`, 'tip');
                }
            );
        },

        // --- Memory ---

        toggleMemory(mesId) {
            const s = window.OF_Reactions.Controller.settings;
            const newState = !s.isMemoryEnabled(mesId);
            s.setMemoryEnabled(mesId, newState);
            window.OF_Reactions.Controller.updateMemory(mesId);
            window.OF_Reactions.Controller.redraw(mesId);
            this._toast(mesId,
                newState ? '🧠 채팅 메모리 ON — AI가 OnlyFans 반응을 기억합니다.' : '🧠 채팅 메모리 OFF — AI가 OnlyFans 반응을 잊습니다.',
                newState ? 'success' : 'neutral'
            );
        },

        // --- Toast ---

        _toast(mesId, msg, type) {
            const container = $(`.mes[mesid="${mesId}"] .of-injection-point`);
            container.find('.of-toast').remove();
            const toast = $(`<div class="of-toast of-toast-${type}">${msg}</div>`);
            container.prepend(toast);
            setTimeout(() => toast.addClass('of-toast-visible'), 30);
            setTimeout(() => { toast.removeClass('of-toast-visible'); setTimeout(() => toast.remove(), 400); }, 3200);
        }
    };

    // =========================================================================
    // INIT
    // =========================================================================
    jQuery(async function ($) {
        const settings = new window.OF_Reactions.Settings();
        settings.load();
        window.OF_Reactions.Controller.init(settings);
        window.OF_Reactions.TipModal.init();

        // Apply initial enabled state
        if (!settings.get().enabled) $('body').addClass('of-disabled');

        // Inject ST extensions settings panel
        function injectSettingsPanel() {
            if ($('#of_reactions_ext_panel').length) return;
            const s = settings.get();
            const html = `
<div class="inline-drawer" id="of_reactions_ext_panel">
    <div class="inline-drawer-toggle inline-drawer-header">
        <b>OnlyFans Reactions</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
        <div class="of-settings-panel">
            <div class="of-settings-row">
                <label class="of-settings-label"><i class="fa-solid fa-power-off"></i> 확장 활성화</label>
                <label class="of-toggle-switch">
                    <input type="checkbox" id="of_enabled_toggle" ${s.enabled ? 'checked' : ''}>
                    <span class="of-toggle-slider"></span>
                </label>
            </div>
            <div class="of-settings-row">
                <label class="of-settings-label"><i class="fa-solid fa-language"></i> 기본 언어</label>
                <select id="of_default_lang" class="of-settings-select">
                    <option value="ko" ${s.language==='ko'?'selected':''}>한국어</option>
                    <option value="en" ${s.language==='en'?'selected':''}>English</option>
                    <option value="ja" ${s.language==='ja'?'selected':''}>日本語</option>
                </select>
            </div>
            <div class="of-settings-row">
                <label class="of-settings-label"><i class="fa-solid fa-layer-group"></i> 기본 포스트 수</label>
                <input type="number" id="of_default_posts" min="1" value="${s.maxPosts}" class="of-settings-input">
            </div>
            <div class="of-settings-hint">비활성화 시 새로고침 없이 즉시 숨겨집니다. 다시 켜면 즉시 복원됩니다.</div>
        </div>
    </div>
</div>`;
            const target = $('#extensions_settings').length ? $('#extensions_settings') : $($('#extensions_settings2').length ? '#extensions_settings2' : 'body');
            target.append(html);

            $('#of_enabled_toggle').on('change', function () {
                settings.settings.enabled = this.checked;
                settings.save();
                if (this.checked) {
                    $('body').removeClass('of-disabled');
                    processAllMessages();
                } else {
                    $('body').addClass('of-disabled');
                }
            });
            $('#of_default_lang').on('change', function () {
                settings.settings.language = this.value; settings.save();
            });
            $('#of_default_posts').on('change', function () {
                const v = parseInt(this.value);
                settings.settings.maxPosts = v > 0 ? v : 1; settings.save();
            });
        }

        // Close popup when clicking outside
        $(document).on('click', function (e) {
            if (!$(e.target).closest('.of-action-popup, .of-addpage-btn, .of-reroll-btn').length) {
                // Save current instruction before hiding
                $('.of-action-popup:visible').each(function() {
                    const mesId = $(this).attr('id')?.replace('of-popup-','');
                    if (mesId) window.OF_Reactions.Actions.closePopup(mesId);
                    else $(this).hide();
                });
            }
        });

        const context = SillyTavern.getContext();

        function getMesText(mesId) {
            return $(`.mes[mesid="${mesId}"] .mes_text`).text().trim();
        }

        // Debounce helper for auto-regeneration
        const _regenTimers = {};
        function scheduleRegen(mesId, delay) {
            clearTimeout(_regenTimers[mesId]);
            _regenTimers[mesId] = setTimeout(() => {
                const s = window.OF_Reactions.Controller.settings;
                const instruction = s.getInstruction(String(mesId));
                const postCount = s.get().maxPosts || 3;
                // Clear old data before regenerating
                s.setData(String(mesId), null);
                s.clearMsgFingerprint(String(mesId));
                window.OF_Reactions.Controller.generateAction(String(mesId), instruction, 'add', postCount, true);
            }, delay || 400);
        }

        function injectUI(messageElement) {
            const mesId = $(messageElement).attr('mesid');
            if (!mesId) return;

            let container = $(messageElement).find('.of-injection-point');
            if (!container.length) {
                container = $('<div class="of-injection-point"></div>');
                $(messageElement).find('.mes_text').after(container);
            }

            // Swipe/regenerate detection: check if message text changed since last generation
            const s = window.OF_Reactions.Controller.settings;
            if (s.hasData(mesId)) {
                const storedFp = s.getMsgFingerprint(mesId);
                if (storedFp !== null) {
                    const currentText = getMesText(mesId);
                    if (currentText && currentText.substring(0, 200) !== storedFp) {
                        // Message content changed — auto-regenerate extension
                        s.setData(mesId, null);
                        s.clearMsgFingerprint(mesId);
                        scheduleRegen(mesId, 500);
                        return;
                    }
                }
            }

            window.OF_Reactions.Controller.redraw(mesId);
        }

        function processAllMessages() {
            if (!settings.get().enabled) return;
            $('.mes').each(function () { injectUI(this); });
        }

        // Restore memory on every relevant event
        function restoreMemory() {
            window.OF_Reactions.Controller.restoreMemoryIfActive();
        }

        context.eventSource.on(context.event_types.MESSAGE_RECEIVED, () => {
            setTimeout(processAllMessages, 150);
            setTimeout(restoreMemory, 200);
        });
        context.eventSource.on(context.event_types.CHARACTER_MESSAGE_RENDERED, () => {
            setTimeout(processAllMessages, 150);
            setTimeout(restoreMemory, 200);
        });
        context.eventSource.on(context.event_types.CHAT_CHANGED, () => {
            setTimeout(processAllMessages, 600);
            setTimeout(restoreMemory, 700);
        });

        // MESSAGE_SWIPED: when user swipes an existing chat message alternative
        if (context.event_types.MESSAGE_SWIPED) {
            context.eventSource.on(context.event_types.MESSAGE_SWIPED, (mesId) => {
                if (!settings.get().enabled) return;
                const idStr = String(mesId);
                const s = window.OF_Reactions.Controller.settings;
                if (s.hasData(idStr)) {
                    // Had extension data — regenerate for new swipe content
                    scheduleRegen(idStr, 600);
                } else {
                    // No data — just re-render (shows start config)
                    setTimeout(() => {
                        injectUI($(`.mes[mesid="${idStr}"]`)[0]);
                    }, 400);
                }
            });
        }

        injectSettingsPanel();
        setTimeout(processAllMessages, 1200);

        // Retry settings panel injection after ST finishes rendering
        setTimeout(injectSettingsPanel, 2500);
    });

})();
