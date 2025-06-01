class AWSCredentialManager {
  constructor() {
    this.credentials = {
      consoleLink: "",
      username: "",
      password: "",
      accessKey: "",
      secretKey: "",
      "poridhi-iam": "",
      "aws-cli-command": "",
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
      if (key === "aws-cli-command" && this.credentials[key]) {
        input.value = this.credentials[key]
      } else if (input && this.credentials[key]) {
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
        "aws-cli-command": "",
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
      "aws-cli-command": "AWS CLI Command",
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

  generateAWSCLICommand() {
    const accessKey = document.getElementById("accessKey").value.trim()
    const secretKey = document.getElementById("secretKey").value.trim()
    const region = "ap-southeast-1" // Default region for Poridhi labs
    const outputFormat = "json" // Default output format

    if (!accessKey || !secretKey) {
      this.showToast("Access Key and Secret Key are required to generate CLI command", "error")
      return
    }

    // Generate the one-liner command
    const cliCommand = `aws configure set aws_access_key_id ${accessKey} && aws configure set aws_secret_access_key ${secretKey} && aws configure set default.region ${region} && aws configure set default.output ${outputFormat}`

    // Set the command in the input field
    document.getElementById("aws-cli-command").value = cliCommand

    // Update credentials object
    this.credentials["aws-cli-command"] = cliCommand

    // Save credentials
    this.saveCredentials()

    // Show success message
    this.showToast("🚀 AWS CLI one-liner generated! Copy and paste in terminal.")

    // Visual feedback for generate button
    const generateBtn = document.querySelector('.generate-cli-btn[data-field="aws-cli-command"]')
    const originalHTML = generateBtn.innerHTML
    generateBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20,6 9,17 4,12"></polyline>
    </svg>
  `
    generateBtn.style.background = "linear-gradient(135deg, #4caf50 0%, #45a049 100%)"
    generateBtn.style.color = "white"

    setTimeout(() => {
      generateBtn.innerHTML = originalHTML
      generateBtn.style.background = ""
      generateBtn.style.color = ""
    }, 2000)
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

    // Generate CLI command buttons
    document.querySelectorAll(".generate-cli-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const fieldId = e.currentTarget.getAttribute("data-field")
        if (fieldId === "aws-cli-command") {
          this.generateAWSCLICommand()
        }
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

    // Auto-generate CLI command when access key or secret key changes
    document.getElementById("accessKey").addEventListener("input", () => {
      setTimeout(() => {
        this.autoGenerateCLICommand()
      }, 500)
    })

    document.getElementById("secretKey").addEventListener("input", () => {
      setTimeout(() => {
        this.autoGenerateCLICommand()
      }, 500)
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
        // Store credentials in extension storage for the content script
        await chrome.storage.local.set({
          awsAutoFillCredentials: {
            username: username,
            password: password,
            timestamp: Date.now(),
            active: true,
          },
        })

        // Create new tab
        const tab = await chrome.tabs.create({
          url: consoleUrl,
          active: true,
        })

        this.showToast("🚀 Opening AWS Console with auto-fill...")

        // Restore button state
        setTimeout(() => {
          redirectBtn.innerHTML = originalHTML
          redirectBtn.style.color = ""
        }, 2000)
      } catch (error) {
        console.error("Error with chrome.tabs API:", error)
        // Fallback to simple window.open
        const newTab = window.open(consoleUrl, "_blank")
        if (newTab) {
          this.showToast("🚀 Console opened. Please fill credentials manually.")
        } else {
          this.showToast("Failed to open new tab. Please check popup blocker.", "error")
        }

        // Restore button state
        setTimeout(() => {
          redirectBtn.innerHTML = originalHTML
          redirectBtn.style.color = ""
        }, 2000)
      }
    } catch (error) {
      console.error("Error redirecting to console:", error)
      this.showToast("Error opening AWS Console", "error")
    }
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

  autoGenerateCLICommand() {
    const accessKey = document.getElementById("accessKey").value.trim()
    const secretKey = document.getElementById("secretKey").value.trim()

    if (accessKey && secretKey) {
      const region = "ap-southeast-1"
      const outputFormat = "json"
      const cliCommand = `aws configure set aws_access_key_id ${accessKey} && aws configure set aws_secret_access_key ${secretKey} && aws configure set default.region ${region} && aws configure set default.output ${outputFormat}`

      document.getElementById("aws-cli-command").value = cliCommand
      this.credentials["aws-cli-command"] = cliCommand
    }
  }
}

// Initialize the extension when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new AWSCredentialManager()
})
