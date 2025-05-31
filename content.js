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

  extractCredentials() {
    const container = this.findCredentialsContainer()
    if (container) {
      this.credentials = this.parseCredentials(container)
      console.log("✅ Credentials found:", this.credentials)

      // Send message to background script
      chrome.runtime.sendMessage({
        action: "credentialsFound",
        credentials: this.credentials,
      })
    } else {
      console.log("❌ Credentials container not found.")
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

  start() {
    console.log("🚀 Starting credential harvester...")
    this.setupMutationObserver()
    this.extractCredentials() // Initial check in case credentials are already present
  }
}

const harvester = new CredentialHarvester()
harvester.start()
