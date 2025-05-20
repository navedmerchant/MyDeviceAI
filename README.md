# MyDeviceAI

<p align="center">
  Your Personal AI Assistant - Private, Powerful, and Always Ready
</p>

## 🌟 Overview

MyDeviceAI brings the power of artificial intelligence directly to your iPhone, with a focus on privacy, performance, and personalization. By running AI models directly on your device and integrating with privacy-focused web services, MyDeviceAI offers a unique blend of local processing power and cloud-based knowledge, all while keeping your data private and secure.

## ✨ Key Features

- **Seamless Experience**: The app comes with bundled AI models that load asynchronously in the background, ensuring zero waiting time and a smooth user experience from the moment you launch.

- **Web Search Integration**: Bridge the knowledge gap between local AI and cloud capabilities with our web search integration, utilizing a self-hosted SearXNG instance for privacy-focused results.

- **Thinking Mode**: Powered by Qwen 3, our Thinking Mode helps you tackle complex problems and brainstorming sessions with advanced reasoning capabilities.

- **Personalization (Beta)**: Create a truly personalized AI experience by loading saved user contexts. Tailor conversations to your preferences and needs (Currently in Beta).

- **Chat History**: Access up to 30 days of conversation history, making it easy to reference past discussions and maintain context over time.

- **Broad Device Support**: Compatible with all modern iPhones, bringing private AI capabilities to more users than ever before.

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

3. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

4. Install pods:
   ```bash
   cd ios && pod install && cd ..
   ```

5. Start the application:
   ```bash
   npm run ios
   # or
   yarn ios
   ```

## 🛠️ Technical Stack

- **Framework**: React Native
- **AI Models**: 
  - Qwen 3 (1.7B Q4) for chat and reasoning
  - BGE Small for embeddings
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
