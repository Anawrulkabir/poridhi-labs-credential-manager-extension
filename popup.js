class AWSCredentialManager {
  constructor() {
    this.credentials = {
      consoleLink: "",
      username: "",
      password: "",
      accessKey: "",
      secretKey: "",
      "poridhi-iam": "",
    }

    this.init()
  }

  async init() {
    console.log("🎯 Initializing AWS Credential Manager popup")
    await this.loadCredentials()
    await this.checkForExtractedCredentials()
    this.setupEventListeners()
    this.setupPolicyToggle()
    this.setupMessageListener()
  }

  async checkForExtractedCredentials() {
    try {
      const result = await chrome.storage.local.get(["awsCredentials", "extractedFromPage", "lastExtracted"])

      if (result.extractedFromPage && result.lastExtracted) {
        const timeDiff = Date.now() - result.lastExtracted

        // If credentials were extracted in the last 5 minutes, show them
        if (timeDiff < 5 * 60 * 1000) {
          this.credentials = { ...this.credentials, ...result.awsCredentials }
          this.populateFields()
          this.showToast("🎉 Credentials auto-loaded from Poridhi page!")

          // Mark as processed
          await chrome.storage.local.set({ extractedFromPage: false })
        }
      }
    } catch (error) {
      console.error("Error checking for extracted credentials:", error)
    }
  }

  setupMessageListener() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("📨 Message received in popup:", message)

      if (message.type === "CREDENTIALS_UPDATED") {
        this.credentials = { ...this.credentials, ...message.credentials }
        this.populateFields()
        this.showToast("🎉 Credentials auto-extracted from page!")
        sendResponse({ success: true })
      }

      // Handle legacy message format
      if (message.type === "CREDENTIALS_EXTRACTED") {
        this.credentials = { ...this.credentials, ...message.credentials }
        this.populateFields()
        this.showToast("🎉 Credentials auto-extracted from page!")
        sendResponse({ success: true })
      }

      return true
    })
  }

  async loadCredentials() {
    try {
      const result = await chrome.storage.local.get("awsCredentials")
      if (result.awsCredentials) {
        this.credentials = { ...this.credentials, ...result.awsCredentials }
        this.populateFields()
      }
    } catch (error) {
      console.error("Error loading credentials:", error)
      this.showToast("Error loading saved credentials", "error")
    }
  }

  populateFields() {
    Object.keys(this.credentials).forEach((key) => {
      const input = document.getElementById(key)
      if (input && this.credentials[key]) {
        input.value = this.credentials[key]
      }
    })
  }

  async saveCredentials() {
    try {
      // Get current values from inputs
      Object.keys(this.credentials).forEach((key) => {
        const input = document.getElementById(key)
        if (input) {
          this.credentials[key] = input.value.trim()
        }
      })

      await chrome.storage.local.set({
        awsCredentials: this.credentials,
        lastSaved: Date.now(),
      })
      this.showToast("Credentials saved successfully!")

      // Add visual feedback to save button
      const saveBtn = document.getElementById("saveBtn")
      const originalText = saveBtn.innerHTML
      saveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20,6 9,17 4,12"></polyline>
        </svg>
        Saved!
      `
      saveBtn.style.background = "linear-gradient(135deg, #4caf50 0%, #45a049 100%)"

      setTimeout(() => {
        saveBtn.innerHTML = originalText
        saveBtn.style.background = ""
      }, 2000)
    } catch (error) {
      console.error("Error saving credentials:", error)
      this.showToast("Error saving credentials", "error")
    }
  }

  async clearCredentials() {
    try {
      if (!confirm("Are you sure you want to clear all saved credentials?")) {
        return
      }

      this.credentials = {
        consoleLink: "",
        username: "",
        password: "",
        accessKey: "",
        secretKey: "",
        "poridhi-iam": "",
      }

      // Clear inputs
      Object.keys(this.credentials).forEach((key) => {
        const input = document.getElementById(key)
        if (input) {
          input.value = ""
        }
      })

      await chrome.storage.local.remove(["awsCredentials", "lastExtracted", "extractedFromPage", "lastSaved"])
      this.showToast("All credentials cleared")
    } catch (error) {
      console.error("Error clearing credentials:", error)
      this.showToast("Error clearing credentials", "error")
    }
  }

  async copyToClipboard(fieldId) {
    try {
      const input = document.getElementById(fieldId)
      const value = input.value.trim()

      if (!value) {
        this.showToast("No value to copy", "error")
        return
      }

      await navigator.clipboard.writeText(value)

      // Visual feedback for copy button
      const copyBtn = document.querySelector(`[data-field="${fieldId}"]`)
      const originalHTML = copyBtn.innerHTML
      copyBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20,6 9,17 4,12"></polyline>
        </svg>
      `
      copyBtn.style.color = "#4caf50"

      setTimeout(() => {
        copyBtn.innerHTML = originalHTML
        copyBtn.style.color = ""
      }, 1500)

      this.showToast(`${this.getFieldLabel(fieldId)} copied to clipboard!`)
    } catch (error) {
      console.error("Error copying to clipboard:", error)
      this.showToast("Failed to copy to clipboard", "error")
    }
  }

  getFieldLabel(fieldId) {
    const labels = {
      consoleLink: "Console Link",
      username: "Username",
      password: "Password",
      accessKey: "Access Key",
      secretKey: "Secret Key",
      "poridhi-iam": "Poridhi IAM",
    }
    return labels[fieldId] || fieldId
  }

  togglePasswordVisibility(fieldId) {
    const input = document.getElementById(fieldId)
    const toggleBtn = document.querySelector(`[data-field="${fieldId}"].toggle-visibility`)

    if (input.type === "password") {
      input.type = "text"
      toggleBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `
    } else {
      input.type = "password"
      toggleBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `
    }
  }

  setupEventListeners() {
    // Save button
    document.getElementById("saveBtn").addEventListener("click", () => {
      this.saveCredentials()
    })

    // Clear button
    document.getElementById("clearBtn").addEventListener("click", () => {
      this.clearCredentials()
    })

    // Copy buttons
    document.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const fieldId = e.currentTarget.getAttribute("data-field")
        this.copyToClipboard(fieldId)
      })
    })

    // Redirect buttons
    document.querySelectorAll(".redirect-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const fieldId = e.currentTarget.getAttribute("data-field")
        this.redirectToConsole(fieldId)
      })
    })

    // Toggle visibility buttons
    document.querySelectorAll(".toggle-visibility").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const fieldId = e.currentTarget.getAttribute("data-field")
        this.togglePasswordVisibility(fieldId)
      })
    })

    // Auto-save on input change (debounced)
    let saveTimeout
    document.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", () => {
        clearTimeout(saveTimeout)
        saveTimeout = setTimeout(() => {
          this.saveCredentials()
        }, 1000)
      })
    })

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "s":
            e.preventDefault()
            this.saveCredentials()
            break
          case "k":
            e.preventDefault()
            this.clearCredentials()
            break
        }
      }
    })
  }

  async redirectToConsole(fieldId) {
    try {
      if (fieldId !== "consoleLink") {
        return
      }

      const consoleUrl = document.getElementById("consoleLink").value.trim()
      const username = document.getElementById("username").value.trim()
      const password = document.getElementById("password").value.trim()

      if (!consoleUrl) {
        this.showToast("No console URL to redirect to", "error")
        return
      }

      // Show loading state
      const redirectBtn = document.querySelector(`[data-field="${fieldId}"].redirect-btn`)
      const originalHTML = redirectBtn.innerHTML
      redirectBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
          <path d="M21 12a9 9 0 11-6.219-8.56"/>
        </svg>
      `
      redirectBtn.style.color = "#00d4ff"

      try {
        // Method 1: Use chrome.tabs API to open and inject script
        if (chrome.tabs && username && password) {
          // Store credentials temporarily for the content script
          await chrome.storage.local.set({
            tempCredentials: {
              username: username,
              password: password,
              timestamp: Date.now(),
            },
          })

          // Create new tab
          const tab = await chrome.tabs.create({
            url: consoleUrl,
            active: true,
          })

          this.showToast("🚀 Opening AWS Console with auto-fill...")

          // Wait for tab to load and inject script
          setTimeout(async () => {
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: this.injectAutoFillScript,
              })
            } catch (error) {
              console.log("Script injection failed:", error)
              this.showToast("Console opened. Use copy buttons to fill credentials manually.", "warning")
            }
          }, 2000)
        } else {
          // Method 2: Fallback - simple window.open
          const newTab = window.open(consoleUrl, "_blank")
          if (newTab) {
            if (username && password) {
              this.showToast("🚀 Console opened. Auto-fill may not work due to security restrictions.")
            } else {
              this.showToast("🚀 Console opened. Please fill credentials manually.")
            }
          } else {
            this.showToast("Failed to open new tab. Please check popup blocker.", "error")
          }
        }
      } catch (error) {
        console.error("Error with chrome.tabs API:", error)
        // Fallback to simple window.open
        const newTab = window.open(consoleUrl, "_blank")
        if (newTab) {
          this.showToast("🚀 Console opened. Please fill credentials manually.")
        } else {
          this.showToast("Failed to open new tab. Please check popup blocker.", "error")
        }
      }

      // Restore button state
      setTimeout(() => {
        redirectBtn.innerHTML = originalHTML
        redirectBtn.style.color = ""
      }, 2000)
    } catch (error) {
      console.error("Error redirecting to console:", error)
      this.showToast("Error opening AWS Console", "error")
    }
  }

  // This function will be injected into the AWS console page
  injectAutoFillScript() {
    console.log("🔐 AWS Console Auto-Fill Script Injected")

    // Get credentials from extension storage
    chrome.storage.local.get(["tempCredentials"], (result) => {
      if (!result.tempCredentials) {
        console.log("❌ No temporary credentials found")
        return
      }

      const { username, password, timestamp } = result.tempCredentials

      // Check if credentials are not too old (5 minutes)
      if (Date.now() - timestamp > 5 * 60 * 1000) {
        console.log("❌ Credentials expired")
        chrome.storage.local.remove("tempCredentials")
        return
      }

      // Clear temporary credentials for security
      chrome.storage.local.remove("tempCredentials")

      function fillCredentials() {
        const usernameSelectors = [
          'input[name="username"]',
          'input[id="username"]',
          'input[type="text"]:not([name="search"])',
          'input[placeholder*="username" i]',
          'input[placeholder*="user" i]',
          "#resolving_input",
          'input[data-testid="username"]',
          'input[autocomplete="username"]',
          ".awsui-input input",
        ]

        const passwordSelectors = [
          'input[name="password"]',
          'input[id="password"]',
          'input[type="password"]',
          'input[placeholder*="password" i]',
          'input[data-testid="password"]',
          'input[autocomplete="current-password"]',
        ]

        let usernameField = null
        let passwordField = null

        // Find username field
        for (const selector of usernameSelectors) {
          const fields = document.querySelectorAll(selector)
          for (const field of fields) {
            if (field && field.offsetParent !== null && !field.disabled) {
              usernameField = field
              break
            }
          }
          if (usernameField) break
        }

        // Find password field
        for (const selector of passwordSelectors) {
          const fields = document.querySelectorAll(selector)
          for (const field of fields) {
            if (field && field.offsetParent !== null && !field.disabled) {
              passwordField = field
              break
            }
          }
          if (passwordField) break
        }

        let filled = false

        if (usernameField) {
          console.log("✅ Username field found, filling...")
          usernameField.focus()
          usernameField.value = username
          usernameField.dispatchEvent(new Event("input", { bubbles: true }))
          usernameField.dispatchEvent(new Event("change", { bubbles: true }))
          usernameField.dispatchEvent(new Event("blur", { bubbles: true }))

          // Visual feedback
          const originalBg = usernameField.style.backgroundColor
          usernameField.style.backgroundColor = "#e8f5e8"
          usernameField.style.transition = "background-color 0.3s ease"
          setTimeout(() => {
            usernameField.style.backgroundColor = originalBg
          }, 2000)
          filled = true
        }

        if (passwordField) {
          console.log("✅ Password field found, filling...")
          passwordField.focus()
          passwordField.value = password
          passwordField.dispatchEvent(new Event("input", { bubbles: true }))
          passwordField.dispatchEvent(new Event("change", { bubbles: true }))
          passwordField.dispatchEvent(new Event("blur", { bubbles: true }))

          // Visual feedback
          const originalBg = passwordField.style.backgroundColor
          passwordField.style.backgroundColor = "#e8f5e8"
          passwordField.style.transition = "background-color 0.3s ease"
          setTimeout(() => {
            passwordField.style.backgroundColor = originalBg
          }, 2000)
          filled = true
        }

        if (filled) {
          showNotification("🎉 Credentials auto-filled by AWS Credential Manager!")
        }

        return filled
      }

      function showNotification(message) {
        // Remove any existing notifications
        const existingNotification = document.querySelector("#aws-cred-manager-notification")
        if (existingNotification) {
          existingNotification.remove()
        }

        const notification = document.createElement("div")
        notification.id = "aws-cred-manager-notification"
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
            z-index: 999999;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
            cursor: pointer;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            ${message}
          </div>
        `

        // Add animation styles
        if (!document.querySelector("#aws-cred-manager-styles")) {
          const style = document.createElement("style")
          style.id = "aws-cred-manager-styles"
          style.textContent = `
            @keyframes slideInRight {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `
          document.head.appendChild(style)
        }

        document.body.appendChild(notification)

        // Make notification clickable to dismiss
        notification.addEventListener("click", () => {
          notification.remove()
        })

        // Auto-remove after 5 seconds
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove()
          }
        }, 5000)
      }

      // Try to fill credentials immediately
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", fillCredentials)
      } else {
        fillCredentials()
      }

      // Try multiple times with delays for dynamic content
      const attempts = [500, 1000, 2000, 3000, 5000]
      attempts.forEach((delay) => {
        setTimeout(() => {
          if (!fillCredentials()) {
            console.log(`Attempt after ${delay}ms failed, form not found yet`)
          }
        }, delay)
      })

      // Watch for dynamic form loading
      const observer = new MutationObserver((mutations) => {
        let shouldTry = false
        mutations.forEach((mutation) => {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const hasLoginForm =
                  node.querySelector &&
                  (node.querySelector('input[type="password"]') ||
                    node.querySelector('input[name="username"]') ||
                    node.querySelector('input[name="password"]') ||
                    node.querySelector(".awsui-input"))

                if (hasLoginForm) {
                  shouldTry = true
                }
              }
            })
          }
        })

        if (shouldTry) {
          console.log("🔄 Login form detected, attempting to fill...")
          setTimeout(fillCredentials, 500)
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      })

      // Stop observing after 30 seconds to prevent memory leaks
      setTimeout(() => {
        observer.disconnect()
      }, 30000)
    })
  }

  setupPolicyToggle() {
    const policyToggle = document.getElementById("policyToggle")
    const policyContent = document.getElementById("policyContent")

    policyToggle.addEventListener("click", () => {
      policyToggle.classList.toggle("active")
      policyContent.classList.toggle("active")
    })
  }

  showToast(message, type = "success") {
    const toast = document.getElementById("toast")
    toast.textContent = message
    toast.className = `toast ${type}`

    // Trigger reflow to ensure the transition works
    toast.offsetHeight

    toast.classList.add("show")

    setTimeout(() => {
      toast.classList.remove("show")
    }, 3000)
  }
}

// Initialize the extension when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new AWSCredentialManager()
})
