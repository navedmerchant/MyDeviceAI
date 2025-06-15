import DeviceInfo from "react-native-device-info";
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DownloadedModel {
  id: string;
  name: string;
  author: string;
  size: string;
  downloadDate: string;
  filePath: string;
  isActive: boolean;
}

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
            
            const modelParams = {
              model: activeModel.filePath,
              is_model_asset: false, // Downloaded models are not bundled assets
            };
            
            const deviceId = DeviceInfo.getDeviceId();
            console.log(`deviceId: ${deviceId}`);
            return {...modelParams, n_ctx: 4096, n_gpu_layers: 28};
          }
        }
      }
      
      // Fallback to default model if no active model is set or found
      console.log('No active model found, using default model');
      const modelParams = {
        model: 'file://Qwen3-1.7B-Q4_K_M.gguf',
        is_model_asset: true,
      };

      const deviceId = DeviceInfo.getDeviceId();
      console.log(`deviceId: ${deviceId}`);
      return {...modelParams, n_ctx: 4096, n_gpu_layers: 28};
      
    } catch (error) {
      console.error('Error getting model params:', error);
      
      // Fallback to default model on error
      const modelParams = {
        model: 'file://Qwen3-1.7B-Q4_K_M.gguf',
        is_model_asset: true,
      };

      const deviceId = DeviceInfo.getDeviceId();
      console.log(`deviceId: ${deviceId}`);
      return {...modelParams, n_ctx: 4096, n_gpu_layers: 28};
    }
}
  

  export {getModelParamsForDevice}