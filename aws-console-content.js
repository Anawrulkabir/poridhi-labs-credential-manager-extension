// Content script specifically for AWS console pages
class AWSConsoleAutoFiller {
  constructor() {
    this.credentials = null
    this.maxAttempts = 15
    this.attemptCount = 0
    this.fillInterval = null
    this.debugMode = false // Disable debug mode
    this.init()
  }

  async init() {
    this.log("🔐 AWS Console Auto-Filler initialized")

    // Get credentials from extension storage
    await this.loadCredentials()

    if (this.credentials && this.credentials.active) {
      this.startAutoFill()
    }
  }

  log(...args) {
    if (this.debugMode) {
      console.log(...args)
    }
  }

  async loadCredentials() {
    try {
      const result = await chrome.storage.local.get(["awsAutoFillCredentials"])
      if (result.awsAutoFillCredentials) {
        const creds = result.awsAutoFillCredentials

        // Check if credentials are not too old (5 minutes)
        if (Date.now() - creds.timestamp < 5 * 60 * 1000) {
          this.credentials = creds
          this.log("✅ Auto-fill credentials loaded:", this.credentials)

          // Clear credentials after loading for security
          await chrome.storage.local.remove(["awsAutoFillCredentials"])
        } else {
          this.log("❌ Credentials expired")
          await chrome.storage.local.remove(["awsAutoFillCredentials"])
        }
      }
    } catch (error) {
      console.error("Error loading credentials:", error)
    }
  }

  startAutoFill() {
    // Try immediately
    this.attemptFill()

    // Set up interval to try every 500ms
    this.fillInterval = setInterval(() => {
      if (this.attemptCount >= this.maxAttempts) {
        clearInterval(this.fillInterval)
        this.log("❌ Max attempts reached, stopping auto-fill")
        return
      }

      this.attemptFill()
    }, 500)

    // Also watch for DOM changes
    this.setupMutationObserver()
  }

  attemptFill() {
    this.attemptCount++
    this.log(`🔄 Auto-fill attempt ${this.attemptCount}/${this.maxAttempts}`)

    const usernameField = this.findUsernameField()
    const passwordField = this.findPasswordField()

    this.log("Fields found:", {
      username: !!usernameField,
      password: !!passwordField,
      usernameValue: usernameField?.value,
      passwordValue: passwordField?.value,
    })

    let filled = false

    if (usernameField && (!usernameField.value || usernameField.value.trim() === "")) {
      this.log("🔄 Filling username field...")
      this.fillField(usernameField, this.credentials.username, "username")
      filled = true
    }

    if (passwordField) {
      this.log("🔄 Filling password field...")
      this.fillField(passwordField, this.credentials.password, "password")
      filled = true
    }

    if (filled) {
      clearInterval(this.fillInterval)
      setTimeout(() => {
        this.showSuccessNotification()
        this.log("✅ Credentials successfully filled!")
      }, 500)
    }

    return filled
  }

  findUsernameField() {
    // Based on the HTML structure you provided
    const selectors = [
      'input[name="username"]',
      'input[id="username"]',
      'input[aria-labelledby="username-label"]',
      'div[data-testid="username"] input',
      'input[autocomplete="username"]',
      'input[type="text"]:not([name="account"])',
      '.awsui_input_2rhyz_7n7ue_101[type="text"]:not([name="account"])',
    ]

    for (const selector of selectors) {
      const field = document.querySelector(selector)
      if (field && this.isFieldVisible(field) && field.name !== "account") {
        this.log(`✅ Username field found with selector: ${selector}`)
        return field
      }
    }

    this.log("❌ Username field not found")
    return null
  }

  findPasswordField() {
    // Debug: Log all password fields found
    const allPasswordFields = document.querySelectorAll('input[type="password"]')
    this.log(
      `Found ${allPasswordFields.length} password fields:`,
      Array.from(allPasswordFields).map((f) => ({
        id: f.id,
        name: f.name,
        class: f.className,
        visible: this.isFieldVisible(f),
        attributes: Array.from(f.attributes)
          .map((a) => `${a.name}="${a.value}"`)
          .join(", "),
      })),
    )

    // Based on the HTML structure you provided - more comprehensive selectors
    const selectors = [
      'input[name="password"]',
      'input[id="password"]',
      'input[aria-labelledby="password-label"]',
      'div[data-testid="password"] input',
      'input[type="password"]',
      '.awsui_input_2rhyz_7n7ue_101[type="password"]',
      // Additional fallback selectors
      'input[autocomplete="current-password"]',
      'input[autocomplete="password"]',
      'form[data-testid="iam-login-form"] input[type="password"]',
      // Look for any password input in the form
      'form input[type="password"]',
    ]

    for (const selector of selectors) {
      const fields = document.querySelectorAll(selector)
      for (const field of fields) {
        if (field && this.isFieldVisible(field)) {
          this.log(`✅ Password field found with selector: ${selector}`)
          this.log("Password field details:", {
            name: field.name,
            id: field.id,
            type: field.type,
            className: field.className,
            value: field.value,
            attributes: Array.from(field.attributes)
              .map((a) => `${a.name}="${a.value}"`)
              .join(", "),
          })
          return field
        }
      }
    }

    // If still not found, try a more aggressive search
    const allPasswordInputs = document.querySelectorAll('input[type="password"]')
    this.log(`Found ${allPasswordInputs.length} password inputs total`)

    for (const field of allPasswordInputs) {
      if (this.isFieldVisible(field)) {
        this.log("✅ Password field found via aggressive search")
        return field
      }
    }

    this.log("❌ Password field not found")
    return null
  }

