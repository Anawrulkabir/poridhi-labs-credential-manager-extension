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
    await this.loadCredentials()
    this.setupEventListeners()
    this.setupPolicyToggle()
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

      await chrome.storage.local.set({ awsCredentials: this.credentials })
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
      }, 2000)
    } catch (error) {
      console.error("Error saving credentials:", error)
      this.showToast("Error saving credentials", "error")
    }
  }

  async clearCredentials() {
    try {
      // Show confirmation
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

      await chrome.storage.local.remove("awsCredentials")
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
        }, 1000) // Auto-save after 1 second of no typing
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

// Handle extension icon click to ensure popup stays open
chrome.action?.onClicked?.addListener(() => {
  // This will be handled by the manifest popup configuration
})
