// This script will be injected into the AWS console page to auto-fill credentials
;(() => {
  console.log("🔐 AWS Console Auto-Fill Script Loaded")

  // Get credentials from URL parameters (passed by the extension)
  const urlParams = new URLSearchParams(window.location.search)
  const username = urlParams.get("ext_username")
  const password = urlParams.get("ext_password")

  if (!username || !password) {
    console.log("❌ No credentials found in URL parameters")
    return
  }

  // Remove credentials from URL for security
  const cleanUrl = window.location.origin + window.location.pathname
  window.history.replaceState({}, document.title, cleanUrl)

  function fillCredentials() {
    // Common selectors for AWS login form
    const usernameSelectors = [
      'input[name="username"]',
      'input[id="username"]',
      'input[type="text"]',
      'input[placeholder*="username" i]',
      'input[placeholder*="user" i]',
      "#resolving_input",
      'input[data-testid="username"]',
    ]

    const passwordSelectors = [
      'input[name="password"]',
      'input[id="password"]',
      'input[type="password"]',
      'input[placeholder*="password" i]',
      'input[data-testid="password"]',
    ]

    let usernameField = null
    let passwordField = null

    // Find username field
    for (const selector of usernameSelectors) {
      usernameField = document.querySelector(selector)
      if (usernameField && usernameField.offsetParent !== null) {
        break
      }
    }

    // Find password field
    for (const selector of passwordSelectors) {
      passwordField = document.querySelector(selector)
      if (passwordField && passwordField.offsetParent !== null) {
        break
      }
    }

    if (usernameField) {
      console.log("✅ Username field found, filling...")
      usernameField.value = username
      usernameField.dispatchEvent(new Event("input", { bubbles: true }))
      usernameField.dispatchEvent(new Event("change", { bubbles: true }))

      // Add visual indication
      usernameField.style.backgroundColor = "#e8f5e8"
      setTimeout(() => {
        usernameField.style.backgroundColor = ""
      }, 2000)
    }

    if (passwordField) {
      console.log("✅ Password field found, filling...")
      passwordField.value = password
      passwordField.dispatchEvent(new Event("input", { bubbles: true }))
      passwordField.dispatchEvent(new Event("change", { bubbles: true }))

      // Add visual indication
      passwordField.style.backgroundColor = "#e8f5e8"
      setTimeout(() => {
        passwordField.style.backgroundColor = ""
      }, 2000)
    }

    // Show success notification
    if (usernameField || passwordField) {
      showNotification("🎉 Credentials auto-filled by AWS Credential Manager!")
    }

    return usernameField && passwordField
  }

  function showNotification(message) {
    const notification = document.createElement("div")
    notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-family: 'Segoe UI', sans-serif;
                font-size: 14px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
                animation: slideInRight 0.3s ease;
                max-width: 300px;
            ">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 6L9 17l-5-5"/>
                </svg>
                ${message}
            </div>
        `

    // Add animation styles
    const style = document.createElement("style")
    style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `
    document.head.appendChild(style)

    document.body.appendChild(notification)

    // Remove notification after 5 seconds
    setTimeout(() => {
      notification.remove()
      style.remove()
    }, 5000)
  }

  // Try to fill credentials immediately
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fillCredentials)
  } else {
    fillCredentials()
  }

  // Also try after a short delay in case the form loads dynamically
  setTimeout(fillCredentials, 1000)
  setTimeout(fillCredentials, 3000)

  // Watch for dynamic form loading
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const hasLoginForm =
              node.querySelector &&
              (node.querySelector('input[type="password"]') ||
                node.querySelector('input[name="username"]') ||
                node.querySelector('input[name="password"]'))

            if (hasLoginForm) {
              console.log("🔄 Login form detected, attempting to fill...")
              setTimeout(fillCredentials, 500)
            }
          }
        })
      }
    })
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  // Stop observing after 30 seconds to prevent memory leaks
  setTimeout(() => {
    observer.disconnect()
  }, 30000)
})()
