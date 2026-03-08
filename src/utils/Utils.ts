import DeviceInfo from "react-native-device-info";
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

interface SamplingParameters {
  n_predict: number;
  temperature: number;
  top_p: number;
  top_k: number;
  min_p: number;
}

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
  // Thinking / non-thinking sampling overrides
  thinkingSampling?: SamplingParameters;
  nonThinkingSampling?: SamplingParameters;
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

// Default sampling parameters for thinking mode
const DEFAULT_THINKING_SAMPLING: SamplingParameters = {
  n_predict: 4096,
  temperature: 1.0,
  top_p: 0.95,
  top_k: 20,
  min_p: 0.0,
};

// Default sampling parameters for non-thinking mode
const DEFAULT_NON_THINKING_SAMPLING: SamplingParameters = {
  n_predict: 4096,
  temperature: 1.0,
  top_p: 1.0,
  top_k: 20,
  min_p: 0.0,
};

// Default parameters (legacy flat defaults kept for backward compat)
const DEFAULT_PARAMETERS: ModelParameters = {
  n_ctx: 4096,
  n_gpu_layers: Platform.OS === 'android' ? 0 : 28,
  n_predict: 4096,
  temperature: 0.7,
  top_p: 0.8,
  top_k: 20,
  min_p: 0,
  stop: ['<|im_end|>', '<|im_start|>', '<|end|>', '<|user|>', '<|assistant|>', 'User:', 'Assistant:', 'Human:', 'AI:', '<|eot_id|>'],
  thinkingSampling: DEFAULT_THINKING_SAMPLING,
  nonThinkingSampling: DEFAULT_NON_THINKING_SAMPLING,
};

/**
 * Resolves the effective sampling parameters based on thinking mode.
 * If thinking-specific overrides exist, uses those; otherwise falls back to the flat params.
 */
function resolveSamplingParams(params: ModelParameters, thinking: boolean): Pick<ModelParameters, 'n_predict' | 'temperature' | 'top_p' | 'top_k' | 'min_p'> {
  const sampling = thinking
    ? params.thinkingSampling
    : params.nonThinkingSampling;

  if (sampling) {
    return {
      n_predict: sampling.n_predict,
      temperature: sampling.temperature,
      top_p: sampling.top_p,
      top_k: sampling.top_k,
      min_p: sampling.min_p,
    };
  }

  // Fallback to flat params for backward compatibility
  return {
    n_predict: params.n_predict,
    temperature: params.temperature,
    top_p: params.top_p,
    top_k: params.top_k,
    min_p: params.min_p,
  };
}

async function getModelParamsForDevice(thinking: boolean = false) {
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
            const sampling = resolveSamplingParams(parameters, thinking);

            const modelParams = {
              model: activeModel.filePath,
              is_model_asset: false,
              n_ctx: parameters.n_ctx,
              n_gpu_layers: parameters.n_gpu_layers,
              stop: parameters.stop,
              ...sampling,
            };

            const deviceId = DeviceInfo.getDeviceId();
            console.log(`deviceId: ${deviceId}`);
            return modelParams;
          }
        }
      }

      // Fallback to default model if no active model is set or found
      console.log('No active model found, using default model');
      const defaultSampling = resolveSamplingParams(DEFAULT_PARAMETERS, thinking);

      // On Android, check if model is downloaded to document directory
      if (Platform.OS === 'android') {
        const androidModelPath = `${RNFS.DocumentDirectoryPath}/model/Qwen3.5-2B-UD-Q4_K_XL.gguf`;
        const exists = await RNFS.exists(androidModelPath);
        if (exists) {
          console.log('Using downloaded model on Android');
          const modelParams = {
            model: androidModelPath,
            is_model_asset: false,
            n_ctx: DEFAULT_PARAMETERS.n_ctx,
            n_gpu_layers: DEFAULT_PARAMETERS.n_gpu_layers,
            stop: DEFAULT_PARAMETERS.stop,
            ...defaultSampling,
          };
          const deviceId = DeviceInfo.getDeviceId();
          console.log(`deviceId: ${deviceId}`);
          return modelParams;
        }
      }

      const modelParams = {
        model: 'file://Qwen3.5-2B-UD-Q4_K_XL.gguf',
        is_model_asset: true,
        n_ctx: DEFAULT_PARAMETERS.n_ctx,
        n_gpu_layers: DEFAULT_PARAMETERS.n_gpu_layers,
        stop: DEFAULT_PARAMETERS.stop,
        ...defaultSampling,
      };

      const deviceId = DeviceInfo.getDeviceId();
      console.log(`deviceId: ${deviceId}`);
      return modelParams;

    } catch (error) {
      console.error('Error getting model params:', error);

      const fallbackSampling = resolveSamplingParams(DEFAULT_PARAMETERS, thinking);
      const modelParams = {
        model: 'file://Qwen3.5-2B-UD-Q4_K_XL.gguf',
        is_model_asset: true,
        n_ctx: DEFAULT_PARAMETERS.n_ctx,
        n_gpu_layers: DEFAULT_PARAMETERS.n_gpu_layers,
        stop: DEFAULT_PARAMETERS.stop,
        ...fallbackSampling,
      };

      const deviceId = DeviceInfo.getDeviceId();
      console.log(`deviceId: ${deviceId}`);
      return modelParams;
    }
}
  

export { getModelParamsForDevice, DEFAULT_PARAMETERS, DEFAULT_THINKING_SAMPLING, DEFAULT_NON_THINKING_SAMPLING };
export type { ModelParameters, SamplingParameters };