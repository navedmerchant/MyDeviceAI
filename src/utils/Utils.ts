import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";
import RNFS from 'react-native-fs';
import { MODEL_NAMES } from './constants/Models';

function getModelParamsForDevice() {
    const modelPath = Platform.OS === 'ios' 
      ? 'file://' + MODEL_NAMES.QWEN_MODEL
      : `${RNFS.DocumentDirectoryPath}/model/${MODEL_NAMES.QWEN_MODEL}`;

    const modelParams = {
      model: modelPath,
      is_model_asset: Platform.OS === 'ios',
    }

    const deviceId = DeviceInfo.getDeviceId();
    console.log(`deviceId: ${deviceId}`);
    // TODO: n_threads should be based on the number of cores
    return {...modelParams,  n_ctx: 4096,  n_gpu_layers: 0, n_threads: 4}
}

export {getModelParamsForDevice}