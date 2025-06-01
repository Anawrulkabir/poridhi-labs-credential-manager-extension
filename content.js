class CredentialHarvester {
  constructor() {
    this.credentials = {
      consoleLink: "",
      username: "",
      password: "",
      accessKey: "",
      secretKey: "",
      "poridhi-iam": "",
    }
    this.lastExtraction = 0
    this.extractionCooldown = 2000 // 2 seconds cooldown between extractions
  }

  findCredentialsContainer() {
    // Look for the credentials section with the specific structure
    const selectors = [
      // Look for the credentials section by the "Credentials" heading
      'h3:contains("Credentials")',
      // Look for the green credentials icon container
      "div:has(.bg-\\[\\#259c57\\])",
      // Look for the grid container with credentials
      ".grid.grid-cols-7",
      // Look for the credentials container by text content
      "div:has(h3.text-\\[\\#2cd673\\])",
    ]

    // First try CSS selectors
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector)
        if (element) {
          // Find the parent container that has the full credentials section
          let container = element
          while (container && !container.querySelector(".grid-cols-7")) {
            container = container.parentElement
          }
          return container || element
        }
      } catch (e) {
        // CSS :contains() might not work in all browsers
      }
    }

    // Alternative approach: find by text content and structure
    const allDivs = document.querySelectorAll("div")
    for (const div of allDivs) {
      const text = div.textContent || div.innerText

      // Look for the credentials section
      if (text.includes("Credentials") && (text.includes("Console link:") || text.includes("signin.aws.amazon.com"))) {
        return div
      }

      // Look for the specific grid structure
      if (div.classList.contains("grid") && div.classList.contains("grid-cols-7") && text.includes("Console link:")) {
        return div.parentElement || div
      }
    }

    return null
  }

  parseCredentials(container) {
    const credentials = {
      consoleLink: "",
      username: "",
      password: "",
      accessKey: "",
      secretKey: "",
      "poridhi-iam": "",
    }

    try {
      console.log("🔍 Parsing container:", container)

      // Method 1: Parse the grid structure specifically
      const gridContainer = container.querySelector(".grid-cols-7") || container
      if (gridContainer) {
        const spans = gridContainer.querySelectorAll("span")
        let currentField = ""

        spans.forEach((span, index) => {
          const text = span.textContent.trim()

          // Identify field labels
          if (text.includes("Console link:")) {
            currentField = "consoleLink"
          } else if (text.includes("Username:")) {
            currentField = "username"
          } else if (text.includes("Password:")) {
            currentField = "password"
          } else if (text.includes("AccessKey:")) {
            currentField = "accessKey"
          } else if (text.includes("SecretKey:")) {
            currentField = "secretKey"
          } else if (text.includes("Poridhi-IAM:")) {
            currentField = "poridhi-iam"
          }

          // Look for values in spans with ellipsis class
          if (span.classList.contains("text-ellipsis") || span.querySelector(".text-ellipsis")) {
            const valueElement = span.querySelector(".text-ellipsis") || span
            const value = valueElement.textContent.trim()

            if (value && value.length > 3 && !value.includes(":")) {
              // Determine which field this value belongs to based on patterns
              if (value.includes("https://") && value.includes("signin.aws.amazon.com")) {
                credentials.consoleLink = value
              } else if (value.startsWith("AKIA")) {
                credentials.accessKey = value
              } else if (value.startsWith("eyJ")) {
                credentials["poridhi-iam"] = value
              } else if (value.includes("+") || value.includes("/") || value.length > 20) {
                if (!credentials.secretKey) {
                  credentials.secretKey = value
                }
              } else if (value.includes("@") || value.includes("!") || value.includes("#")) {
                if (!credentials.password) {
                  credentials.password = value
                }
              } else if (value.includes("-") && value.length < 20) {
                if (!credentials.username) {
                  credentials.username = value
                }
              }
            }
          }
        })
      }

      // Method 2: Fallback - parse by text patterns
      const textContent = container.textContent || container.innerText
      const patterns = {
        consoleLink: /https:\/\/\d+\.signin\.aws\.amazon\.com\/console/,
        accessKey: /AKIA[A-Z0-9]{16}/,
        secretKey: /[A-Za-z0-9+/]{40}/,
        "poridhi-iam": /eyJ[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=_-]+/,
      }

      for (const [key, pattern] of Object.entries(patterns)) {
        if (!credentials[key]) {
          const match = textContent.match(pattern)
          if (match) {
            credentials[key] = match[0]
          }
        }
      }

      // Method 3: Extract username and password from remaining text
      if (!credentials.username || !credentials.password) {
        const lines = textContent
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const nextLine = lines[i + 1]

          if (line.includes("Username:") && nextLine && !nextLine.includes(":")) {
            credentials.username = nextLine
          } else if (line.includes("Password:") && nextLine && !nextLine.includes(":")) {
            credentials.password = nextLine
          }
        }
      }

      console.log("📋 Parsed credentials:", credentials)
      return credentials
    } catch (error) {
      console.error("❌ Error parsing credentials:", error)
      return credentials
    }
  }

  copyToClipboard(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        console.log("Text copied to clipboard")
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err)
      })
  }

  extractCredentials(manual = false) {
    // Prevent rapid repeated extractions
    const now = Date.now()
    if (!manual && now - this.lastExtraction < this.extractionCooldown) {
      console.log("⏱️ Extraction cooldown active, skipping")
      return
    }
    this.lastExtraction = now

    const container = this.findCredentialsContainer()
    if (container) {
      this.credentials = this.parseCredentials(container)
      console.log("✅ Credentials found:", this.credentials)

      // Send message to background script
      chrome.runtime.sendMessage({
        action: "credentialsFound",
        credentials: this.credentials,
      })

      return this.credentials
    } else {
      console.log("❌ Credentials container not found.")
      return null
    }
  }

  setupMutationObserver() {
    // Watch for DOM changes to detect when credentials are generated
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false

      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          // Check if any added nodes contain credentials
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node
              const text = element.textContent || element.innerText || ""

              // Check for credentials-related content
              if (
                text.includes("Credentials") ||
                text.includes("Console link:") ||
                text.includes("signin.aws.amazon.com") ||
                element.querySelector(".bg-\\[\\#259c57\\]") ||
                element.querySelector(".grid-cols-7")
              ) {
                shouldCheck = true
              }
            }
          })

          // Also check if existing content was modified
          if (mutation.target && mutation.target.textContent) {
            const text = mutation.target.textContent
            if (text.includes("Console link:") || text.includes("signin.aws.amazon.com")) {
              shouldCheck = true
            }
          }
        }
      })

      if (shouldCheck) {
        console.log("🔄 Credentials-related DOM change detected, extracting...")
        setTimeout(() => {
          this.extractCredentials()
        }, 1000)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    console.log("👀 Mutation observer set up")
  }

  setupCustomEventListener() {
    // Listen for manual extraction requests
    document.addEventListener("aws-credential-manager-extract", (event) => {
      console.log("🔄 Manual extraction requested via custom event")
      const credentials = this.extractCredentials(true)

      if (credentials) {
        // Show visual feedback
        this.showExtractionNotification(true)
      } else {
        // Show failure notification
        this.showExtractionNotification(false)
      }
    })

    console.log("👂 Custom event listener set up")
  }

  showExtractionNotification(success) {
    // Create notification element
    const notification = document.createElement("div")
    notification.id = "aws-credential-manager-notification"
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      border-radius: 12px;
      color: white;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      font-weight: 600;
      z-index: 999999;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      animation: aws-cred-slide-in 0.4s ease;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
    `

    if (success) {
      notification.style.background = "linear-gradient(135deg, #4caf50 0%, #45a049 100%)"
      notification.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        <div>
          <div style="font-weight: 700; margin-bottom: 4px;">✅ Credentials Extracted!</div>
          <div style="font-size: 12px; opacity: 0.9;">Click the extension icon to view</div>
        </div>
      `
    } else {
      notification.style.background = "linear-gradient(135deg, #f44336 0%, #d32f2f 100%)"
      notification.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <div>
          <div style="font-weight: 700; margin-bottom: 4px;">❌ No Credentials Found</div>
          <div style="font-size: 12px; opacity: 0.9;">Make sure you're on a Poridhi lab page</div>
        </div>
      `
    }

    // Add animation styles
    const style = document.createElement("style")
    style.textContent = `
      @keyframes aws-cred-slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes aws-cred-slide-out {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `
    document.head.appendChild(style)

    // Add to page
    document.body.appendChild(notification)

    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = "aws-cred-slide-out 0.3s ease forwards"
      setTimeout(() => {
        notification.remove()
        style.remove()
      }, 300)
    }, 5000)

    // Click to dismiss
    notification.addEventListener("click", () => {
      notification.style.animation = "aws-cred-slide-out 0.3s ease forwards"
      setTimeout(() => {
        notification.remove()
        style.remove()
      }, 300)
    })
  }

  start() {
    console.log("🚀 Starting credential harvester...")
    this.setupMutationObserver()
    this.setupCustomEventListener()
    this.extractCredentials() // Initial check in case credentials are already present

    // Expose manual extraction function to window for direct access
    window.manuallyExtractCredentials = () => this.extractCredentials(true)
  }
}

const harvester = new CredentialHarvester()
harvester.start()
