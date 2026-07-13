const statusText = document.getElementById('statusText')
const countDisplay = document.getElementById('countDisplay')
const actionBtn = document.getElementById('actionBtn')
const infoText = document.getElementById('infoText')
const urlText = document.getElementById('urlText')
const pageStatus = document.getElementById('pageStatus')

let currentTab = null
let state = { running: false, cleaned: 0, connected: false }

async function getCurrentTab() {
  let tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    })
    return true
  } catch (e) {
    return false
  }
}

function updateUI() {
  if (state.running) {
    statusText.innerHTML = '<span class="badge ok">Running</span>'
    actionBtn.textContent = '■ Stop'
    actionBtn.className = 'btn-stop'
    infoText.textContent = 'Cleaning in progress...'
  } else {
    statusText.innerHTML = '<span class="badge info">Idle</span>'
    actionBtn.textContent = '▶ Start Cleaning'
    actionBtn.className = 'btn-start'
    infoText.textContent = state.connected
      ? 'Tap Start to remove likes/reactions.'
      : 'Make sure you are on a Facebook page, then tap Refresh.'
  }
  pageStatus.innerHTML = state.connected
    ? '<span class="badge ok">✓ Connected</span>'
    : '<span class="badge warn">Not connected — tap Refresh</span>'
  countDisplay.textContent = state.cleaned
  actionBtn.disabled = false
}

function queryStatus() {
  if (!currentTab) return
  urlText.textContent = currentTab.url || ''
  chrome.tabs.sendMessage(currentTab.id, { type: 'status' })
    .then(res => {
      if (res) {
        state.running = res.running
        state.cleaned = res.cleaned
        state.connected = true
        updateUI()
      }
    })
    .catch(async () => {
      let injected = await injectContentScript(currentTab.id)
      if (injected) {
        setTimeout(() => {
          chrome.tabs.sendMessage(currentTab.id, { type: 'status' })
            .then(res => {
              if (res) {
                state.running = res.running
                state.cleaned = res.cleaned
                state.connected = true
                updateUI()
              }
            })
            .catch(() => {
              state.connected = false
              updateUI()
            })
        }, 500)
      } else {
        state.connected = false
        updateUI()
      }
    })
}

actionBtn.addEventListener('click', () => {
  if (state.running) {
    chrome.tabs.sendMessage(currentTab.id, { type: 'stop' }).catch(() => {})
    state.running = false
    updateUI()
  } else {
    chrome.tabs.sendMessage(currentTab.id, { type: 'start' })
      .then(res => {
        if (res?.ok) {
          state.running = true
          state.connected = true
          updateUI()
        } else {
          infoText.textContent = res?.error || 'Error starting. Try Refresh.'
          updateUI()
        }
      })
      .catch(() => {
        state.connected = false
        infoText.textContent = 'Could not reach the page. Tap Refresh.'
        updateUI()
      })
  }
})

document.getElementById('refreshBtn').addEventListener('click', () => {
  queryStatus()
})

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'progress') {
    state.cleaned = msg.count || 0
    updateUI()
  } else if (msg.type === 'done' || msg.type === 'stopped') {
    state.cleaned = msg.count || 0
    state.running = false
    infoText.textContent = msg.type === 'done'
      ? '✅ Done! Cleaned ' + state.cleaned + ' reactions.'
      : '⏸ Stopped. Cleaned ' + state.cleaned + ' reactions.'
    updateUI()
  }
})

async function init() {
  currentTab = await getCurrentTab()
  urlText.textContent = currentTab?.url || 'No page detected'
  if (currentTab?.url?.includes('facebook.com')) {
    infoText.textContent = 'Connecting...'
    queryStatus()
  } else {
    state.connected = false
    updateUI()
    infoText.textContent = 'Open Facebook first, then open this popup.'
  }
}

init()
