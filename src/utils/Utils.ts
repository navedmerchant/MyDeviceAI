import DeviceInfo from "react-native-device-info";

function getModelParamsForDevice() {
    const modelParams = {
      model: 'file://Qwen3-1.7B-Q4_K_M.gguf',
      is_model_asset: true,
    }

    const deviceId = DeviceInfo.getDeviceId();
    console.log(`deviceId: ${deviceId}`);
    return {...modelParams,  n_ctx: 4096,  n_gpu_layers: 28
    }
}
  

  export {getModelParamsForDevice}