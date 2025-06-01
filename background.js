// Background script to handle extension lifecycle and messaging
class BackgroundManager {
  constructor() {
    this.init()
  }

  init() {
    console.log("🔧 Background script initialized")

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("📨 Message received in background:", message)

      if (message.action === "credentialsFound") {
        this.handleCredentialsFound(message.credentials, sender)
        sendResponse({ success: true })
      }

      // Handle legacy message format for backward compatibility
      if (message.type === "CREDENTIALS_EXTRACTED") {
        this.handleCredentialsFound(message.credentials, sender)
        sendResponse({ success: true })
      }

      // Handle manual extraction request
      if (message.action === "extractCredentials") {
        this.handleManualExtraction(sender.tab.id)
        sendResponse({ success: true })
      }

      return true // Keep message channel open for async response
    })

    // Listen for extension icon clicks
    chrome.action.onClicked.addListener((tab) => {
      this.handleIconClick(tab)
    })

    // Handle extension installation/startup
    chrome.runtime.onStartup.addListener(() => {
      console.log("🚀 Extension started")
    })

    chrome.runtime.onInstalled.addListener((details) => {
      console.log("📦 Extension installed/updated:", details.reason)
      if (details.reason === "install") {
        this.showWelcomeNotification()
      }
    })
  }

  async handleCredentialsFound(credentials, sender) {
    try {
      console.log("🔔 Credentials extracted from page:", credentials)

      // Validate credentials before storing
      if (!this.validateCredentials(credentials)) {
        console.warn("⚠️ Invalid credentials received")
        return
      }

      // Store the credentials with metadata
      await chrome.storage.local.set({
        awsCredentials: credentials,
        lastExtracted: Date.now(),
        extractedFromPage: true,
        sourceTab: sender.tab?.id,
        sourceUrl: sender.tab?.url,
      })

      // Show notification badge on the tab
      if (sender.tab?.id) {
        await this.showSuccessBadge(sender.tab.id)
      }

      // Send notification to popup if it's open
      try {
        await chrome.runtime.sendMessage({
          type: "CREDENTIALS_UPDATED",
          credentials: credentials,
          timestamp: Date.now(),
        })
      } catch (e) {
        // Popup might not be open, that's okay
        console.log("📝 Credentials saved (popup not open)")
      }

      console.log("✅ Credentials processed successfully")
    } catch (error) {
      console.error("❌ Error handling extracted credentials:", error)
    }
  }

  validateCredentials(credentials) {
    // Check if we have at least some valid credentials
    const hasConsoleLink = credentials.consoleLink && credentials.consoleLink.includes("signin.aws.amazon.com")
    const hasAccessKey = credentials.accessKey && credentials.accessKey.startsWith("AKIA")
    const hasUsername = credentials.username && credentials.username.length > 0

    return hasConsoleLink || hasAccessKey || hasUsername
  }

  async showSuccessBadge(tabId) {
    try {
      // Show green badge with checkmark
      await chrome.action.setBadgeText({
        text: "✓",
        tabId: tabId,
      })

      await chrome.action.setBadgeBackgroundColor({
        color: "#4caf50",
        tabId: tabId,
      })

      // Clear badge after 10 seconds
      setTimeout(async () => {
        try {
          await chrome.action.setBadgeText({
            text: "",
            tabId: tabId,
          })
        } catch (e) {
          // Tab might be closed, ignore error
        }
      }, 10000)
    } catch (error) {
      console.error("Error setting badge:", error)
    }
  }

  async handleIconClick(tab) {
    console.log("🖱️ Extension icon clicked on tab:", tab.id)

    // Check if this is a Poridhi page
    if (tab.url && tab.url.includes("poridhi.io")) {
      // Set badge to indicate extraction is in progress
      await chrome.action.setBadgeText({
        text: "...",
        tabId: tab.id,
      })

      await chrome.action.setBadgeBackgroundColor({
        color: "#FFA500", // Orange for "in progress"
        tabId: tab.id,
      })

      // Trigger manual extraction
      await this.handleManualExtraction(tab.id)
    }
  }

  async handleManualExtraction(tabId) {
    try {
      console.log("🔍 Manual extraction triggered for tab:", tabId)

      // Execute content script to extract credentials
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: () => {
          // This function runs in the context of the page
          console.log("🔍 Manual credential extraction started")

          // Dispatch a custom event that our content script can listen for
          document.dispatchEvent(
            new CustomEvent("aws-credential-manager-extract", {
              detail: { manual: true },
            }),
          )

          // If our content script isn't loaded yet, we'll also try to extract directly
          if (window.manuallyExtractCredentials) {
            window.manuallyExtractCredentials()
          } else {
            console.log("⚠️ Content script not ready, extraction may fail")
          }
        },
      })

      console.log("✅ Manual extraction script executed")
    } catch (error) {
      console.error("❌ Error triggering manual extraction:", error)

      // Clear badge on error
      await chrome.action.setBadgeText({
        text: "❌",
        tabId: tabId,
      })

      setTimeout(async () => {
        try {
          await chrome.action.setBadgeText({
            text: "",
            tabId: tabId,
          })
        } catch (e) {
          // Tab might be closed, ignore error
        }
      }, 3000)
    }
  }

  showWelcomeNotification() {
    // Show a welcome notification when extension is first installed
    console.log("👋 Welcome to AWS Credential Manager!")

    // You could show a notification here if needed
    // chrome.notifications.create({...})
  }

  // Utility method to clean up old stored data
  async cleanupOldData() {
    try {
      const result = await chrome.storage.local.get(["lastExtracted"])
      if (result.lastExtracted) {
        const daysSinceExtraction = (Date.now() - result.lastExtracted) / (1000 * 60 * 60 * 24)

        // Clear credentials older than 7 days for security
        if (daysSinceExtraction > 7) {
          await chrome.storage.local.remove(["awsCredentials", "lastExtracted", "extractedFromPage"])
          console.log("🧹 Cleaned up old credentials for security")
        }
      }
    } catch (error) {
      console.error("Error cleaning up old data:", error)
    }
  }
}

// Initialize background manager
const backgroundManager = new BackgroundManager()

// Clean up old data periodically
setInterval(
  () => {
    backgroundManager.cleanupOldData()
  },
  24 * 60 * 60 * 1000,
) // Check daily
