const statusText = document.getElementById('statusText')
const pageText = document.getElementById('pageText')
const modeText = document.getElementById('modeText')
const countDisplay = document.getElementById('countDisplay')
const actionBtn = document.getElementById('actionBtn')
const infoText = document.getElementById('infoText')

let currentTab = null
let state = { running: false, cleaned: 0, onPage: false, desktop: false }

async function getCurrentTab() {
  let tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

function updateUI() {
  if (state.running) {
    statusText.innerHTML = '<span class="badge ok">Running</span>'
    actionBtn.textContent = 'Stop'
    actionBtn.className = 'btn-stop'
    actionBtn.disabled = false
    infoText.textContent = 'Cleaning in progress...'
  } else {
    statusText.innerHTML = '<span class="badge info">Idle</span>'
    actionBtn.textContent = 'Start Cleaning'
    actionBtn.className = 'btn-start'
    actionBtn.disabled = !state.onPage
    infoText.textContent = state.onPage
      ? 'Click Start to remove likes/reactions on this page.'
      : 'Go to Facebook > Activity Log > Likes and Reactions, then open this popup.'
  }

  pageText.innerHTML = state.onPage
    ? '<span class="badge ok">On Activity Log</span>'
    : '<span class="badge warn">Wrong Page</span>'

  modeText.textContent = state.desktop ? 'Desktop' : 'Mobile'
  countDisplay.textContent = state.cleaned
}

function sendToTab(msg) {
  if (!currentTab) return
  chrome.tabs.sendMessage(currentTab.id, msg).catch(() => {})
}

function queryStatus() {
  if (!currentTab) return
  chrome.tabs.sendMessage(currentTab.id, { type: 'status' })
    .then(res => {
      if (res) {
        state.running = res.running
        state.cleaned = res.cleaned
        state.onPage = res.onPage
        state.desktop = res.desktop
        updateUI()
      }
    })
    .catch(() => {
      state.running = false
      state.onPage = false
      updateUI()
    })
}

actionBtn.addEventListener('click', () => {
  if (state.running) {
    sendToTab({ type: 'stop' })
    state.running = false
    updateUI()
  } else {
    sendToTab({ type: 'start' })
    state.running = true
    updateUI()
  }
})

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'progress' || msg.type === 'done' || msg.type === 'stopped') {
    state.cleaned = msg.count || 0
    if (msg.type === 'done' || msg.type === 'stopped') {
      state.running = false
    }
    updateUI()
  }
})

async function init() {
  currentTab = await getCurrentTab()
  if (currentTab?.url?.includes('facebook.com')) {
    queryStatus()
  } else {
    state.onPage = false
    updateUI()
  }
}

init()
