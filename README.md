# MyDeviceAI

<p align="center">
  Your Personal AI Assistant - Private, Powerful, and Always Ready
</p>

## 🌟 Overview

MyDeviceAI brings the power of artificial intelligence directly to your mobile device, with a focus on privacy, performance, and personalization. Run AI models locally on your iOS or Android device, or connect remotely to your desktop computer from anywhere using WebRTC.

**What makes MyDeviceAI unique:** We're the only local AI app that lets you seamlessly run powerful desktop models remotely on your computer via secure peer-to-peer WebRTC connections. Use your mobile device as a gateway to desktop-class AI models through [MyDeviceAI-Desktop](https://github.com/navedmerchant/MyDeviceAI-Desktop), all while maintaining complete privacy and control.

By combining on-device AI processing with optional remote desktop connectivity and privacy-focused web services, MyDeviceAI offers the best of all worlds: the convenience of mobile, the power of desktop, and the privacy of local-first computing.

## ✨ Key Features

- **Seamless Experience**: The app comes with bundled AI models that load asynchronously in the background, ensuring zero waiting time and a smooth user experience from the moment you launch.

- **Remote Desktop Connection**: Connect your mobile device to MyDeviceAI-Desktop using secure peer-to-peer WebRTC connections. Leverage the power of desktop-class AI models directly from your iOS or Android device with automatic retry and reconnection support.

- **Web Search Integration**: Bridge the knowledge gap between local AI and cloud capabilities with our web search integration, utilizing a self-hosted SearXNG instance for privacy-focused results.

- **Thinking Mode**: Powered by Qwen 3, our Thinking Mode helps you tackle complex problems and brainstorming sessions with advanced reasoning capabilities.

- **Personalization (Beta)**: Create a truly personalized AI experience by loading saved user contexts. Tailor conversations to your preferences and needs (Currently in Beta).

- **Chat History**: Access up to 30 days of conversation history, making it easy to reference past discussions and maintain context over time.

- **Broad Device Support**: Compatible with all modern iPhones and Android devices, bringing private AI capabilities to more users than ever before.

## 🚀 Getting Started

### Prerequisites

