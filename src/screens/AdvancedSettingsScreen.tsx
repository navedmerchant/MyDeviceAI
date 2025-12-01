import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
  PermissionsAndroid,
} from 'react-native';
import { ChevronLeft, Download, Search, Trash2, Settings, HardDrive, X, Wifi } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../../App';
import RNFS from 'react-native-fs';
import { ModelParameters, DEFAULT_PARAMETERS } from '../utils/Utils';
import { useRemoteConnection } from '../connection/RemoteConnectionContext';

type AdvancedSettingsScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'AdvancedSettings'>;

type Props = {
  navigation: AdvancedSettingsScreenNavigationProp;
};

interface HuggingFaceModel {
  id: string;
  modelId: string;
  author: string;
  sha: string;
  downloads: number;
  likes: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  pipeline_tag?: string;
  library_name?: string;
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
  downloadStatus?: 'downloading' | 'cancelled' | 'completed' | 'failed';
  downloadProgress?: number;
  downloadJob?: any; // To store the RNFS download job for pause/cancel
}

interface GGUFFile {
  path: string;
  size: number;
  lfs?: {
    oid: string;
    size: number;
  } | null;
}

const AdvancedSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HuggingFaceModel[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const [downloadJobs, setDownloadJobs] = useState<{[key: string]: any}>({});
  const [cancelledDownloads, setCancelledDownloads] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'search' | 'downloaded' | 'remote'>('downloaded');
  const [showGGUFModal, setShowGGUFModal] = useState(false);

  // Remote connection state
  const { state: remoteState, connect, disconnect } = useRemoteConnection();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [selectedModel, setSelectedModel] = useState<HuggingFaceModel | null>(null);
  const [availableGGUFFiles, setAvailableGGUFFiles] = useState<GGUFFile[]>([]);
  const [loadingGGUFFiles, setLoadingGGUFFiles] = useState(false);
  const [totalStorageUsed, setTotalStorageUsed] = useState<string>('0 B');

  // Parameter configuration modal state
  const [showParameterModal, setShowParameterModal] = useState(false);
  const [selectedModelForConfig, setSelectedModelForConfig] = useState<DownloadedModel | null>(null);
  const [tempParameters, setTempParameters] = useState<ModelParameters>(DEFAULT_PARAMETERS);
  
  // Add string inputs for parameters to avoid real-time validation
  const [parameterInputs, setParameterInputs] = useState({
    n_ctx: '',
    n_gpu_layers: '',
    n_predict: '',
    temperature: '',
    top_p: '',
    top_k: '',
    min_p: '',
    stop: ''
  });

  useEffect(() => {
    loadDownloadedModels();
  }, []);

  // Reset editing state when retrying
  useEffect(() => {
    if (remoteState.isRetrying) {
      setIsEditingCode(false);
    }
  }, [remoteState.isRetrying]);

  useEffect(() => {
    calculateStorageUsage();
  }, [downloadedModels]);

  const loadDownloadedModels = async () => {
    try {
      const stored = await AsyncStorage.getItem('downloadedModels');
      const activeModelId = await AsyncStorage.getItem('activeModelId');
      let models: DownloadedModel[] = [];
      
      if (stored) {
        models = JSON.parse(stored);
      }
      
      // Determine if built-in model should be active
      const shouldBuiltInBeActive = !activeModelId || activeModelId === 'built-in-default';
      
      // Always include the built-in default model
      const builtInModel: DownloadedModel = {
        id: 'built-in-default',
        name: 'Built-in Default Model',
        author: 'Qwen3 1.7B',
        size: 'Built-in',
        downloadDate: new Date().toISOString(),
        filePath: '', // No file path for built-in model
        isActive: shouldBuiltInBeActive,
      };
      
      // Check if built-in model already exists in the list
      const hasBuiltIn = models.some(m => m.id === 'built-in-default');
      if (!hasBuiltIn) {
        models.unshift(builtInModel); // Add at the beginning
      } else {
        // Update the existing built-in model to ensure it has correct properties
        const builtInIndex = models.findIndex(m => m.id === 'built-in-default');
        models[builtInIndex] = { ...models[builtInIndex], ...builtInModel };
      }
      
      // Set other models' active status based on activeModelId
      if (activeModelId && activeModelId !== 'built-in-default') {
        models = models.map(model => ({
          ...model,
          isActive: model.id === activeModelId
        }));
      } else {
        // If no activeModelId or it's the built-in model, make sure only built-in is active
        models = models.map(model => ({
          ...model,
          isActive: model.id === 'built-in-default'
        }));
      }
      
      setDownloadedModels(models);
    } catch (error) {
      console.error('Error loading downloaded models:', error);
    }
  };

  const saveDownloadedModels = async (models: DownloadedModel[]) => {
    try {
      await AsyncStorage.setItem('downloadedModels', JSON.stringify(models));
      setDownloadedModels(models);
    } catch (error) {
      console.error('Error saving downloaded models:', error);
    }
  };

  // Remote connection handlers
  const handleConnect = async () => {
    if (!roomCodeInput.trim() || roomCodeInput.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }

    try {
      await connect(roomCodeInput);
      // Don't show alert here - will be shown when status changes to remote_connected
    } catch (error) {
      console.error('Failed to connect:', error);
      Alert.alert('Error', 'Failed to connect to desktop. Please check the code and try again.');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setRoomCodeInput('');
      setIsEditingCode(false);
      Alert.alert('Disconnected', 'Disconnected from desktop');
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleChangeCode = () => {
    setIsEditingCode(true);
    setRoomCodeInput('');
  };

  const handleCancelEdit = () => {
    setIsEditingCode(false);
    setRoomCodeInput('');
  };

  const searchHuggingFaceModels = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a search query');
      return;
    }

    setIsSearching(true);
    try {
      // Search for GGUF models on Hugging Face
      const response = await fetch(
        `https://huggingface.co/api/models?search=${encodeURIComponent(searchQuery)}&filter=gguf&sort=downloads&direction=-1&limit=20`
      );
      
      if (!response.ok) {
        throw new Error('Failed to search models');
      }
      
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching models:', error);
      Alert.alert('Error', 'Failed to search for models. Please check your internet connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const showGGUFFilesForModel = async (model: HuggingFaceModel) => {
    setSelectedModel(model);
    setLoadingGGUFFiles(true);
    setShowGGUFModal(true);
    
    try {
      // Get model files to find GGUF files
      const filesResponse = await fetch(`https://huggingface.co/api/models/${model.id}/tree/main`);
      const files = await filesResponse.json();
      
      // Find GGUF files
      const ggufFiles = files.filter((file: any) => 
        file.path.toLowerCase().endsWith('.gguf')
      );
      
      if (ggufFiles.length === 0) {
        setShowGGUFModal(false);
        Alert.alert('Error', 'No GGUF files found in this model');
        return;
      }
      
      setAvailableGGUFFiles(ggufFiles);
    } catch (error) {
      console.error('Error fetching GGUF files:', error);
      setShowGGUFModal(false);
      Alert.alert('Error', 'Failed to fetch model files. Please try again.');
    } finally {
      setLoadingGGUFFiles(false);
    }
  };

  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'This app needs access to storage to download models',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const downloadSelectedGGUF = async (ggufFile: GGUFFile) => {
    if (!selectedModel) return;
    
    // Request storage permission
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Storage permission is required to download files');
      return;
    }
    
    const downloadKey = `${selectedModel.id}/${ggufFile.path}`;
    setIsDownloading(selectedModel.id);
    setShowGGUFModal(false);
    
    try {
      // Create file path
      const fileName = `${selectedModel.id.replace('/', '_')}_${ggufFile.path}`.replace(/[^a-zA-Z0-9._-]/g, '_');
      const modelsDir = Platform.OS === 'ios' 
        ? `${RNFS.DocumentDirectoryPath}/models`
        : `${RNFS.ExternalDirectoryPath}/models`;
      
      // Ensure models directory exists
      await RNFS.mkdir(modelsDir);
      
      const filePath = `${modelsDir}/${fileName}`;
      
      // Check if file already exists
      const fileExists = await RNFS.exists(filePath);
      if (fileExists) {
        Alert.alert('File Exists', 'This model file already exists. Do you want to re-download it?', [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Re-download', 
            onPress: async () => {
              await RNFS.unlink(filePath);
              downloadSelectedGGUF(ggufFile);
            }
          }
        ]);
        return;
      }
      
      // Create downloading model entry immediately
      const downloadingModel: DownloadedModel = {
        id: downloadKey,
        name: ggufFile.path,
        author: selectedModel.id.split('/')[0] || 'Unknown',
        size: formatFileSize(ggufFile.lfs?.size || ggufFile.size || 0),
        downloadDate: new Date().toISOString(),
        filePath: filePath,
        isActive: false,
        downloadStatus: 'downloading',
        downloadProgress: 0,
      };
      
      // Add to downloaded models list immediately
      const updatedModels = [...downloadedModels, downloadingModel];
      setDownloadedModels(updatedModels);
      
      // Switch to downloaded tab
      setActiveTab('downloaded');
      
      // Construct download URL
      const downloadUrl = `https://huggingface.co/${selectedModel.id}/resolve/main/${ggufFile.path}`;
      
      console.log("downloadUrl", downloadUrl);
      console.log("filePath", filePath);

      // Start download with progress tracking
      const downloadResult = RNFS.downloadFile({
        fromUrl: downloadUrl,
        toFile: filePath,
        begin: (res) => {
          if (!res.contentLength || res.contentLength === 0) {
            console.warn('Server did not provide Content-Length header, progress tracking may not work');
          }

          setDownloadedModels(prev => prev.map(model => 
            model.id === downloadKey 
              ? { 
                  ...model, 
                  downloadStatus: 'downloading',
                  downloadProgress: 0 
                }
              : model
          ));
        },
        progress: (res) => {
          if (res.contentLength && res.contentLength > 0) {
            const progress = (res.bytesWritten / res.contentLength) * 100;
            console.log("progress", progress);
            
            setDownloadedModels(prev => prev.map(model => 
              model.id === downloadKey 
                ? { ...model, downloadProgress: progress }
                : model
            ));
          } else {
            console.log(`Downloaded: ${formatFileSize(res.bytesWritten)}`);
            setDownloadedModels(prev => prev.map(model => 
              model.id === downloadKey 
                ? { 
                    ...model, 
                    downloadProgress: -1,
                    size: formatFileSize(res.bytesWritten)
                  }
                : model
            ));
          }
        },
        progressDivider: 1,
      });
      
      // Store the download job for pause/cancel functionality
      console.log('Storing download job with jobId:', downloadResult.jobId);
      setDownloadJobs(prev => ({ ...prev, [downloadKey]: downloadResult }));
      
      // Wait for download to complete
      const result = await downloadResult.promise;
      
      if (result.statusCode !== 200) {
        throw new Error(`Download failed with status code: ${result.statusCode}`);
      }
      
      // Get actual downloaded file size
      const fileInfo = await RNFS.stat(filePath);
      const actualSize = fileInfo.size;
      
      // Update model with completion status
      const completedModel: DownloadedModel = {
        ...downloadingModel,
        size: formatFileSize(actualSize),
        downloadStatus: 'completed',
        downloadProgress: 100,
      };
      
      const finalModels = downloadedModels.map(model => 
        model.id === downloadKey ? completedModel : model
      ).concat(downloadedModels.find(m => m.id === downloadKey) ? [] : [completedModel]);
      
      await saveDownloadedModels(finalModels);
      
      // Clean up download job
      setDownloadJobs(prev => {
        const newJobs = { ...prev };
        delete newJobs[downloadKey];
        return newJobs;
      });
      
      Alert.alert('Success', `Model "${completedModel.name}" has been downloaded successfully!`);
    } catch (error) {
      console.error('Error downloading model:', error);
      
      // Check if this download was manually cancelled
      if (cancelledDownloads.has(downloadKey)) {
        console.log('Download was cancelled by user');
        // Clean up cancelled downloads set
        setCancelledDownloads(prev => {
          const newSet = new Set(prev);
          newSet.delete(downloadKey);
          return newSet;
        });
        return; // Exit early for cancelled downloads
      }
      
      // Update model status to failed for genuine errors
      setDownloadedModels(prev => prev.map(model => 
        model.id === downloadKey 
          ? { ...model, downloadStatus: 'failed' as const }
          : model
      ));
      
      // Clean up partial download if it exists
      try {
        const fileName = `${selectedModel.id.replace('/', '_')}_${ggufFile.path}`.replace(/[^a-zA-Z0-9._-]/g, '_');
        const modelsDir = Platform.OS === 'ios' 
          ? `${RNFS.DocumentDirectoryPath}/models`
          : `${RNFS.ExternalDirectoryPath}/models`;
        const filePath = `${modelsDir}/${fileName}`;
        
        const fileExists = await RNFS.exists(filePath);
        if (fileExists) {
          await RNFS.unlink(filePath);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up partial download:', cleanupError);
      }
      
      // Clean up download job
      setDownloadJobs(prev => {
        const newJobs = { ...prev };
        delete newJobs[downloadKey];
        return newJobs;
      });
      
      Alert.alert('Error', `Failed to download model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloading(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const calculateStorageUsage = async () => {
    try {
      let totalBytes = 0;
      
      for (const model of downloadedModels) {
        // Skip built-in model for storage calculation
        if (model.id === 'built-in-default') continue;
        
        if (model.filePath) {
          const fileExists = await RNFS.exists(model.filePath);
          if (fileExists) {
            const fileInfo = await RNFS.stat(model.filePath);
            totalBytes += fileInfo.size;
          }
        }
      }
      
      setTotalStorageUsed(formatFileSize(totalBytes));
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      setTotalStorageUsed('Error calculating');
    }
  };

  const deleteModel = async (modelId: string) => {
    // Prevent deletion of built-in model
    if (modelId === 'built-in-default') {
      Alert.alert('Cannot Delete', 'The built-in default model cannot be deleted.');
      return;
    }
    
    Alert.alert(
      'Delete Model',
      'Are you sure you want to delete this model? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
                      try {
            // Find the model to get its file path and check if it was active
            const modelToDelete = downloadedModels.find(m => m.id === modelId);
            const wasActiveModel = modelToDelete?.isActive;
            
            if (modelToDelete && modelToDelete.filePath) {
              // Delete the actual file
              const fileExists = await RNFS.exists(modelToDelete.filePath);
              if (fileExists) {
                await RNFS.unlink(modelToDelete.filePath);
              }
            }
            
            // Remove from downloaded models list
            const updatedModels = downloadedModels.filter(m => m.id !== modelId);
            
            // Check if only built-in model remains or if we deleted the active model
            const nonBuiltInModels = updatedModels.filter(m => m.id !== 'built-in-default');
            if (nonBuiltInModels.length === 0 || wasActiveModel) {
              // Set built-in model as active
              const finalModels = updatedModels.map(model => ({
                ...model,
                isActive: model.id === 'built-in-default'
              }));
              await saveDownloadedModels(finalModels);
              await AsyncStorage.setItem('activeModelId', 'built-in-default');
            } else {
              await saveDownloadedModels(updatedModels);
            }
            
            Alert.alert('Success', 'Model deleted successfully');
          } catch (error) {
            console.error('Error deleting model:', error);
            Alert.alert('Error', 'Failed to delete model file, but removed from list');
            
            // Still remove from list even if file deletion failed
            const updatedModels = downloadedModels.filter(m => m.id !== modelId);
            
            // Check if we need to set built-in as active after failed deletion
            const modelToDelete = downloadedModels.find(m => m.id === modelId);
            const wasActiveModel = modelToDelete?.isActive;
            const nonBuiltInModels = updatedModels.filter(m => m.id !== 'built-in-default');
            
            if (nonBuiltInModels.length === 0 || wasActiveModel) {
              // Set built-in model as active
              const finalModels = updatedModels.map(model => ({
                ...model,
                isActive: model.id === 'built-in-default'
              }));
              await saveDownloadedModels(finalModels);
              await AsyncStorage.setItem('activeModelId', 'built-in-default');
            } else {
              await saveDownloadedModels(updatedModels);
            }
          }
          }
        }
      ]
    );
  };

  const setActiveModel = async (modelId: string) => {
    const updatedModels = downloadedModels.map(model => ({
      ...model,
      isActive: model.id === modelId
    }));
    await saveDownloadedModels(updatedModels);
    await AsyncStorage.setItem('activeModelId', modelId);
  };

  const openParameterConfig = (model: DownloadedModel) => {
    setSelectedModelForConfig(model);
    const currentParams = model.parameters || DEFAULT_PARAMETERS;
    setTempParameters(currentParams);
    
    // Set string inputs from current parameters
    setParameterInputs({
      n_ctx: currentParams.n_ctx.toString(),
      n_gpu_layers: currentParams.n_gpu_layers.toString(),
      n_predict: currentParams.n_predict.toString(),
      temperature: currentParams.temperature.toString(),
      top_p: currentParams.top_p.toString(),
      top_k: currentParams.top_k.toString(),
      min_p: currentParams.min_p.toString(),
      stop: currentParams.stop.join(', ')
    });
    
    setShowParameterModal(true);
  };

  const saveModelParameters = async () => {
    if (!selectedModelForConfig) return;

    // Validate and parse inputs
    try {
      const n_ctx = parseInt(parameterInputs.n_ctx);
      const n_gpu_layers = parseInt(parameterInputs.n_gpu_layers);
      const n_predict = parseInt(parameterInputs.n_predict);
      const temperature = parseFloat(parameterInputs.temperature);
      const top_p = parseFloat(parameterInputs.top_p);
      const top_k = parseInt(parameterInputs.top_k);
      const min_p = parseFloat(parameterInputs.min_p);
      const stop = parameterInputs.stop.split(',').map(s => s.trim()).filter(s => s.length > 0);

      // Validation checks
      const errors: string[] = [];
      
      if (isNaN(n_ctx) || n_ctx <= 0) {
        errors.push('Context Length must be a positive integer');
      }
      
      if (isNaN(n_gpu_layers) || n_gpu_layers < 0) {
        errors.push('GPU Layers must be a non-negative integer');
      }
      
      if (isNaN(n_predict) || n_predict <= 0) {
        errors.push('Max Tokens must be a positive integer');
      }
      
      if (isNaN(temperature) || temperature <= 0) {
        errors.push('Temperature must be a positive number');
      }
      
      if (isNaN(top_p) || top_p < 0 || top_p > 1) {
        errors.push('Top P must be a number between 0 and 1');
      }
      
      if (isNaN(top_k) || top_k <= 0) {
        errors.push('Top K must be a positive integer');
      }
      
      if (isNaN(min_p) || min_p < 0 || min_p > 1) {
        errors.push('Min P must be a number between 0 and 1');
      }

      // If there are validation errors, show them and don't save
      if (errors.length > 0) {
        Alert.alert(
          'Invalid Parameters', 
          'Please fix the following errors:\n\n' + errors.join('\n'),
          [{ text: 'OK' }]
        );
        return;
      }

      // Create validated parameters object
      const validatedParameters: ModelParameters = {
        n_ctx,
        n_gpu_layers,
        n_predict,
        temperature,
        top_p,
        top_k,
        min_p,
        stop
      };

      // Check if initialization parameters changed (requires model reload)
      const oldParams = selectedModelForConfig.parameters || DEFAULT_PARAMETERS;
      const initParamsChanged = 
        oldParams.n_ctx !== validatedParameters.n_ctx || 
        oldParams.n_gpu_layers !== validatedParameters.n_gpu_layers;

      const updatedModels = downloadedModels.map(model => {
        if (model.id === selectedModelForConfig.id) {
          return {
            ...model,
            parameters: validatedParameters
          };
        }
        return model;
      });

      await saveDownloadedModels(updatedModels);
      
      // Set flag to indicate model needs reloading if this is the active model
      if (selectedModelForConfig.isActive && initParamsChanged) {
        await AsyncStorage.setItem('modelNeedsReload', 'true');
      }
      
      setShowParameterModal(false);
      setSelectedModelForConfig(null);
      
      if (selectedModelForConfig.isActive && initParamsChanged) {
        Alert.alert(
          'Parameters Updated', 
          'Context length or GPU layers were changed. The model will reload automatically on your next message.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Success', 'Model parameters updated successfully!');
      }
    } catch (error) {
      Alert.alert(
        'Invalid Parameters', 
        'Please enter valid numeric values for all parameters.',
        [{ text: 'OK' }]
      );
    }
  };

  const resetParametersToDefault = () => {
    setTempParameters(DEFAULT_PARAMETERS);
    
    // Reset string inputs to default values
    setParameterInputs({
      n_ctx: DEFAULT_PARAMETERS.n_ctx.toString(),
      n_gpu_layers: DEFAULT_PARAMETERS.n_gpu_layers.toString(),
      n_predict: DEFAULT_PARAMETERS.n_predict.toString(),
      temperature: DEFAULT_PARAMETERS.temperature.toString(),
      top_p: DEFAULT_PARAMETERS.top_p.toString(),
      top_k: DEFAULT_PARAMETERS.top_k.toString(),
      min_p: DEFAULT_PARAMETERS.min_p.toString(),
      stop: DEFAULT_PARAMETERS.stop.join(', ')
    });
  };

  const cancelDownload = async (modelId: string) => {
    Alert.alert(
      'Cancel Download',
      'Are you sure you want to cancel this download?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            const downloadJob = downloadJobs[modelId];
            console.log('Cancel download - downloadJob:', downloadJob);
            console.log('Download jobs state:', downloadJobs);
            
            try {
              // Mark this download as cancelled before stopping it
              setCancelledDownloads(prev => new Set([...prev, modelId]));
              
              // Stop the download job if it exists
              if (downloadJob && downloadJob.jobId) {
                console.log('Stopping download with jobId:', downloadJob.jobId);
                RNFS.stopDownload(downloadJob.jobId);
              } else {
                console.warn('Download job not found or jobId not available:', downloadJob);
              }
              
              // Clean up partial download file immediately
              const modelToDelete = downloadedModels.find(m => m.id === modelId);
              if (modelToDelete && modelToDelete.filePath) {
                const fileExists = await RNFS.exists(modelToDelete.filePath);
                if (fileExists) {
                  await RNFS.unlink(modelToDelete.filePath);
                }
              }
              
              // Remove the model from downloaded list
              const updatedModels = downloadedModels.filter(m => m.id !== modelId);
              setDownloadedModels(updatedModels);
              
              // Clean up download job
              setDownloadJobs(prev => {
                const newJobs = { ...prev };
                delete newJobs[modelId];
                return newJobs;
              });
              
              setIsDownloading(null);
              
              Alert.alert('Download Cancelled', 'The download has been cancelled successfully.');
            } catch (error) {
              console.error('Error canceling download:', error);
              Alert.alert('Error', `Failed to cancel download properly: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }
      ]
    );
  };

  const renderSearchResult = ({ item }: { item: HuggingFaceModel }) => {
    const hasActiveDownload = downloadedModels.some(model => 
      model.id.startsWith(item.id) && model.downloadStatus === 'downloading'
    );
    
    return (
      <View style={styles.modelCard}>
        <View style={styles.modelInfo}>
          <Text style={styles.modelName}>{item.id}</Text>
          <Text style={styles.modelAuthor}>by {item.id.split('/')[0]}</Text>
          <View style={styles.modelStats}>
            <Text style={styles.modelStat}>⬇ {item.downloads?.toLocaleString() || 0}</Text>
            <Text style={styles.modelStat}>♥ {item.likes?.toLocaleString() || 0}</Text>
          </View>
          {item.pipeline_tag && (
            <Text style={styles.modelTag}>{item.pipeline_tag}</Text>
          )}
          {hasActiveDownload && (
            <Text style={styles.downloadingText}>Download in progress - check Downloaded tab</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.downloadButton, (isDownloading === item.id || hasActiveDownload) && styles.downloadingButton]}
          onPress={() => showGGUFFilesForModel(item)}
          disabled={isDownloading === item.id || hasActiveDownload}
        >
          {isDownloading === item.id || hasActiveDownload ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Download color="#fff" size={20} />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderDownloadedModel = ({ item }: { item: DownloadedModel }) => (
    <View style={[styles.modelCard, item.isActive && styles.activeModelCard, item.id === 'built-in-default' && styles.builtInModelCard]}>
      <View style={styles.modelInfo}>
        <Text style={styles.modelName}>{item.name}</Text>
        <Text style={styles.modelAuthor}>by {item.author}</Text>
        <Text style={styles.modelSize}>Size: {item.size}</Text>
        
        {/* Download progress for downloading models */}
        {item.downloadStatus === 'downloading' && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Downloading: {item.downloadProgress?.toFixed(1) || 0}%
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${item.downloadProgress || 0}%` }]} />
            </View>
          </View>
        )}
        
        {/* Status indicators */}
        {item.downloadStatus === 'failed' && (
          <Text style={styles.failedLabel}>FAILED</Text>
        )}
        
        {item.id !== 'built-in-default' && item.downloadStatus === 'completed' && (
          <Text style={styles.downloadDate}>
            Downloaded: {new Date(item.downloadDate).toLocaleDateString()}
          </Text>
        )}
        {item.id === 'built-in-default' && (
          <Text style={styles.builtInLabel}>Default model included with the app</Text>
        )}
        {item.isActive && (
          <Text style={styles.activeLabel}>ACTIVE</Text>
        )}
      </View>
      <View style={styles.modelActions}>
        {/* Download control buttons */}
        {item.downloadStatus === 'downloading' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => cancelDownload(item.id)}
          >
            <Text style={styles.actionButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
        
        {item.downloadStatus === 'failed' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => deleteModel(item.id)}
          >
            <Trash2 color="#ff4444" size={16} />
          </TouchableOpacity>
        )}
        
        {/* Normal actions for completed models */}
        {(item.downloadStatus === 'completed' || !item.downloadStatus) && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.configButton]}
              onPress={() => openParameterConfig(item)}
            >
              <Settings color="#28a745" size={16} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.activateButton,
                item.isActive && styles.disabledButton
              ]}
              onPress={() => setActiveModel(item.id)}
              disabled={item.isActive}
            >
              <Text style={[
                styles.actionButtonText,
                item.isActive && styles.disabledButtonText
              ]}>
                {item.isActive ? 'Active' : 'Activate'}
              </Text>
            </TouchableOpacity>
            {item.id !== 'built-in-default' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => deleteModel(item.id)}
              >
                <Trash2 color="#ff4444" size={16} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color="#fff" size={24} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <HardDrive color="#fff" size={24} />
          <Text style={styles.title}>Advanced</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'downloaded' && styles.activeTab]}
          onPress={() => setActiveTab('downloaded')}
        >
          <HardDrive color={activeTab === 'downloaded' ? '#007AFF' : '#666'} size={20} />
          <Text style={[styles.tabText, activeTab === 'downloaded' && styles.activeTabText]}>
            Available ({downloadedModels.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.activeTab]}
          onPress={() => setActiveTab('search')}
        >
          <Search color={activeTab === 'search' ? '#007AFF' : '#666'} size={20} />
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
            Search
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'remote' && styles.activeTab]}
          onPress={() => setActiveTab('remote')}
        >
          <Wifi color={activeTab === 'remote' ? '#007AFF' : '#666'} size={20} />
          <Text style={[styles.tabText, activeTab === 'remote' && styles.activeTabText]}>
            Remote
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'remote' ? (
        <ScrollView style={styles.content} contentContainerStyle={styles.remoteContentContainer}>
          <Text style={styles.sectionTitle}>Remote Connection</Text>
          <Text style={styles.remoteDescription}>
            Connect to MyDeviceAI-Desktop to run models on your computer
          </Text>

          {remoteState.isConnected ? (
            // Connected state - show connected UI
            <View style={styles.connectedContainer}>
              <View style={styles.connectedBadge}>
                <Wifi color="#4CAF50" size={24} />
                <Text style={styles.connectedText}>Connected to Desktop</Text>
              </View>
              <Text style={styles.connectedSubtext}>
                Room Code: {remoteState.config?.roomCode}
              </Text>
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={handleDisconnect}
              >
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : remoteState.config?.roomCode && (!isEditingCode || remoteState.isRetrying) ? (
            // Have saved code but not connected - show immutable code with change button
            // Also show this view if retrying (even if user was editing code)
            <View style={styles.connectionSetup}>
              <Text style={styles.inputLabel}>Saved Connection Code</Text>
              <View style={styles.savedCodeContainer}>
                <Text style={styles.savedCodeText}>{remoteState.config.roomCode}</Text>
              </View>

              {remoteState.status === 'remote_connecting' && (
                <View style={styles.connectingIndicator}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.connectingText}>Connecting to desktop...</Text>
                </View>
              )}

              {remoteState.isRetrying && remoteState.nextRetryIn !== null && (
                <View style={styles.retryingIndicator}>
                  <ActivityIndicator size="small" color="#FFC107" />
                  <Text style={styles.retryingText}>
                    Retrying in {Math.ceil(remoteState.nextRetryIn / 1000)}s (Attempt {remoteState.retryCount})
                  </Text>
                </View>
              )}

              {remoteState.lastError && !remoteState.isRetrying && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{remoteState.lastError}</Text>
                </View>
              )}

              <View style={styles.savedCodeActions}>
                <TouchableOpacity
                  style={[styles.changeCodeButton, styles.changeCodeButtonFullWidth]}
                  onPress={handleChangeCode}
                  disabled={remoteState.status === 'remote_connecting' || remoteState.isRetrying}
                >
                  <Text style={styles.changeCodeButtonText}>Change Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // No saved code or editing - show input form
            <View style={styles.connectionSetup}>
              <Text style={styles.inputLabel}>Enter 6-Digit Code</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="ABC123"
                placeholderTextColor="#666"
                value={roomCodeInput}
                onChangeText={setRoomCodeInput}
                maxLength={6}
                keyboardType="default"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <View style={styles.inputActions}>
                {isEditingCode && (
                  <TouchableOpacity
                    style={styles.cancelEditButton}
                    onPress={handleCancelEdit}
                  >
                    <Text style={styles.cancelEditButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.connectButtonFlex,
                    remoteState.status === 'remote_connecting' && styles.connectButtonDisabled
                  ]}
                  onPress={handleConnect}
                  disabled={remoteState.status === 'remote_connecting'}
                >
                  {remoteState.status === 'remote_connecting' ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={[styles.connectButtonText, { marginLeft: 8 }]}>Connecting...</Text>
                    </>
                  ) : (
                    <Text style={styles.connectButtonText}>Connect</Text>
                  )}
                </TouchableOpacity>
              </View>

              {remoteState.lastError && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{remoteState.lastError}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>How it works:</Text>
            <Text style={styles.infoText}>
              1. Open MyDeviceAI-Desktop on your computer{'\n'}
              2. Get the 6-digit alphanumeric code from the desktop app{'\n'}
              3. Enter the code above and tap Connect{'\n'}
              4. Your messages will be processed on your desktop
            </Text>
          </View>
        </ScrollView>
      ) : activeTab === 'search' ? (
        <View style={styles.content}>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search GGUF models on Hugging Face..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={searchHuggingFaceModels}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={searchHuggingFaceModels}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Search color="#fff" size={20} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>
            Search Results ({searchResults.length})
          </Text>

          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            style={styles.resultsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {searchQuery ? 'No models found. Try a different search term.' : 'Enter a search query to find GGUF models'}
                </Text>
              </View>
            }
          />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.downloadedHeader}>
            <Text style={styles.sectionTitle}>
              Downloaded Models ({downloadedModels.length})
            </Text>
            <Text style={styles.storageInfo}>
              Storage used: {totalStorageUsed}
            </Text>
          </View>
          
          <FlatList
            data={downloadedModels}
            renderItem={renderDownloadedModel}
            keyExtractor={(item) => item.id}
            style={styles.resultsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No models downloaded yet. Search and download models to get started.
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* GGUF Files Selection Modal */}
      <Modal
        visible={showGGUFModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGGUFModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Select GGUF File
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowGGUFModal(false)}
            >
              <X color="#fff" size={24} />
            </TouchableOpacity>
          </View>
          
          {selectedModel && (
            <View style={styles.modalModelInfo}>
              <Text style={styles.modalModelName}>{selectedModel.id}</Text>
              <Text style={styles.modalModelAuthor}>by {selectedModel.id.split('/')[0]}</Text>
            </View>
          )}

          {loadingGGUFFiles ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.modalLoadingText}>Loading GGUF files...</Text>
            </View>
          ) : (
            <FlatList
              data={availableGGUFFiles}
              keyExtractor={(item) => item.path}
              style={styles.ggufFilesList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.ggufFileItem}
                  onPress={() => downloadSelectedGGUF(item)}
                >
                  <View style={styles.ggufFileInfo}>
                    <Text style={styles.ggufFileName}>{item.path}</Text>
                    <Text style={styles.ggufFileSize}>
                      Size: {formatFileSize(item.lfs?.size || item.size || 0)}
                    </Text>
                  </View>
                  <Download color="#007AFF" size={20} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No GGUF files found</Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>

      {/* Parameter Configuration Modal */}
      <Modal
        visible={showParameterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowParameterModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Configure Model Parameters
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowParameterModal(false)}
            >
              <X color="#fff" size={24} />
            </TouchableOpacity>
          </View>
          
          {selectedModelForConfig && (
            <View style={styles.modalModelInfo}>
              <Text style={styles.modalModelName}>{selectedModelForConfig.name}</Text>
              <Text style={styles.modalModelAuthor}>by {selectedModelForConfig.author}</Text>
            </View>
          )}

          <ScrollView style={styles.parameterConfigContainer}>
            <View style={styles.parameterSection}>
              <Text style={styles.parameterSectionTitle}>Context & GPU Settings</Text>
              
              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Context Length (n_ctx)</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={parameterInputs.n_ctx}
                  onChangeText={(text) => setParameterInputs(prev => ({
                    ...prev,
                    n_ctx: text
                  }))}
                  keyboardType="numeric"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>GPU Layers (n_gpu_layers)</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={parameterInputs.n_gpu_layers}
                  onChangeText={(text) => setParameterInputs(prev => ({
                    ...prev,
                    n_gpu_layers: text
                  }))}
                  keyboardType="numeric"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Max Tokens (n_predict)</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={parameterInputs.n_predict}
                  onChangeText={(text) => setParameterInputs(prev => ({
                    ...prev,
                    n_predict: text
                  }))}
                  keyboardType="numeric"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            <View style={styles.parameterSection}>
              <Text style={styles.parameterSectionTitle}>Sampling Parameters</Text>
              
              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Temperature</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={parameterInputs.temperature}
                  onChangeText={(text) => setParameterInputs(prev => ({
                    ...prev,
                    temperature: text
                  }))}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Top P</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={parameterInputs.top_p}
                  onChangeText={(text) => setParameterInputs(prev => ({
                    ...prev,
                    top_p: text
                  }))}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Top K</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={parameterInputs.top_k}
                  onChangeText={(text) => setParameterInputs(prev => ({
                    ...prev,
                    top_k: text
                  }))}
                  keyboardType="numeric"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Min P</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={parameterInputs.min_p}
                  onChangeText={(text) => setParameterInputs(prev => ({
                    ...prev,
                    min_p: text
                  }))}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            <View style={styles.parameterSection}>
              <Text style={styles.parameterSectionTitle}>Stop Sequences</Text>
              <Text style={styles.parameterDescription}>
                Enter stop sequences separated by commas
              </Text>
              <TextInput
                style={[styles.parameterInput, styles.stopSequenceInput]}
                value={parameterInputs.stop}
                onChangeText={(text) => setParameterInputs(prev => ({
                  ...prev,
                  stop: text
                }))}
                multiline
                placeholderTextColor="#666"
                placeholder="<|im_end|>, <|im_start|>, <|end|>"
              />
            </View>

            <View style={styles.parameterButtonContainer}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetParametersToDefault}
              >
                <Text style={styles.resetButtonText}>Reset to Default</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveModelParameters}
              >
                <Text style={styles.saveButtonText}>Save Parameters</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: Platform.OS === 'ios' ? 50 : 0,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  placeholder: {
    width: 80,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    color: '#666',
    fontSize: 16,
    marginLeft: 8,
  },
  activeTabText: {
    color: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 48,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  resultsList: {
    flex: 1,
  },
  modelCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeModelCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  builtInModelCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modelAuthor: {
    color: '#999',
    fontSize: 14,
    marginBottom: 4,
  },
  modelStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  modelStat: {
    color: '#666',
    fontSize: 12,
  },
  modelTag: {
    color: '#007AFF',
    fontSize: 12,
    fontStyle: 'italic',
  },
  modelSize: {
    color: '#999',
    fontSize: 12,
    marginBottom: 2,
  },
  downloadDate: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  activeLabel: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  builtInLabel: {
    color: '#34C759',
    fontSize: 12,
    fontStyle: 'italic',
  },
  downloadButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadingButton: {
    backgroundColor: '#666',
  },
  modelActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    borderRadius: 6,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  activateButton: {
    backgroundColor: '#007AFF',
  },
  configButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#28a745',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 8,
  },
  modalModelInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalModelName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalModelAuthor: {
    color: '#999',
    fontSize: 14,
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  ggufFilesList: {
    flex: 1,
    padding: 16,
  },
  ggufFileItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ggufFileInfo: {
    flex: 1,
  },
  ggufFileName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ggufFileSize: {
    color: '#999',
    fontSize: 14,
  },
  // Progress bar styles
  progressContainer: {
    marginTop: 8,
  },
  progressText: {
    color: '#007AFF',
    fontSize: 12,
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  // Downloaded models header styles
  downloadedHeader: {
    marginBottom: 16,
  },
  storageInfo: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
  // Parameter configuration modal styles
  parameterConfigContainer: {
    flex: 1,
    padding: 16,
  },
  parameterSection: {
    marginBottom: 24,
  },
  parameterSectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  parameterRow: {
    marginBottom: 16,
  },
  parameterLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  parameterDescription: {
    color: '#999',
    fontSize: 12,
    marginBottom: 8,
  },
  parameterInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    fontSize: 14,
  },
  stopSequenceInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  parameterButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 32,
    gap: 12,
  },
  resetButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Download status labels
  failedLabel: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Download control buttons
  cancelButton: {
    backgroundColor: '#ff4444',
  },
  downloadingText: {
    color: '#007AFF',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Remote connection styles
  remoteContentContainer: {
    padding: 20,
  },
  remoteDescription: {
    color: '#999',
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  connectedContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  connectedText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  connectedSubtext: {
    color: '#999',
    fontSize: 14,
    marginBottom: 20,
  },
  disconnectButton: {
    backgroundColor: '#ff4444',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  disconnectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  connectionSetup: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  codeInput: {
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  connectButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  connectButtonFlex: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#ff444420',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    textAlign: 'center',
  },
  infoSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoText: {
    color: '#999',
    fontSize: 14,
    lineHeight: 22,
  },
  // Saved code display styles
  savedCodeContainer: {
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
    alignItems: 'center',
  },
  savedCodeText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  connectingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#007AFF20',
    borderRadius: 8,
  },
  connectingText: {
    color: '#007AFF',
    fontSize: 14,
  },
  retryingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#FFC10720',
    borderRadius: 8,
  },
  retryingText: {
    color: '#FFC107',
    fontSize: 14,
  },
  savedCodeActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  changeCodeButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  changeCodeButtonFullWidth: {
    flex: undefined,
    width: '100%',
  },
  changeCodeButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  inputActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelEditButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelEditButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdvancedSettingsScreen; 