  isFieldVisible(field) {
    if (!field) return false

    const isVisible =
      field &&
      field.offsetParent !== null &&
      !field.disabled &&
      !field.readOnly &&
      field.style.display !== "none" &&
      field.style.visibility !== "hidden"

    this.log(`Field visibility check for ${field.id || field.name || "unknown"}: ${isVisible}`)
    return isVisible
  }

  fillField(field, value, fieldType) {
    try {
      this.log(`🔄 Attempting to fill ${fieldType} field:`, field)

      // Try multiple approaches to fill the field
      this.directValueSetting(field, value, fieldType)

      // For password fields, use additional methods
      if (fieldType === "password") {
        this.advancedPasswordFill(field, value)
      }
    } catch (error) {
      console.error(`❌ Error filling ${fieldType} field:`, error)
    }
  }

  directValueSetting(field, value, fieldType) {
    try {
      // Focus the field first
      field.focus()
      field.click()

      // Clear existing value multiple ways
      field.value = ""
      field.setAttribute("value", "")

      // Set the value using multiple methods
      field.value = value
      field.setAttribute("value", value)

      // Dispatch standard events
      field.dispatchEvent(new Event("input", { bubbles: true }))
      field.dispatchEvent(new Event("change", { bubbles: true }))

      // Visual feedback
      this.addVisualFeedback(field, fieldType)

      this.log(`✅ Direct value setting for ${fieldType}: "${value}"`)
    } catch (error) {
      console.error(`❌ Error in direct value setting for ${fieldType}:`, error)
    }
  }

  advancedPasswordFill(field, value) {
    try {
      // Try to access the React component's internal state setter
      this.log("🔍 Attempting advanced password field filling techniques")

      // Method 1: Try to use Object.getOwnPropertyDescriptor
      try {
        const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")
        if (descriptor && descriptor.set) {
          descriptor.set.call(field, value)
          this.log("✅ Used property descriptor to set password")
        }
      } catch (e) {
        this.log("❌ Property descriptor method failed:", e)
      }

      // Method 2: Try to simulate typing
      try {
        field.focus()
        field.click()

        // Clear field
        field.value = ""
        field.dispatchEvent(new Event("input", { bubbles: true }))

        // Type character by character
        for (let i = 0; i < value.length; i++) {
          const char = value[i]

          // Append character
          field.value += char

          // Dispatch events
          field.dispatchEvent(new KeyboardEvent("keydown", { key: char }))
          field.dispatchEvent(new KeyboardEvent("keypress", { key: char }))
          field.dispatchEvent(new Event("input", { bubbles: true }))
          field.dispatchEvent(new KeyboardEvent("keyup", { key: char }))
        }

        field.dispatchEvent(new Event("change", { bubbles: true }))
        this.log("✅ Simulated typing for password field")
      } catch (e) {
        this.log("❌ Simulated typing method failed:", e)
      }

      // Method 3: Try to use React's internal state
      try {
        // Find React fiber node
        let fiber = null
        let node = field

        while (node && !fiber) {
          if (
            node._reactRootContainer ||
            (node.constructor && node.constructor.name === "FiberNode") ||
            node._reactInternalInstance ||
            node._reactInternals
          ) {
            fiber = node._reactRootContainer || node._reactInternalInstance || node._reactInternals
            break
          }
          node = node.parentNode
        }

        if (fiber) {
          this.log("✅ Found React fiber node, attempting to update state")
          // This is a very hacky approach and might not work in all cases
          field.value = value
          field.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
        }
      } catch (e) {
        this.log("❌ React internal state method failed:", e)
      }

      // Method 4: Create a new element and replace
      try {
        const parent = field.parentNode
        if (parent) {
          const newField = field.cloneNode(true)
          newField.value = value
          parent.replaceChild(newField, field)
          newField.dispatchEvent(new Event("input", { bubbles: true }))
          newField.dispatchEvent(new Event("change", { bubbles: true }))
          this.log("✅ Replaced field with clone containing password")
        }
      } catch (e) {
        this.log("❌ Element replacement method failed:", e)
      }

      // Final verification
      setTimeout(() => {
        this.log(`Password field value after all attempts: "${field.value}" (expected: "${value}")`)
        if (field.value !== value) {
          this.log("⚠️ Password field value doesn't match expected value")

          // One last desperate attempt - use clipboard
          this.clipboardFallback(field, value)
        }
      }, 100)
    } catch (error) {
      console.error("❌ Error in advanced password fill:", error)
    }
  }