- macOS
- Xcode 13.0+
- CocoaPods
- Node.js 14.0 or later
- React Native development environment set up ([React Native - Environment Setup](https://reactnative.dev/docs/environment-setup))

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/navedmerchant/MyDeviceAI.git
   cd MyDeviceAI
   ```

2. Download required AI models:
   - Download [Qwen3 1.7B Q4](https://huggingface.co/bartowski/Qwen_Qwen3-1.7B-GGUF) and place it in the `ios/` directory
   - Download [BGE Small](https://huggingface.co/CompendiumLabs/bge-small-en-v1.5-gguf) and place it in the `ios/` directory

3. Create configuration file:
   - Create `src/config/Env.ts` with the following content:
     ```typescript
     export const HOSTNAME = 'YOUR_SEARXNG_INSTANCE_URL';
     export const P2PCF_WORKER_URL = 'YOUR_P2PCF_SIGNALLING_SERVER_URL';
     ```

   **Important Configuration Notes:**
   - **`HOSTNAME`**: URL of your SearXNG instance for web search functionality (optional, but recommended for web search features)
   - **`P2PCF_WORKER_URL`**: URL of your P2PCF signalling server (required for remote desktop connections)
     - This enables secure peer-to-peer WebRTC communication between mobile and desktop clients
     - Without this, remote desktop features will not work
     - Example: `https://your-p2pcf-server.com/`
     - **Deployment Options:**
       - **Option 1 (Cloudflare Workers)**: Deploy [p2pcf worker.js](https://github.com/gfodor/p2pcf/blob/master/src/worker.js) on Cloudflare Workers (free tier available)
       - **Option 2 (Railway)**: Deploy [p2pcf-signalling](https://github.com/navedmerchant/p2pcf-signalling) on Railway (easy one-click deployment)

4. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

5. Install pods:
   ```bash
   cd ios && pod install && cd ..
   ```

6. Start the application:
   ```bash
   npm run ios
   # or
   yarn ios
   ```

## 🔗 Remote Desktop Connection

MyDeviceAI supports secure peer-to-peer connections between mobile devices (iOS/Android) and desktop computers, allowing you to access powerful desktop-class AI models from your phone.

### How It Works

The remote connection feature uses **WebRTC** technology through the **p2pcf.rn** library to establish direct peer-to-peer connections:

- **Cross-Platform Support**: Works seamlessly on both iOS and Android devices
- **Secure Communication**: End-to-end encrypted WebRTC data channels
- **6-Digit Room Codes**: Simple room-based pairing system
- **Automatic Retry**: Built-in connection retry with exponential backoff (up to 3 attempts)
- **Real-time Streaming**: Supports streaming responses with both regular and reasoning tokens

### Setup Requirements

1. **P2PCF Signalling Server**: You need a P2PCF signalling server for WebRTC coordination. Configure the URL in `src/config/Env.ts`:
   ```typescript
   export const P2PCF_WORKER_URL = 'https://your-p2pcf-server.com/';
   ```

2. **MyDeviceAI-Desktop**: Install and run the [MyDeviceAI-Desktop](https://github.com/navedmerchant/MyDeviceAI-Desktop) companion app on your computer

### Using Remote Connection

1. Start MyDeviceAI-Desktop on your computer and generate a 6-digit room code
2. Open MyDeviceAI mobile app
3. Navigate to Remote Connection settings
4. Enter the 6-digit room code
5. Once connected, your mobile app will use the desktop's AI models for inference

### Features

- **Protocol Handshake**: Automatic version negotiation ensures compatibility between mobile and desktop clients
- **Connection Monitoring**: Real-time connection status with retry countdown
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Automatic Reconnection**: Automatically attempts to reconnect on disconnection (up to 3 attempts with exponential backoff)
- **OpenAI-Compatible API**: Uses standard message format for seamless integration

### Technical Details

- **Protocol Version**: 1.0.0
- **Transport**: WebRTC Data Channels
- **Message Format**: JSON-based P2P protocol
- **Retry Strategy**: Exponential backoff (2s → 3s → 4.5s, max 30s)
- **Max Retry Attempts**: 3
- **Polling Interval**: 3 seconds (mobile polls for desktop availability)

## 🛠️ Technical Stack

- **Framework**: React Native (iOS/Android)
- **AI Models**:
  - Qwen 3 (1.7B Q4) for chat and reasoning
  - BGE Small for embeddings
- **Remote Connection**:
  - p2pcf.rn for WebRTC peer-to-peer communication
  - Custom P2P protocol for desktop-mobile sync
- **Web Search**: SearXNG Integration
- **State Management**: Redux + Redux Toolkit
- **Storage**: AsyncStorage for chat history and user contexts
- **UI Components**: Lucide
- **Code Quality**: ESLint, Prettier
- **Build Tools**: Metro Bundler

## 🤝 Contributing

We welcome contributions to MyDeviceAI! Here's how you can help:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow the React Native community best practices
- Write meaningful commit messages
- Update documentation for any new features
- Add appropriate tests for new functionality
- Ensure privacy-first approach in feature implementation

## 🔐 Privacy

MyDeviceAI is built with privacy at its core:
- All AI processing happens locally on your device
- No data is sent to external servers without explicit consent
- Web Search integration via SearXNG respects user privacy
- Chat history is stored locally and never uploaded

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Bug Reports

If you discover any bugs, please create an issue in the GitHub repository including:

- iOS version
- iPhone model
- Steps to reproduce the bug
- Expected and actual behavior

## ⚠️ Known Issues

We are actively working on the following issues and welcome contributions:

1. **Formula Rendering**: Need to implement mathematical formula support using KaTeX or a Redux-compatible parser
2. **Image Rendering**: Some base64 images from search results fail to render properly
3. **Think Token Display**: Occasional display of raw think tokens in the thinking section needs better parsing logic

If you'd like to help solve any of these issues, please check our Contributing section above!

## 📞 Contact

If you have any questions or suggestions, feel free to open an issue or reach out to the maintainers.

---

<p align="center">
  Made with ❤️ by Naved Merchant
</p>
