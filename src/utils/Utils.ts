import DeviceInfo from "react-native-device-info";
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

interface ModelParameters {
  n_ctx: number;
  n_gpu_layers: number;
  n_predict: number;
  temperature: number;
  top_p: number;
  top_k: number;
  min_p: number;
  stop: string[];
  batch_size?: number;
}

interface DownloadedModel {
  id: string;
  name: string;
  author: string;
  size: string;
  downloadDate: string;
  filePath: string;
  isActive: boolean;
  parameters?: ModelParameters;
}

// Default parameters
const DEFAULT_PARAMETERS: ModelParameters = {
  n_ctx: 4096,
  n_gpu_layers: Platform.OS === 'android' ? 0 : 28,
  n_predict: 4096,
  temperature: 0.7,
  top_p: 0.8,
  top_k: 20,
  min_p: 0,
  stop: ['<|im_end|>', '<|im_start|>', '<|end|>', '<|user|>', '<|assistant|>', 'User:', 'Assistant:', 'Human:', 'AI:', '<|eot_id|>'],
};

async function getModelParamsForDevice() {
    try {
      // Get the active model ID from AsyncStorage
      const activeModelId = await AsyncStorage.getItem('activeModelId');

      if (activeModelId) {
        // Get downloaded models from AsyncStorage
        const downloadedModelsJson = await AsyncStorage.getItem('downloadedModels');
        if (downloadedModelsJson) {
          const downloadedModels: DownloadedModel[] = JSON.parse(downloadedModelsJson);

          // Find the active model
          const activeModel = downloadedModels.find(model => model.id === activeModelId);

          if (activeModel && activeModel.filePath) {
            console.log(`Loading active model: ${activeModel.name} from ${activeModel.filePath}`);

            // Use stored parameters or default parameters
            const parameters = activeModel.parameters || DEFAULT_PARAMETERS;

            const modelParams = {
              model: activeModel.filePath,
              is_model_asset: false, // Downloaded models are not bundled assets
              ...parameters,
              // Add batch_size for Android devices
              ...(Platform.OS === 'android' && { batch_size: 512 }),
            };

            const deviceId = DeviceInfo.getDeviceId();
            console.log(`deviceId: ${deviceId}`);
            return modelParams;
          }
        }
      }

      // Fallback to default model if no active model is set or found
      console.log('No active model found, using default model');

      // On Android, check if model is downloaded to document directory
      if (Platform.OS === 'android') {
        const androidModelPath = `${RNFS.DocumentDirectoryPath}/model/Qwen3-1.7B-Q4_K_M.gguf`;
        const exists = await RNFS.exists(androidModelPath);
        if (exists) {
          console.log('Using downloaded model on Android');
          const modelParams = {
            model: androidModelPath,
            is_model_asset: false,
            ...DEFAULT_PARAMETERS,
          };
          const deviceId = DeviceInfo.getDeviceId();
          console.log(`deviceId: ${deviceId}`);
          return modelParams;
        }
      }

      const modelParams = {
        model: 'file://Qwen3-1.7B-Q4_K_M.gguf',
        is_model_asset: true,
        ...DEFAULT_PARAMETERS,
      };

      const deviceId = DeviceInfo.getDeviceId();
      console.log(`deviceId: ${deviceId}`);
      return modelParams;

    } catch (error) {
      console.error('Error getting model params:', error);

      // Fallback to default model on error
      const modelParams = {
        model: 'file://Qwen3-1.7B-Q4_K_M.gguf',
        is_model_asset: true,
        ...DEFAULT_PARAMETERS,
      };

      const deviceId = DeviceInfo.getDeviceId();
      console.log(`deviceId: ${deviceId}`);
      return modelParams;
    }
}
  

export { getModelParamsForDevice, DEFAULT_PARAMETERS };
export type { ModelParameters };