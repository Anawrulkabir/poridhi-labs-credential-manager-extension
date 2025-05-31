# AWS Credential Manager - Poridhi Labs

A sleek Chrome extension designed to streamline AWS credential management for Poridhi lab environments.

## Features

- 🔐 **Secure Local Storage**: Credentials stored locally using Chrome's storage API
- 📋 **One-Click Copy**: Copy any credential to clipboard with a single click
- 👁️ **Password Visibility Toggle**: Show/hide sensitive fields like passwords and secret keys
- 🎨 **Modern Dark Theme**: Sleek, professional UI with smooth animations
- 💾 **Auto-Save**: Automatically saves credentials as you type
- 🧹 **Quick Clear**: Clear all credentials with confirmation
- ⚠️ **Usage Policy Reminder**: Built-in reminder of Poridhi's educational use policy
- ⌨️ **Keyboard Shortcuts**: Ctrl+S to save, Ctrl+K to clear

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The AWS Credential Manager icon will appear in your extensions toolbar

## Usage

1. Click the extension icon to open the credential manager
2. Enter your AWS credentials from the Poridhi lab page:
   - Console Link
   - Username
   - Password
   - Access Key
   - Secret Key
   - Poridhi IAM
3. Click "Save Credentials" or use Ctrl+S
4. Use the copy buttons to quickly copy credentials to clipboard
5. Toggle password visibility using the eye icon
6. Clear all credentials when done with your lab session

## Security Notes

- ⚠️ **Educational Use Only**: These credentials are for Poridhi lab practice only
- 🗑️ **Clear After Use**: Always clear credentials after completing your lab session
- 🔒 **Local Storage**: Credentials are stored locally on your device only
- 🚫 **No Encryption**: Stored credentials are not encrypted - clear them when done

## Keyboard Shortcuts

- `Ctrl+S` (or `Cmd+S` on Mac): Save credentials
- `Ctrl+K` (or `Cmd+K` on Mac): Clear all credentials

## File Structure

\`\`\`
aws-credential-manager/
├── manifest.json          # Extension configuration
├── popup.html             # Main popup interface
├── popup.css              # Styling and animations
├── popup.js               # Core functionality
├── README.md              # This file
└── icons/                 # Extension icons (add your own)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
\`\`\`

## Adding Icons

Create or download icons in the following sizes and place them in the `icons/` folder:
- `icon16.png` (16x16px)
- `icon48.png` (48x48px)  
- `icon128.png` (128x128px)

You can generate icons using online tools like [favicon.io](https://favicon.io) or [realfavicongenerator.net](https://realfavicongenerator.net).

## Troubleshooting

**Extension not loading?**
- Ensure all files are in the same folder
- Check that Developer mode is enabled in Chrome extensions
- Verify manifest.json syntax is correct

**Copy not working?**
- Ensure the extension has necessary permissions
- Try refreshing the page and reopening the extension

**Credentials not saving?**
- Check Chrome's storage permissions
- Ensure you're not in incognito mode (unless extension is enabled for incognito)

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this extension.

## License

This project is open source and available under the MIT License.
