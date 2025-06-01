// Content script specifically for AWS console pages
class AWSConsoleAutoFiller {
  constructor() {
    this.credentials = null
    this.maxAttempts = 10
    this.attemptCount = 0
    this.fillInterval = null
    this.init()
  }

  async init() {
    console.log("🔐 AWS Console Auto-Filler initialized")

    // Get credentials from extension storage
    await this.loadCredentials()

    if (this.credentials && this.credentials.active) {
      this.startAutoFill()
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
          console.log("✅ Auto-fill credentials loaded")

          // Clear credentials after loading for security
          await chrome.storage.local.remove(["awsAutoFillCredentials"])
        } else {
          console.log("❌ Credentials expired")
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
        console.log("❌ Max attempts reached, stopping auto-fill")
        return
      }

      this.attemptFill()
    }, 500)

    // Also watch for DOM changes
    this.setupMutationObserver()
  }

  attemptFill() {
    this.attemptCount++
    console.log(`🔄 Auto-fill attempt ${this.attemptCount}/${this.maxAttempts}`)

    const usernameField = this.findUsernameField()
    const passwordField = this.findPasswordField()

    console.log("Fields found:", {
      username: !!usernameField,
      password: !!passwordField,
      usernameValue: usernameField?.value,
      passwordValue: passwordField?.value,
    })

    let filled = false

    if (usernameField && (!usernameField.value || usernameField.value.trim() === "")) {
      console.log("🔄 Filling username field...")
      this.fillField(usernameField, this.credentials.username, "username")
      filled = true
    }

    if (passwordField && (!passwordField.value || passwordField.value.trim() === "")) {
      console.log("🔄 Filling password field...")
      this.fillField(passwordField, this.credentials.password, "password")
      filled = true
    }

    if (filled) {
      clearInterval(this.fillInterval)
      setTimeout(() => {
        this.showSuccessNotification()
        console.log("✅ Credentials successfully filled!")
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
        console.log(`✅ Username field found with selector: ${selector}`)
        return field
      }
    }

    console.log("❌ Username field not found")
    return null
  }

  findPasswordField() {
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
          console.log(`✅ Password field found with selector: ${selector}`)
          console.log("Password field details:", {
            name: field.name,
            id: field.id,
            type: field.type,
            className: field.className,
            value: field.value,
          })
          return field
        }
      }
    }

    // If still not found, try a more aggressive search
    const allPasswordInputs = document.querySelectorAll('input[type="password"]')
    console.log(`Found ${allPasswordInputs.length} password inputs total`)

    for (const field of allPasswordInputs) {
      if (this.isFieldVisible(field)) {
        console.log("✅ Password field found via aggressive search")
        return field
      }
    }

    console.log("❌ Password field not found")
    return null
  }

  isFieldVisible(field) {
    return (
      field &&
      field.offsetParent !== null &&
      !field.disabled &&
      !field.readOnly &&
      field.style.display !== "none" &&
      field.style.visibility !== "hidden"
    )
  }

  fillField(field, value, fieldType) {
    try {
      console.log(`🔄 Attempting to fill ${fieldType} field:`, field)

      // Focus the field first
      field.focus()

      // For password fields, ensure they're ready to receive input
      if (fieldType === "password") {
        // Click the field to ensure it's active
        field.click()

        // Small delay to ensure field is ready
        setTimeout(() => {
          this.performFill(field, value, fieldType)
        }, 100)
      } else {
        this.performFill(field, value, fieldType)
      }
    } catch (error) {
      console.error(`❌ Error filling ${fieldType} field:`, error)
    }
  }

  performFill(field, value, fieldType) {
    try {
      // Clear existing value multiple ways
      field.value = ""
      field.setAttribute("value", "")

      // Set the value using multiple methods
      field.value = value
      field.setAttribute("value", value)

      // Create and dispatch comprehensive events
      const inputEvent = new Event("input", {
        bubbles: true,
        cancelable: true,
        composed: true,
      })

      const changeEvent = new Event("change", {
        bubbles: true,
        cancelable: true,
        composed: true,
      })

      const focusEvent = new Event("focus", {
        bubbles: true,
        cancelable: true,
      })

      const blurEvent = new Event("blur", {
        bubbles: true,
        cancelable: true,
      })

      // For React components, also try React synthetic events
      const reactInputEvent = new Event("input", { bubbles: true })
      reactInputEvent.simulated = true

      // Dispatch events in sequence
      field.dispatchEvent(focusEvent)
      field.dispatchEvent(inputEvent)
      field.dispatchEvent(reactInputEvent)
      field.dispatchEvent(changeEvent)

      // For password fields, try additional methods
      if (fieldType === "password") {
        // Simulate typing
        for (let i = 0; i < value.length; i++) {
          const char = value[i]
          const keydownEvent = new KeyboardEvent("keydown", {
            key: char,
            code: `Key${char.toUpperCase()}`,
            bubbles: true,
            cancelable: true,
          })
          const keypressEvent = new KeyboardEvent("keypress", {
            key: char,
            code: `Key${char.toUpperCase()}`,
            bubbles: true,
            cancelable: true,
          })
          const keyupEvent = new KeyboardEvent("keyup", {
            key: char,
            code: `Key${char.toUpperCase()}`,
            bubbles: true,
            cancelable: true,
          })

          field.dispatchEvent(keydownEvent)
          field.dispatchEvent(keypressEvent)
          field.dispatchEvent(keyupEvent)
        }
      }

      // Final blur event
      setTimeout(() => {
        field.dispatchEvent(blurEvent)
      }, 50)

      // Visual feedback
      this.addVisualFeedback(field, fieldType)

      // Verify the value was set
      setTimeout(() => {
        if (field.value === value) {
          console.log(`✅ ${fieldType} field filled successfully - value verified`)
        } else {
          console.log(`⚠️ ${fieldType} field value mismatch. Expected: "${value}", Got: "${field.value}"`)
          // Try one more time with direct property setting
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(field, value)
          field.dispatchEvent(new Event("input", { bubbles: true }))
        }
      }, 100)
    } catch (error) {
      console.error(`❌ Error in performFill for ${fieldType}:`, error)
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
        console.log("🔄 New form elements detected, attempting fill...")
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
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new AWSConsoleAutoFiller()
  })
} else {
  new AWSConsoleAutoFiller()
}