  async clipboardFallback(field, value) {
    try {
      this.log("🔄 Attempting clipboard fallback for password field")

      // Store original clipboard content
      const originalClipboard = await navigator.clipboard.readText().catch(() => "")

      // Copy password to clipboard
      await navigator.clipboard.writeText(value)

      // Focus field and trigger paste
      field.focus()
      field.select()

      // Try to paste using execCommand
      const pasteSuccess = document.execCommand("paste")
      this.log(`Paste command result: ${pasteSuccess}`)

      // Also try to simulate Ctrl+V
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "v",
          code: "KeyV",
          ctrlKey: true,
          bubbles: true,
        }),
      )

      // Restore original clipboard after a delay
      setTimeout(async () => {
        await navigator.clipboard.writeText(originalClipboard)
      }, 500)

      this.log("✅ Clipboard fallback attempted")
    } catch (e) {
      this.log("❌ Clipboard fallback failed:", e)
    }
  }

  addVisualFeedback(field, fieldType) {
    const originalStyle = {
      backgroundColor: field.style.backgroundColor,
      border: field.style.border,
      transition: field.style.transition,
    }

    // Add green background and border
    field.style.transition = "all 0.3s ease"
    field.style.backgroundColor = "#e8f5e8"
    field.style.border = "2px solid #4caf50"

    // Restore original style after 3 seconds
    setTimeout(() => {
      field.style.backgroundColor = originalStyle.backgroundColor
      field.style.border = originalStyle.border
      field.style.transition = originalStyle.transition
    }, 3000)
  }

  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldTry = false

      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if new form elements were added
              if (
                node.querySelector &&
                (node.querySelector('input[name="username"]') ||
                  node.querySelector('input[name="password"]') ||
                  node.querySelector('input[type="password"]') ||
                  node.querySelector('[data-testid="username"]') ||
                  node.querySelector('[data-testid="password"]'))
              ) {
                shouldTry = true
              }
            }
          })
        }
      })

      if (shouldTry && this.attemptCount < this.maxAttempts) {
        this.log("🔄 New form elements detected, attempting fill...")
        setTimeout(() => this.attemptFill(), 100)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Stop observing after 30 seconds
    setTimeout(() => {
      observer.disconnect()
    }, 30000)
  }

  showSuccessNotification() {
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
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.4s ease;
        max-width: 350px;
        cursor: pointer;
        border: 2px solid rgba(255,255,255,0.2);
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        <div>
          <div style="font-weight: 700; margin-bottom: 4px;">🎉 Auto-Fill Complete!</div>
          <div style="font-size: 12px; opacity: 0.9;">Credentials filled by AWS Credential Manager</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.7;">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </div>
    `

    // Add animation styles if not already present
    if (!document.querySelector("#aws-cred-manager-styles")) {
      const style = document.createElement("style")
      style.id = "aws-cred-manager-styles"
      style.textContent = `
        @keyframes slideInRight {
          from { 
            transform: translateX(100%) scale(0.8); 
            opacity: 0; 
          }
          to { 
            transform: translateX(0) scale(1); 
            opacity: 1; 
          }
        }
      `
      document.head.appendChild(style)
    }

    document.body.appendChild(notification)

    // Make notification clickable to dismiss
    notification.addEventListener("click", () => {
      notification.style.animation = "slideInRight 0.3s ease reverse"
      setTimeout(() => notification.remove(), 300)
    })

    // Auto-remove after 8 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = "slideInRight 0.3s ease reverse"
        setTimeout(() => notification.remove(), 300)
      }
    }, 8000)
  }
}

// Initialize the auto-filler when the page loads
if (typeof chrome !== "undefined" && chrome.storage) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      const filler = new AWSConsoleAutoFiller()
    })
  } else {
    const filler = new AWSConsoleAutoFiller()
  }
} else {
  console.warn("AWS Console Auto-Filler: Chrome storage API is not available. The extension may not work correctly.")
}
