import DeviceInfo from "react-native-device-info";

function getModelParamsForDevice() {
    const modelParams = {
      model: 'file://Llama-3.2-3B-Instruct-Q4_K_M.gguf',
      is_model_asset: true,
    }

    const deviceId = DeviceInfo.getDeviceId();
    console.log(`deviceId: ${deviceId}`);
    switch(deviceId) {
      case "iPhone11,2": { 
        return {...modelParams,  n_ctx: 1024,  n_gpu_layers: 8}
      }
      case "iPhone11,4": { 
        return {...modelParams,  n_ctx: 1024,  n_gpu_layers: 8}
      }
      case "iPhone11,6": { 
        return {...modelParams,  n_ctx: 1024,  n_gpu_layers: 8}
      }
      case "iPhone11,8": { 
        return {...modelParams,  n_ctx: 1024,  n_gpu_layers: 8}
      }
      case "iPhone12,1": {
        return {...modelParams,  n_ctx: 1024,  n_gpu_layers: 8}
      }
      case "iPhone12,3": {
        return {...modelParams,  n_ctx: 1024,  n_gpu_layers: 8}
      }
      case "iPhone12,5": {
        return {...modelParams,  n_ctx: 1024,  n_gpu_layers: 8}
      }
      case "iPhone12,8": {
        return {...modelParams,  n_ctx: 1024,  n_gpu_layers: 8}
      }
      case "iPhone13,1": {
        return {...modelParams,  n_ctx: 1024,  n_gpu_layers: 8}
      }
      case "iPhone13,2": {
        return {...modelParams,  n_ctx: 1024,  n_gpu_layers: 8}
      }
      case "iPhone13,3": {
        return {...modelParams,  n_ctx: 2048,  n_gpu_layers: 16}
      }
      case "iPhone13,4": {
        return {...modelParams,  n_ctx: 2048,  n_gpu_layers: 16}
      }
      case "iPhone14,4": {
        return {...modelParams,  n_ctx: 2048,  n_gpu_layers: 16}
      }
      case "iPhone14,5": {
        return {...modelParams,  n_ctx: 2048,  n_gpu_layers: 16}
      }
      default: {
        return {...modelParams,  n_ctx: 4096,  n_gpu_layers: 48}
      }
    }
  }

  export {getModelParamsForDevice}