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
    this.debugMode = true // Enable debug mode
  }

  log(...args) {
    if (this.debugMode) {
      console.log(...args)
    }
  }

  findCredentialsContainer() {
    this.log("🔍 Looking for credentials container...")

    // Look for the specific structure from the HTML
    const selectors = [
      // Look for the credentials section by the "Credentials" heading
      "h3.text-\\[\\#2cd673\\]",
      // Look for the grid container with credentials
      ".grid.grid-cols-7",
      // Look for the credentials container by text content
      "div:has(h3.text-\\[\\#2cd673\\])",
      // Look for the parent container
      ".w-full.p-5.flex.flex-col.gap-2\\.5.rounded-lg.bg-\\[\\#181a2b\\]",
    ]

    // First try CSS selectors
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector)
        if (element) {
          this.log(`✅ Found credentials container with selector: ${selector}`)
          // Find the parent container that has the full credentials section
          let container = element
          while (container && !container.querySelector(".grid-cols-7")) {
            container = container.parentElement
          }
          return container || element.parentElement || element
        }
      } catch (e) {
        this.log(`❌ Selector failed: ${selector}`, e)
      }
    }

    // Alternative approach: find by text content and structure
    const allDivs = document.querySelectorAll("div")
    this.log(`🔍 Searching through ${allDivs.length} div elements...`)

    for (const div of allDivs) {
      const text = div.textContent || div.innerText

      // Look for the credentials section by text content
      if (text.includes("Credentials") && text.includes("Console link:")) {
        this.log("✅ Found credentials container by text content")
        return div
      }

      // Look for the specific grid structure
      if (div.classList.contains("grid") && div.classList.contains("grid-cols-7")) {
        this.log("✅ Found credentials container by grid structure")
        return div.parentElement || div
      }
    }

    // Last resort: look for any element containing AWS console URL
    const elementsWithConsoleLink = Array.from(allDivs).filter((div) => {
      const text = div.textContent || div.innerText
      return text.includes("signin.aws.amazon.com")
    })

    if (elementsWithConsoleLink.length > 0) {
      this.log("✅ Found credentials container by console link")
      return elementsWithConsoleLink[0]
    }

    this.log("❌ Credentials container not found")
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
      this.log("🔍 Parsing container:", container)

      // Method 1: Parse the exact grid structure from the HTML
      const gridContainer = container.querySelector(".grid-cols-7") || container
      if (gridContainer) {
        this.log("✅ Found grid container, parsing...")

        // Get all spans in the grid
        const spans = gridContainer.querySelectorAll("span")
        this.log(`Found ${spans.length} spans in grid`)

        // Parse each row of the grid
        let currentField = ""
        let isValueSpan = false

        spans.forEach((span, index) => {
          const text = span.textContent.trim()
          this.log(`Span ${index}: "${text}" (classes: ${span.className})`)

          // Check if this span contains a field label
          if (text.includes("Console link:")) {
            currentField = "consoleLink"
            isValueSpan = false
          } else if (text.includes("Username:")) {
            currentField = "username"
            isValueSpan = false
          } else if (text.includes("Password:")) {
            currentField = "password"
            isValueSpan = false
          } else if (text.includes("AccessKey:")) {
            currentField = "accessKey"
            isValueSpan = false
          } else if (text.includes("SecretKey:")) {
            currentField = "secretKey"
            isValueSpan = false
          } else if (text.includes("Poridhi-IAM:")) {
            currentField = "poridhi-iam"
            isValueSpan = false
          } else if (
            currentField &&
            (span.classList.contains("text-ellipsis") ||
              span.querySelector(".text-ellipsis") ||
              span.classList.contains("col-span-4"))
          ) {
            // This is likely a value span
            const valueElement = span.querySelector(".text-ellipsis") || span.querySelector("h3") || span
            const value = valueElement.textContent.trim()

            if (value && value.length > 3 && !value.includes(":") && !value.includes("Click to Copy")) {
              this.log(`✅ Found ${currentField}: "${value}"`)
              credentials[currentField] = value
              currentField = "" // Reset after finding value
            }
          }
        })
      }

      // Method 2: Fallback - parse by text patterns and structure
      if (!credentials.consoleLink || !credentials.username || !credentials.password) {
        this.log("🔄 Using fallback parsing method...")

        const textContent = container.textContent || container.innerText
        this.log("Full text content:", textContent)

        // Split by lines and look for patterns
        const lines = textContent
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)

        this.log("Lines found:", lines)

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const nextLine = lines[i + 1]

          if (line.includes("Console link:") && nextLine && nextLine.includes("signin.aws.amazon.com")) {
            credentials.consoleLink = nextLine
            this.log(`✅ Found console link: ${nextLine}`)
          } else if (line.includes("Username:") && nextLine && !nextLine.includes(":")) {
            credentials.username = nextLine
            this.log(`✅ Found username: ${nextLine}`)
          } else if (line.includes("Password:") && nextLine && !nextLine.includes(":")) {
            credentials.password = nextLine
            this.log(`✅ Found password: ${nextLine}`)
          } else if (line.includes("AccessKey:") && nextLine && nextLine.startsWith("AKIA")) {
            credentials.accessKey = nextLine
            this.log(`✅ Found access key: ${nextLine}`)
          } else if (line.includes("SecretKey:") && nextLine && nextLine.length > 20) {
            credentials.secretKey = nextLine
            this.log(`✅ Found secret key: ${nextLine}`)
          } else if (line.includes("Poridhi-IAM:") && nextLine && nextLine.startsWith("eyJ")) {
            credentials["poridhi-iam"] = nextLine
            this.log(`✅ Found Poridhi IAM: ${nextLine.substring(0, 50)}...`)
          }
        }
      }

      // Method 3: Direct regex patterns as final fallback
      if (!credentials.consoleLink || !credentials.username || !credentials.password) {
        this.log("🔄 Using regex pattern matching...")

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
              this.log(`✅ Found ${key} via regex: ${match[0]}`)
            }
          }
        }

        // Special handling for username and password
        if (!credentials.username) {
          // Look for username pattern (typically ends with -poridhi)
          const usernameMatch = textContent.match(/([a-zA-Z0-9-]+)-poridhi/)
          if (usernameMatch) {
            credentials.username = usernameMatch[0]
            this.log(`✅ Found username via regex: ${usernameMatch[0]}`)
          }
        }

        if (!credentials.password) {
          // Look for password pattern (typically has special characters)
          const passwordMatch = textContent.match(/[A-Za-z0-9@#$%^&*()_+\-=[\]{}|;':",./<>?]{8,20}/)
          if ((passwordMatch && passwordMatch[0].includes("@")) || passwordMatch[0].includes("#")) {
            credentials.password = passwordMatch[0]
            this.log(`✅ Found password via regex: ${passwordMatch[0]}`)
          }
        }
      }

      this.log("📋 Final parsed credentials:", credentials)
      return credentials
    } catch (error) {
      console.error("❌ Error parsing credentials:", error)
      return credentials
    }
  }

  extractCredentials(manual = false) {
    // Prevent rapid repeated extractions
    const now = Date.now()
    if (!manual && now - this.lastExtraction < this.extractionCooldown) {
      this.log("⏱️ Extraction cooldown active, skipping")
      return
    }
    this.lastExtraction = now

    this.log("🚀 Starting credential extraction...")

    const container = this.findCredentialsContainer()
    if (container) {
      this.credentials = this.parseCredentials(container)

      // Validate that we found meaningful credentials
      const hasValidCredentials =
        this.credentials.consoleLink ||
        this.credentials.username ||
        this.credentials.password ||
        this.credentials.accessKey

      if (hasValidCredentials) {
        this.log("✅ Credentials found:", this.credentials)

        // Send message to background script
        if (typeof chrome !== "undefined" && chrome.runtime) {
          chrome.runtime.sendMessage({
            action: "credentialsFound",
            credentials: this.credentials,
          })
        }

        return this.credentials
      } else {
        this.log("❌ No valid credentials found in container")
        return null
      }
    } else {
      this.log("❌ Credentials container not found.")
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
                element.querySelector(".grid-cols-7") ||
                text.includes("Username:") ||
                text.includes("Password:")
              ) {
                shouldCheck = true
                this.log("🔄 Credentials-related DOM change detected")
              }
            }
          })

          // Also check if existing content was modified
          if (mutation.target && mutation.target.textContent) {
            const text = mutation.target.textContent
            if (text.includes("Console link:") || text.includes("signin.aws.amazon.com")) {
              shouldCheck = true
              this.log("🔄 Existing content modified with credentials")
            }
          }
        }
      })

      if (shouldCheck) {
        this.log("🔄 DOM change detected, extracting credentials...")
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

    this.log("👀 Mutation observer set up")
  }

  setupCustomEventListener() {
    // Listen for manual extraction requests
    document.addEventListener("aws-credential-manager-extract", (event) => {
      this.log("🔄 Manual extraction requested via custom event")
      const credentials = this.extractCredentials(true)

      if (credentials) {
        // Show visual feedback
        this.showExtractionNotification(true)
      } else {
        // Show failure notification
        this.showExtractionNotification(false)
      }
    })

    this.log("👂 Custom event listener set up")
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

  // Add a debug button to manually trigger extraction
  addDebugButton() {
    const button = document.createElement("button")
    button.textContent = "🔍 Extract Credentials (Debug)"
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      padding: 10px 15px;
      background: #4caf50;
      color: white;
      border: none;
      border-radius: 4px;
      font-weight: bold;
      z-index: 999999;
      cursor: pointer;
    `

    button.addEventListener("click", () => {
      this.log("🔄 Manual extraction triggered via debug button")
      this.extractCredentials(true)
    })

    document.body.appendChild(button)
    this.log("🔧 Debug button added")
  }

  start() {
    this.log("🚀 Starting credential harvester...")
    this.setupMutationObserver()
    this.setupCustomEventListener()
    this.extractCredentials() // Initial check in case credentials are already present

    // Add debug button after 2 seconds
    setTimeout(() => {
      this.addDebugButton()
    }, 2000)

    // Expose manual extraction function to window for direct access
    window.manuallyExtractCredentials = () => this.extractCredentials(true)
  }
}

const harvester = new CredentialHarvester()
harvester.start()
