let running = false
let cleaned = 0
let idleCount = 0
let abortFlag = false

function isDesktop() {
  return !!document.querySelector('[aria-label="Action options"]')
}

function isOnActivityLog() {
  return location.pathname.includes('allactivity') ||
         location.pathname.includes('/me/') ||
         document.querySelector('[aria-label="Action options"]')
}

function findMenus() {
  if (isDesktop()) {
    let items = document.querySelectorAll('[aria-label="Action options"]')
    return Array.from(items).filter(el => {
      let r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 20
    })
  }
  let selectors = [
    'div[aria-label="Action options"]',
    'a[role="button"] i',
    'div[data-sigil*="touchable"]',
    'i[class*="sp_"]',
    'div[data-sigil*="flyout"]',
    '[aria-label="Action options"]'
  ]
  for (let sel of selectors) {
    let items = document.querySelectorAll(sel)
    let visible = Array.from(items).filter(el => {
      let r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 20
    })
    if (visible.length) return visible
  }
  return []
}

function findDirectUnlike() {
  return Array.from(document.querySelectorAll('span, div, a, button')).find(el => {
    let t = el.textContent.trim().toLowerCase()
    return t === 'unlike' || t === 'remove reaction'
  })
}

function findUnlikeInPage() {
  return Array.from(document.querySelectorAll('span, div, a, [role="menuitem"], button')).find(el => {
    let t = el.textContent.trim().toLowerCase()
    return t === 'unlike' || t === 'remove reaction' ||
           (t.includes('unlike') && !t.includes('unliked'))
  })
}

async function processPage() {
  let direct = findDirectUnlike()
  if (direct) {
    direct.click()
    cleaned++
    return true
  }

  let menus = findMenus()
  if (!menus.length) return false

  menus[0].click()
  await sleep(2000)

  let target = findUnlikeInPage()
  if (target) {
    target.click()
    cleaned++
    return true
  }

  document.body.click()
  await sleep(500)
  return false
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function startCleaning() {
  running = true
  abortFlag = false
  cleaned = 0
  idleCount = 0

  while (running && !abortFlag) {
    let processed = await processPage()
    if (processed) {
      idleCount = 0
      await sleep(2000)
    } else {
      idleCount++
      if (idleCount > 20) {
        running = false
        chrome.runtime.sendMessage({
          type: 'done',
          count: cleaned,
          reason: 'No more items found'
        })
        break
      }
      scrollBy(0, innerHeight)
      await sleep(3000)
    }

    chrome.runtime.sendMessage({
      type: 'progress',
      count: cleaned
    })
  }

  if (abortFlag || !running) {
    chrome.runtime.sendMessage({
      type: 'stopped',
      count: cleaned
    })
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'start') {
    if (!isOnActivityLog()) {
      sendResponse({ ok: false, error: 'Go to Facebook Activity Log first' })
      return
    }
    if (running) {
      sendResponse({ ok: false, error: 'Already running' })
      return
    }
    startCleaning()
    sendResponse({ ok: true })
  } else if (msg.type === 'stop') {
    abortFlag = true
    running = false
    sendResponse({ ok: true })
  } else if (msg.type === 'status') {
    sendResponse({
      running,
      cleaned,
      onPage: isOnActivityLog(),
      desktop: isDesktop()
    })
  }
})

// Send status on connect
chrome.runtime.sendMessage({
  type: 'ready',
  onPage: isOnActivityLog(),
  desktop: isDesktop()
})
